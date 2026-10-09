const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function amorcer(page) {
  await page.evaluate(function () {
    const clot = new Date(Date.now() - 3 * 3600000).toISOString();
    DATA.caisse_sessions = [{ id: 's1', caisse_id: 'c1', date: new Date().toISOString().slice(0, 10), statut: 'cloturee', fond_ouverture: 1000, fond_cloture_theorique: 1000, fond_cloture_reel: 1000, ecart: 0,
      ouverte_par: 'T', ouverte_par_id: 'u1', ouverte_le: new Date(Date.now() - 8 * 3600000).toISOString(), cloturee_le: clot }];
    DATA.caisse_mouvements = [
      { id: 'm1', session_id: 's1', caisse_id: 'c1', type: 'sortie', montant: 400, requiert_validation: true, valide: false, numero: 'S1', motif: 'Transport', beneficiaire: 'Chauffeur', created_at: new Date(Date.now() - 4 * 3600000).toISOString() }];
  });
}

test('validation après clôture : le bon est marqué, la session recalculée, la bannière et le badge apparaissent', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const m = DATA.caisse_mouvements[0];
      APP.currentUser = { id: 'u2', nom: 'Valideur', role: 'comptable' };
      m.valide = true; m.valide_le = new Date().toISOString();
      await caisseRecalculerSiCloturee(m);
      const s = DATA.caisse_sessions[0];
      return { marque: m.valide_apres_cloture, theo: s.fond_cloture_theorique, ecart: s.ecart,
        badge: caisseBadgeApresCloture(m).indexOf('après clôture') !== -1, banniere: caisseBanniereApresCloture().indexOf('après la clôture') !== -1,
        sansBadge: caisseBadgeApresCloture({ id: 'x' }) };
    });
    assert.equal(r.marque, true);
    assert.equal(r.theo, 600);
    assert.equal(r.ecart, 400);
    assert.equal(r.badge, true);
    assert.equal(r.banniere, true);
    assert.equal(r.sansBadge, '');
  } finally { await app.fermer(); }
});

test('validation avant la clôture : aucune marque « après clôture »', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const m = DATA.caisse_mouvements[0];
      m.valide = true; m.valide_le = new Date(Date.now() - 5 * 3600000).toISOString();     /* avant la clôture */
      await caisseRecalculerSiCloturee(m);
      return { marque: m.valide_apres_cloture, banniere: caisseBanniereApresCloture() };
    });
    assert.equal(r.marque, undefined);
    assert.equal(r.banniere, '');
  } finally { await app.fermer(); }
});

test('versement en espèces rattaché à une session clôturée : bon marqué et alerte affichée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      window.__toasts = [];
      const toastOrigine = window.toast;
      window.toast = function (msg, type) { window.__toasts.push(msg); };
      window._vrsCompteCredit = function () { return '41110000'; };
      DATA.caisse_mouvements = [];
      const v = { id: 'v1', ref: 'VRS-T1', montant: 250000, date: new Date().toISOString().slice(0, 10), client_id: 'cl1', type: 'apport', mode: 'especes' };
      const res = await _vrsCreerBonCaisse(v, 'c1');
      window.toast = toastOrigine;
      return { mvt: !!res.mvt, marque: res.mvt && res.mvt.saisi_apres_cloture, cloturee: res.cloturee, alerte: window.__toasts.some(function (t) { return /session CLÔTURÉE/.test(t); }),
        theo: DATA.caisse_sessions[0].fond_cloture_theorique, ecart: DATA.caisse_sessions[0].ecart };
    });
    assert.equal(r.mvt, true);
    assert.equal(r.marque, true);
    assert.equal(r.cloturee, true);
    assert.equal(r.alerte, true);
    assert.equal(r.theo, 251000);
    assert.equal(r.ecart, -250000);
  } finally { await app.fermer(); }
});
