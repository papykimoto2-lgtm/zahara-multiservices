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

test("l'onglet affiche manuels et diagrammes, et la recherche filtre", async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    switchTab('params', 'manuels');
    var n1 = document.querySelectorAll('#manuels-liste tbody tr').length, d1 = document.querySelectorAll('#manuels-flux .manuel-flux').length;
    document.getElementById('manuels-recherche').value = 'caisse'; renderManuelsFlux();
    var n2 = document.querySelectorAll('#manuels-liste tbody tr').length, d2 = document.querySelectorAll('#manuels-flux .manuel-flux').length;
    return { n1: n1, d1: d1, n2: n2, d2: d2 };
  });
  assert.equal(r.n1, 8); assert.equal(r.d1, 2);
  assert.equal(r.n2, 1); assert.equal(r.d2, 0);
});
