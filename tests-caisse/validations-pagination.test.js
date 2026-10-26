/* Page Validations : tableaux longs → groupes repliables (« Tout déployer » / « Tout réduire ») + pagination.
   Circuit chantier & achats, files d'attente (caisse, engagements, transferts, budget, réappro) et historiques. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, n) {
  await page.evaluate(function (n) {
    window.hasRole = function () { return true; }; window.toast = function () {};
    APP._valPg = {}; APP._valGrp = {};
    var types = ['bon_commande', 'situation', 'facture_fournisseur'];
    DATA.validations = [];
    for (var i = 0; i < n; i++) DATA.validations.push({ id: 'v' + i, type: types[i % 3], ref_id: 'r' + i, libelle: 'Élément ' + i, montant: 1000 * (i + 1), statut: 'en_attente', demandeur: 'Agent', date_demande: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), meta: {} });
    valFilter = 'en_attente'; valSearch = ''; renderValidations();
  }, n);
}
const etat = (page) => page.evaluate(function () {
  var lignes = [].slice.call(document.querySelectorAll('#tbody-validations tr:not(.val-grp-hd)'));
  var ent = [].slice.call(document.querySelectorAll('#tbody-validations tr.val-grp-hd')).map(function (t) { return t.textContent.replace(/\s+/g, ' ').trim(); });
  return { lignes: lignes.length, ent: ent, pied: document.getElementById('val-pagination').textContent.replace(/\s+/g, ' ').trim(), barre: document.getElementById('val-toolbar').textContent.replace(/\s+/g, ' ').trim() };
});

test('circuit : 60 éléments → 25 par page, groupes par type avec nombre et total', async () => {
  const app = await ouvrirApp(); await preparer(app.page, 60);
  const r = await etat(app.page);
  assert.equal(r.lignes, 25);
  assert.equal(r.ent.length, 2, 'page 1 : 20 bons de commande puis 5 situations');
  assert.match(r.ent[0], /Bon de commande/); assert.match(r.ent[0], /20/);
  assert.match(r.pied, /1–25 sur 60 · page 1 \/ 3/); assert.match(r.barre, /Tout déployer/); assert.match(r.barre, /Tout réduire/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('circuit : page suivante, taille de page, « (suite) » d\'un groupe coupé', async () => {
  const app = await ouvrirApp(); await preparer(app.page, 60);
  let r = await app.page.evaluate(function () { valPgAller('circuit', 2, 'renderValidations'); return null; });
  r = await etat(app.page);
  assert.equal(r.lignes, 25); assert.match(r.pied, /26–50 sur 60 · page 2 \/ 3/); assert.match(r.ent[0], /\(suite\)/);
  await app.page.evaluate(function () { valPgTaille('circuit', 100, 'renderValidations'); });
  r = await etat(app.page);
  assert.equal(r.lignes, 60); assert.equal(r.ent.length, 3); assert.match(r.pied, /1–60 sur 60 · page 1 \/ 1/);
});

test('circuit : Tout réduire masque les lignes (groupes conservés), Tout déployer les rend, un groupe se replie seul', async () => {
  const app = await ouvrirApp(); await preparer(app.page, 60);
  await app.page.evaluate(function () { valGrpTout('circuit', false, 'renderValidations'); });
  let r = await etat(app.page);
  assert.equal(r.lignes, 0); assert.ok(r.ent.length >= 2);
  await app.page.evaluate(function () { valGrpTout('circuit', true, 'renderValidations'); });
  r = await etat(app.page); assert.equal(r.lignes, 25);
  await app.page.evaluate(function () { valGrpBascule('circuit', 0, 'renderValidations'); });
  r = await etat(app.page); assert.equal(r.lignes, 5, 'le groupe du bon de commande (20 lignes) est replié');
  await app.page.evaluate(function () { renderValidations(); });
  r = await etat(app.page); assert.equal(r.lignes, 5, 'l\'état replié survit à un rafraîchissement');
});

test('circuit : la recherche ramène à la page 1 ; peu d\'éléments → pas de pagination', async () => {
  const app = await ouvrirApp(); await preparer(app.page, 60);
  await app.page.evaluate(function () { valPgAller('circuit', 3, 'renderValidations'); });
  const r = await app.page.evaluate(async function () {
    var el = document.getElementById('val-search'); el.value = 'Élément 59'; el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(function (x) { setTimeout(x, 300); });
    return { page: valPgEtat('circuit').page, n: document.querySelectorAll('#tbody-validations tr:not(.val-grp-hd)').length, pied: document.getElementById('val-pagination').textContent.replace(/\s+/g, ' ').trim() };
  });
  assert.equal(r.page, 1); assert.ok(r.n >= 1 && r.n <= 10, String(r.n)); assert.match(r.pied, /élément\(s\)/);
});

test('files d\'attente et historiques : mêmes groupes repliables et même pagination', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const r = await page.evaluate(async function () {
    window.hasRole = function () { return true; }; window.toast = function () {}; APP._valPg = {}; APP._valGrp = {};
    DATA.divisions = [{ id: 'd1', nom: 'Building' }, { id: 'd2', nom: 'Agro' }];
    DATA.fiches_engagement_depense = []; for (var i = 0; i < 40; i++) DATA.fiches_engagement_depense.push({ id: 'f' + i, statut: 'soumise', numero: 'FED-' + i, objet: 'Achat ' + i, compte: '601', montant: 5000 + i, division_id: i % 2 ? 'd1' : 'd2', created_at: '2026-10-' + String(1 + (i % 28)).padStart(2, '0') });
    DATA.transferts_budgetaires = []; DATA.caisse_budgets = []; DATA.demandes_reappro = [];
    DATA.demandes_reappro = []; for (var j = 0; j < 30; j++) DATA.demandes_reappro.push({ id: 'r' + j, statut: 'validee', numero: 'REA-' + j, montant_demande: 10000, division_id: 'd1', valide_le: (j < 15 ? '2026-09-' : '2026-10-') + String(1 + (j % 28)).padStart(2, '0') + 'T10:00:00Z' });
    renderPageValidations();
    var fed = document.getElementById('validations-fed-box'), h = document.getElementById('histo-validations-reappro-box');
    var o = { fedLignes: fed.querySelectorAll('tbody tr:not(.val-grp-hd)').length, fedEnt: fed.querySelectorAll('tr.val-grp-hd').length, fedPied: fed.textContent.indexOf('1–25 sur 40') !== -1, fedBtn: fed.textContent.indexOf('Tout réduire') !== -1,
      hLignes: h.querySelectorAll('tbody tr:not(.val-grp-hd)').length, hEnt: [].map.call(h.querySelectorAll('tr.val-grp-hd'), function (t) { return t.textContent.replace(/\s+/g, ' ').trim(); }), hPied: h.textContent.indexOf('1–25 sur 30') !== -1 };
    valGrpTout('fed', false, 'renderPageValidations'); o.fedReduit = document.getElementById('validations-fed-box').querySelectorAll('tbody tr:not(.val-grp-hd)').length;
    return o;
  });
  assert.equal(r.fedLignes, 25); assert.equal(r.fedEnt, 2); assert.equal(r.fedPied, true); assert.equal(r.fedBtn, true); assert.equal(r.fedReduit, 0);
  assert.equal(r.hLignes, 25); assert.ok(r.hEnt.length >= 1 && /2026-/.test(r.hEnt[0])); assert.equal(r.hPied, true);
  assert.deepEqual(app.etat.erreursPage, []);
});
