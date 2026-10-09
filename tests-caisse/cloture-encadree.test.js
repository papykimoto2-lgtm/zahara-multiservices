const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Session ouverte il y a `heures` h par `parId`, utilisateur courant = u1. */
async function amorcer(page, parId, heures) {
  await page.evaluate(function (a) {
    window.hasRole = function () { return true; };   /* seul un administrateur peut clôturer la session d'un autre */
    DATA.caisse_sessions = [{ id: 's1', caisse_id: 'c1', date: '2026-10-09', statut: 'ouverte', fond_ouverture: 1000, ouverte_par: 'Caissière X', ouverte_par_id: a.parId,
      ouverte_le: new Date(Date.now() - a.heures * 3600000).toISOString() }];
    DATA.caisse_mouvements = [];
    window.__cloturer = async function (montant, motif) {
      caisseClôturerModal('c1');
      document.getElementById('ccl-fond-reel').value = String(montant);
      const m = document.getElementById('ccl-motif-admin'); if (m) m.value = motif || '';
      await caisseCloturer();
      return DATA.caisse_sessions[0];
    };
  }, { parId: parId, heures: heures });
}

test('clôture par un tiers : motif obligatoire, enregistrée comme administrative', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, 'u9', 2);
    const r = await app.page.evaluate(async function () {
      caisseClôturerModal('c1');
      const boite = document.getElementById('ccl-recap').textContent;
      const sans = (await __cloturer(1000, '')).statut;
      const avec = await __cloturer(1000, 'Session oubliée ouverte, clôturée en l\'absence de la caissière');
      return { boite: boite, sans: sans, statut: avec.statut, admin: avec.cloture_administrative, motif: avec.cloture_motif };
    });
    assert.match(r.boite, /Clôture par un tiers/);
    assert.equal(r.sans, 'ouverte');
    assert.equal(r.statut, 'cloturee');
    assert.equal(r.admin, true);
    assert.match(r.motif, /oubliée/);
  } finally { await app.fermer(); }
});

test('clôture par la titulaire dans la journée : aucun motif exigé, pas de marque administrative', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, 'u1', 2);
    const r = await app.page.evaluate(async function () {
      const s = await __cloturer(1000, '');
      return { statut: s.statut, admin: s.cloture_administrative, motif: s.cloture_motif, boite: !!document.getElementById('ccl-motif-admin') };
    });
    assert.equal(r.statut, 'cloturee');
    assert.equal(r.admin, undefined);
    assert.equal(r.motif, undefined);
  } finally { await app.fermer(); }
});

test('clôture tardive (plus de 24 h) par la titulaire : motif exigé', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, 'u1', 50);
    const r = await app.page.evaluate(async function () {
      const sans = (await __cloturer(1000, '')).statut;
      const avec = await __cloturer(1000, 'Oubli de clôture hier soir');
      return { sans: sans, statut: avec.statut, h: avec.cloture_tardive_h, admin: avec.cloture_administrative };
    });
    assert.equal(r.sans, 'ouverte');
    assert.equal(r.statut, 'cloturee');
    assert.equal(r.h, 50);
    assert.equal(r.admin, undefined);
  } finally { await app.fermer(); }
});

test('clôture : refusée si le cloud la dit déjà clôturée, ou si son état est inconnu ; confirmation hors ligne', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, 'u1', 2);
    const r = await app.page.evaluate(async function () {
      __enLigne(true);
      window.sbFetch = async function () { return [{ id: 's1', data: { id: 's1', statut: 'cloturee', cloturee_par: 'Koné Sory' } }]; };
      const dejaCloturee = (await __cloturer(1000, '')).statut;
      window.sbFetch = async function () { return null; };
      const inconnu = (await __cloturer(1000, '')).statut;
      return { dejaCloturee: dejaCloturee, inconnu: inconnu };
    });
    assert.equal(r.dejaCloturee, 'ouverte');   /* la clôture existante n'est pas écrasée */
    assert.equal(r.inconnu, 'ouverte');
    app.etat.confirm = false;
    const horsLigneRefus = await app.page.evaluate(async function () { __enLigne(false); return (await __cloturer(1000, '')).statut; });
    assert.equal(horsLigneRefus, 'ouverte');
    app.etat.confirm = true;
    const horsLigneOk = await app.page.evaluate(async function () { return (await __cloturer(1000, '')).statut; });
    assert.equal(horsLigneOk, 'cloturee');
  } finally { await app.fermer(); }
});

test('synchro : une seconde clôture ne remplace pas une clôture déjà enregistrée sur le cloud', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      SB.url = 'https://x.supabase.co'; SB.key = 'k'; __enLigne(true);
      const appels = [];
      window.sbFetch = async function (path, method) {
        appels.push((method || 'GET') + ' ' + path.split('?')[0]);
        if ((method || 'GET') === 'POST') return [];
        if (path.indexOf('select=id,s:') > -1) return [{ id: 's1', s: 'cloturee', c: '2026-10-05T17:00:00.000Z' }];
        if (path.indexOf('select=*') > -1) return [{ id: 's1', data: { id: 's1', caisse_id: 'c1', statut: 'cloturee', cloturee_le: '2026-10-05T17:00:00.000Z', cloturee_par: 'Caissière X', fond_cloture_reel: 12650 } }];
        return [];
      };
      const o = { id: 's1', caisse_id: 'c1', statut: 'cloturee', cloturee_le: '2026-10-07T11:57:33.000Z', cloturee_par: 'Koné Sory', fond_cloture_reel: 99 };
      await __syncReel('pi_caisse_sessions', o);
      const memeClot = { id: 's1', caisse_id: 'c1', statut: 'cloturee', cloturee_le: '2026-10-05T17:00:00.000Z', fond_cloture_reel: 12650, recalcule_le: 'x' };
      appels.length = 0;
      await __syncReel('pi_caisse_sessions', memeClot);
      return { par: o.cloturee_par, reel: o.fond_cloture_reel, recalculEnvoye: appels.some(function (a) { return a.indexOf('POST') === 0; }) };
    });
    assert.equal(r.par, 'Caissière X');
    assert.equal(r.reel, 12650);
    assert.equal(r.recalculEnvoye, true);      /* un recalcul (même clôture) reste envoyé normalement */
  } finally { await app.fermer(); }
});
