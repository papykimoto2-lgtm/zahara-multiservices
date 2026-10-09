const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Prépare l'utilisateur avec un PIN, une caisse fermée et le formulaire d'ouverture. */
async function amorcer(page) {
  await page.evaluate(async function () {
    const salt = 's1';
    APP.currentUser = { id: 'u1', nom: 'Caissière Test', role: 'caissiere', caisse_pin_hash: await hashPassword('1234', salt), caisse_pin_salt: salt };
    DATA.caisse_sessions = [];
    window.__form = function (fond) {
      document.getElementById('co-caisse-id').value = 'c1';
      document.getElementById('co-fond').value = String(fond === undefined ? 1000 : fond);
      document.getElementById('co-pin').value = '1234';
    };
    CAISSE_UI._fondSuggere = null;
  });
}

test('ouverture : refusée si le cloud signale déjà une session ouverte', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const n = await app.page.evaluate(async function () {
      __enLigne(true);
      window.sbFetch = async function () { return [{ id: 'sX', data: { id: 'sX', ouverte_par: 'Autre', ouverte_le: new Date().toISOString() } }]; };
      __form(); await caisseOuvrir();
      return DATA.caisse_sessions.length;
    });
    assert.equal(n, 0);
  } finally { await app.fermer(); }
});

test('ouverture : refusée si l\'état du cloud ne peut pas être vérifié (en ligne)', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const n = await app.page.evaluate(async function () {
      __enLigne(true);
      window.sbFetch = async function () { return null; };
      __form(); await caisseOuvrir();
      return DATA.caisse_sessions.length;
    });
    assert.equal(n, 0);
  } finally { await app.fermer(); }
});

test('ouverture hors ligne : confirmation explicite exigée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    app.etat.confirm = false;
    const refus = await app.page.evaluate(async function () { __enLigne(false); __form(); await caisseOuvrir(); return DATA.caisse_sessions.length; });
    assert.equal(refus, 0);
    assert.ok(app.etat.dialogues.some(function (d) { return /hors ligne/.test(d); }));
    app.etat.confirm = true;
    const ok = await app.page.evaluate(async function () { __form(); await caisseOuvrir(); return DATA.caisse_sessions.length; });
    assert.equal(ok, 1);
  } finally { await app.fermer(); }
});

test('ouverture : cloud libre → session créée ; refus du cloud à l\'envoi (course entre 2 postes) → annulée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      __enLigne(true);
      window.sbFetch = async function () { return []; };
      window.syncToSupabase = async function () { return true; };
      __form(); await caisseOuvrir();
      const libre = DATA.caisse_sessions.length;
      DATA.caisse_sessions = [];
      let appels = 0;
      window.sbFetch = async function () { appels++; return appels === 1 ? [] : [{ id: 'sY', data: { id: 'sY', ouverte_par: 'Autre Poste', ouverte_le: new Date().toISOString() } }]; };
      window.caisseSyncEtAlerter = async function () { return false; };
      __form(); await caisseOuvrir();
      return { libre: libre, apresCourse: DATA.caisse_sessions.length };
    });
    assert.equal(r.libre, 1);
    assert.equal(r.apresCourse, 0);
  } finally { await app.fermer(); }
});

test('ouverture : un fond différent du dernier comptage exige un motif ; un fond négatif est refusé', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      __enLigne(true);
      window.sbFetch = async function () { return []; };
      DATA.caisse_sessions = [{ id: 's0', caisse_id: 'c1', date: '2026-10-01', statut: 'cloturee', fond_ouverture: 0, fond_cloture_theorique: 4000, fond_cloture_reel: 4000, ecart: 0, ouverte_le: '2026-10-01T08:00:00Z', cloturee_le: '2026-10-01T17:00:00Z' }];
      await caisseOuvrirModal('c1');
      const suggere = document.getElementById('co-fond').value;
      document.getElementById('co-pin').value = '1234';
      document.getElementById('co-fond').value = '500'; caisseOuvrirFondChange();
      const visible = document.getElementById('co-fond-motif-group').style.display === '';
      document.getElementById('co-fond-motif').value = '';
      await caisseOuvrir();
      const sansMotif = DATA.caisse_sessions.length;
      document.getElementById('co-fond').value = '-500'; await caisseOuvrir();
      const negatif = DATA.caisse_sessions.length;
      document.getElementById('co-fond').value = '500'; document.getElementById('co-fond-motif').value = 'recomptage ce matin';
      await caisseOuvrir();
      const s = DATA.caisse_sessions[DATA.caisse_sessions.length - 1];
      return { suggere: suggere, visible: visible, sansMotif: sansMotif, negatif: negatif, total: DATA.caisse_sessions.length, ecartOuv: s.fond_ouverture_ecart, motif: s.fond_ouverture_motif };
    });
    assert.equal(r.suggere, '4000');
    assert.equal(r.visible, true);
    assert.equal(r.sansMotif, 1);
    assert.equal(r.negatif, 1);
    assert.equal(r.total, 2);
    assert.equal(r.ecartOuv, -3500);
    assert.equal(r.motif, 'recomptage ce matin');
  } finally { await app.fermer(); }
});
