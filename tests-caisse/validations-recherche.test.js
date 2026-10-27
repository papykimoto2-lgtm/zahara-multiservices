/* Circuit de validation (chantier & achats) : barre de recherche multicritère. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  await page.evaluate(function () {
    window.hasRole = function () { return true; };
    DATA.validations = [
      { id: 'v1', type: 'bon_commande', ref_id: 'b1', libelle: 'BC BC-2026-001 — Société Électro Plus', montant: 1250000, statut: 'en_attente', demandeur: 'Aïcha Koné', date_demande: '2026-10-02', meta: {} },
      { id: 'v2', type: 'situation', ref_id: 's1', libelle: 'Situation n°3 — Lot gros œuvre', montant: 8400000, statut: 'en_attente', demandeur: 'Yao Brou', date_demande: '2026-10-05', meta: {} },
      { id: 'v3', type: 'attestation_solde', ref_id: 'c1', libelle: 'Attestation de solde ATS-2026-004 — BENDE', montant: 5000000, statut: 'valide', demandeur: 'Marie', valideur: 'DG', date_demande: '2026-09-20', date_decision: '2026-09-21', motif: '', meta: {} },
      { id: 'v4', type: 'bon_commande', ref_id: 'b2', libelle: 'BC BC-2026-002 — Quincaillerie Ouest', montant: 90000, statut: 'rejete', demandeur: 'Yao Brou', valideur: 'DG', date_demande: '2026-09-10', date_decision: '2026-09-11', motif: 'Prix trop élevé', meta: {} }
    ];
    valFilter = 'en_attente'; valSearch = ''; renderValidations();
  });
}
const chercher = (page, txt) => page.evaluate(async function (t) {
  var el = document.getElementById('val-search'); el.value = t; el.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(function (r) { setTimeout(r, 300); });
  return { lignes: [].slice.call(document.querySelectorAll('#tbody-validations tr:not(.val-grp-hd)')).map(function (tr) { return tr.textContent.replace(/\s+/g, ' ').trim(); }), compte: document.getElementById('val-search-count').textContent };
}, txt);

test('la barre de recherche est présente et la liste complète s\'affiche sans saisie', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () { return { barre: !!document.getElementById('val-search'), n: document.querySelectorAll('#tbody-validations tr:not(.val-grp-hd)').length, compte: document.getElementById('val-search-count').textContent }; });
  assert.equal(r.barre, true); assert.equal(r.n, 2); assert.equal(r.compte, '');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('recherche sans accent ni casse, sur l\'objet, le demandeur et le type', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  let r = await chercher(app.page, 'ELECTRO');
  assert.equal(r.lignes.length, 1); assert.match(r.lignes[0], /Électro Plus/); assert.equal(r.compte, '1 / 2 résultat(s)');
  r = await chercher(app.page, 'aicha kone'); assert.equal(r.lignes.length, 1); assert.match(r.lignes[0], /BC-2026-001/);
  r = await chercher(app.page, 'situation'); assert.equal(r.lignes.length, 1); assert.match(r.lignes[0], /gros œuvre/);
});

test('plusieurs mots (ET), montant avec ou sans espaces, date', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  let r = await chercher(app.page, 'yao situation'); assert.equal(r.lignes.length, 1);
  r = await chercher(app.page, 'yao koné'); assert.match(r.lignes[0], /Aucun résultat/);
  r = await chercher(app.page, '8400000'); assert.equal(r.lignes.length, 1); assert.match(r.lignes[0], /Situation/);
  r = await chercher(app.page, '8 400 000'); assert.equal(r.lignes.length, 1);
  r = await chercher(app.page, '2026-10-02'); assert.equal(r.lignes.length, 1); assert.match(r.lignes[0], /Électro/);
});

test('aucun résultat : message clair ; effacer la recherche rétablit la liste', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  let r = await chercher(app.page, 'zzzz'); assert.equal(r.lignes.length, 1); assert.match(r.lignes[0], /Aucun résultat pour cette recherche/); assert.equal(r.compte, '0 / 2 résultat(s)');
  r = await chercher(app.page, ''); assert.equal(r.lignes.length, 2); assert.equal(r.compte, '');
});

test('l\'historique est aussi filtré (statut, valideur, motif) et la saisie survit au changement d\'onglet', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  await app.page.evaluate(function () { valSetFilter('histo'); });
  let r = await chercher(app.page, 'trop élevé'); assert.equal(r.lignes.length, 1); assert.match(r.lignes[0], /Quincaillerie/);
  r = await chercher(app.page, 'valide dg'); assert.equal(r.lignes.length, 1); assert.match(r.lignes[0], /BENDE/);
  r = await chercher(app.page, 'rejet'); assert.equal(r.lignes.length, 1);
  const garde = await app.page.evaluate(function () { valSetFilter('en_attente'); return document.getElementById('val-search').value; });
  assert.equal(garde, 'rejet');
});

test('texte HTML saisi ou présent dans les données : jamais interprété', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var el = document.getElementById('val-search'); el.value = '<img src=x onerror=alert(1)>'; el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(function (r) { setTimeout(r, 300); });
    return { inj: document.querySelectorAll('#tbody-validations img, #val-search-count img').length, texte: document.getElementById('tbody-validations').textContent };
  });
  assert.equal(r.inj, 0); assert.match(r.texte, /Aucun résultat/);
  assert.deepEqual(app.etat.erreursPage, []);
});
