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
