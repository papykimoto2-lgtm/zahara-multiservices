const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function amorcer(page) {
  await page.evaluate(function () {
    const mk = function (id, ec) { return { id: id, caisse_id: 'c1', date: '2026-09-1' + id.slice(-1), statut: 'cloturee', fond_cloture_theorique: 1000, fond_cloture_reel: 1000 + ec, ecart: ec }; };
    DATA.caisse_sessions = [mk('sA', 1000000), mk('sB', -1000000), mk('sC', -5000)];
    DATA.caisse_mouvements = [{ id: 'm1', session_id: 'sC', caisse_id: 'c1', type: 'sortie', montant: 5000, requiert_validation: true, valide: false }];
  });
}

test('régularisation : le net par caisse est affiché avant toute écriture', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const texte = await app.page.evaluate(function () {
      caisseRenderEcarts();
      return document.getElementById('caisse-ecarts-box').textContent.replace(/\s+/g, ' ');
    });
    assert.match(texte, /Net par caisse/);
    assert.match(texte, /3 écart\(s\)/);
    assert.match(texte, /net -5\s?000 FCFA/);
  } finally { await app.fermer(); }
});

test('régularisation unitaire : refusée avec mouvements en attente, sans motif ; acceptée avec motif et tracée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const enAttente = await app.page.evaluate(async function () { await caisseRegulariserEcart('sC'); return DATA.ecritures.length; });
    assert.equal(enAttente, 0);
    app.etat.prompts = [''];
    const sansMotif = await app.page.evaluate(async function () { await caisseRegulariserEcart('sB'); return DATA.ecritures.length; });
    assert.equal(sansMotif, 0);
    app.etat.prompts = ['Remise caisse principale justifiée par bordereau 123'];
    const r = await app.page.evaluate(async function () {
      await caisseRegulariserEcart('sB');
      const s = DATA.caisse_sessions.find(function (x) { return x.id === 'sB'; });
      return { n: DATA.ecritures.length, reg: s.ecart_regularise, motif: s.ecart_regularise_motif, notes: DATA.ecritures[0].notes };
    });
    assert.equal(r.n, 1);
    assert.equal(r.reg, true);
    assert.equal(r.motif, 'Remise caisse principale justifiée par bordereau 123');
    assert.match(r.notes, /motif : Remise caisse principale/);
  } finally { await app.fermer(); }
});

test('régularisation en masse : confirmation à taper, motif commun, sessions avec mouvements en attente exclues', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    app.etat.prompts = ['oui'];
    const fausse = await app.page.evaluate(async function () { await caisseRegulariserTousEcarts(); return DATA.ecritures.length; });
    assert.equal(fausse, 0);
    app.etat.prompts = ['REGULARISER', 'Écarts compensés et justifiés'];
    const r = await app.page.evaluate(async function () {
      await caisseRegulariserTousEcarts();
      return DATA.caisse_sessions.filter(function (s) { return s.ecart_regularise; }).map(function (s) { return s.id; }).sort();
    });
    assert.deepEqual(r, ['sA', 'sB']);        /* sC exclue : mouvement en attente de validation */
    assert.match(app.etat.dialogues.find(function (d) { return /EN MASSE/.test(d); }), /NET/);
  } finally { await app.fermer(); }
});
