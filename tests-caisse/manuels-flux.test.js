/* Paramètres › Manuels & flux : catalogue des manuels (PDF existants) et diagrammes de flux. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('chaque manuel du catalogue pointe vers un PDF existant et chaque diagramme référencé existe', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    return { cat: MANUELS_CATALOGUE.map(function (m) { return { f: m.fichier, flux: m.flux }; }), flux: Object.keys(MANUELS_FLUX) };
  });
  r.cat.forEach(function (m) {
    assert.ok(fs.existsSync(path.resolve(__dirname, '..', 'docs', m.f + '.pdf')), m.f + '.pdf introuvable');
    m.flux.forEach(function (id) { assert.ok(r.flux.indexOf(id) !== -1, 'diagramme manquant : ' + id); });
  });
});

test("les diagrammes n'apparaissent qu'au clic sur un manuel", async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    switchTab('params', 'manuels');
    var avant = { carte: getComputedStyle(document.getElementById('manuels-flux-card')).display, flux: document.querySelectorAll('#manuels-flux .manuel-flux').length };
    manuelsSelectionner('PRO-ATT');
    var apres = { carte: getComputedStyle(document.getElementById('manuels-flux-card')).display, flux: document.querySelectorAll('#manuels-flux .manuel-flux').length, attendu: MANUELS_CATALOGUE.filter(function (m) { return m.ref === 'PRO-ATT'; })[0].flux.length };
    manuelsSelectionner('PRO-ATT');
    var ferme = getComputedStyle(document.getElementById('manuels-flux-card')).display;
    document.getElementById('manuels-recherche').value = 'caisse'; renderManuelsFlux();
    return { avant: avant, apres: apres, ferme: ferme, lignes: document.querySelectorAll('#manuels-liste tbody tr').length, nm: MANUELS_CATALOGUE.length };
  });
  assert.equal(r.avant.carte, 'none'); assert.equal(r.avant.flux, 0);
  assert.equal(r.apres.carte, 'block'); assert.equal(r.apres.flux, r.apres.attendu);
  assert.equal(r.ferme, 'none');
  assert.ok(r.lignes >= 1 && r.lignes < r.nm);
});

test('chaque diagramme renvoie vers le manuel qui détaille ses procédures', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    var sansManuel = Object.keys(MANUELS_FLUX).filter(function (id) { return !MANUELS_CATALOGUE.some(function (m) { return m.ref === MANUELS_FLUX[id].ref; }); });
    switchTab('params', 'manuels');
    manuelsSelectionner('GUI-FON');
    var liens = Array.prototype.map.call(document.querySelectorAll('#manuels-flux a[href^="docs/"]'), function (a) { return a.getAttribute('href'); });
    return { sansManuel: sansManuel, liens: liens };
  });
  assert.deepEqual(r.sansManuel, []);
  assert.ok(r.liens.length >= 1);
  assert.ok(r.liens.every(function (h) { return h === 'docs/MANUEL_PROCEDURES_FONCIER.pdf'; }));
});

test('la cartographie des processus place chaque manuel dans un seul processus', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    var compte = {};
    MANUELS_PROCESSUS.forEach(function (p) { p.refs.forEach(function (x) { compte[x] = (compte[x] || 0) + 1; }); });
    var doubles = Object.keys(compte).filter(function (x) { return compte[x] > 1; });
    var sansProcessus = MANUELS_CATALOGUE.filter(function (m) { return !compte[m.ref]; }).map(function (m) { return m.ref; });
    switchTab('params', 'manuels');
    manuelsChangerVue('carto');
    var puces = document.querySelectorAll('#manuels-liste button[onclick^="manuelsSelectionner"]').length;
    manuelsSelectionner('PRO-ATT');
    var flux = document.querySelectorAll('#manuels-flux .manuel-flux').length;
    return { doubles: doubles, sansProcessus: sansProcessus, puces: puces, nb: MANUELS_CATALOGUE.length, flux: flux, autres: document.getElementById('manuels-liste').textContent.indexOf('Autres procédures') };
  });
  assert.deepEqual(r.doubles, []);
  assert.deepEqual(r.sansProcessus, []);
  assert.equal(r.puces, r.nb);
  assert.ok(r.flux >= 1);
  assert.equal(r.autres, -1);
});

test('SMQ : fiche processus (pilote, indicateurs, documents) avec suggestions à valider', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async function () {
    window.toast = function () {};
    window.smqPeutEditer = function () { return true; };
    DATA.params = DATA.params || {}; DATA.params.smq_processus = {};
    switchTab('params', 'manuels'); manuelsChangerVue('carto');
    smqOuvrir('encaissement');
    var visible = getComputedStyle(document.getElementById('manuels-smq-card')).display;
    smqSuggerer('k'); smqSuggerer('d');
    var nbK = _smqEdit.indicateurs.length, nbD = _smqEdit.documents.length;
    var nonValides = _smqEdit.indicateurs.every(function (x) { return x.valide === false; });
    var procedures = _smqEdit.documents.filter(function (x) { return x.type === 'Procédure' && x.ref; }).length;
    document.getElementById('smq-pilote').value = 'Awa Koné';
    document.getElementById('smq-k-valide-0').checked = true;
    document.getElementById('smq-d-valide-0').checked = true;
    await smqSauver();
    var d = smqDonnees('encaissement');
    var avant = smqResumeHtml('encaissement');
    var compl = smqCompletudeHtml();
    smqAjouter('k'); smqSuggerer('k');
    var apresDoublon = _smqEdit.indicateurs.length;
    window.smqPeutEditer = function () { return false; };
    await smqSauver();
    smqRendre();
    var sansBouton = document.getElementById('manuels-smq').innerHTML.indexOf('smqSauver()') === -1;
    return { visible: visible, nbK: nbK, nbD: nbD, nonValides: nonValides, procedures: procedures, pilote: d.pilote, kSauves: d.indicateurs.length, dSauves: d.documents.length,
      resume: avant.indexOf('Awa Koné') !== -1 && avant.indexOf('1 indicateur') !== -1, compl: compl.indexOf('1 / ') !== -1, sansBouton: sansBouton, nbApres: apresDoublon, sup: SMQ_SUGGESTIONS.encaissement.k.length };
  });
  assert.equal(r.visible, 'block');
  assert.equal(r.nbK, r.sup);
  assert.ok(r.procedures >= 5);
  assert.ok(r.nbD > r.procedures);
  assert.ok(r.nonValides);
  assert.equal(r.pilote, 'Awa Koné');
  assert.equal(r.kSauves, r.sup);
  assert.ok(r.resume && r.compl && r.sansBouton);
});
