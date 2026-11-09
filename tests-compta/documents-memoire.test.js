const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { ouvrirApp, fermerNavigateur, PAGE_ERP } = require('./harness');
after(fermerNavigateur);

/* Plantage « Aïe aïe aïe » : au démarrage, loadAllData() relisait TOUS les fichiers joints (store 'documents') en mémoire. */
const gros = (id, ent) => ({ id: id, entity_type: 'client', entity_id: ent, name: id + '.pdf', type: 'application/pdf', size: 3,
  blob: 'data:application/pdf;base64,' + 'A'.repeat(200000), upload_date: '2026-11-01' });

test('démarrage : loadAllData ne charge jamais les fichiers joints en mémoire (ils restent dans IndexedDB)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      const gros = eval('(' + f + ')');
      for (const d of [gros('a1', 'c1'), gros('a2', 'c2')]) await dbPut('documents', d);
      const reel = window.dbGetAll; window.__lectures = [];
      window.dbGetAll = function (s) { window.__lectures.push(s); return reel(s); };
      await loadAllData();
      window.dbGetAll = reel;
      return { lectures: window.__lectures.filter(function (s) { return s === 'documents'; }).length, enMemoire: (DATA.documents || []).length,
               stockes: (await reel('documents')).length, autres: window.__lectures.length };
    }, gros.toString());
    assert.equal(r.lectures, 0, 'aucune lecture de toute la table documents au démarrage');
    assert.equal(r.enMemoire, 0);
    assert.equal(r.stockes, 2, 'les fichiers restent dans IndexedDB');
    assert.ok(r.autres > 10, 'les autres stores sont bien chargés');
  } finally { await app.fermer(); }
});

test('GED : ouvrir un document le lit par sa clé, sans charger toute la table', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      const gros = eval('(' + f + ')');
      for (const d of [gros('a1', 'c1'), gros('a2', 'c2'), gros('a3', 'c3')]) await dbPut('documents', d);
      const reel = window.dbGetAll; window.__lectures = [];
      window.dbGetAll = function (s) { window.__lectures.push(s); return reel(s); };
      const rec = await _gedGetRecord('documents', 'a2');
      window.dbGetAll = reel;
      return { id: rec && rec.id, blob: !!(rec && rec.blob), lectures: window.__lectures.filter(function (s) { return s === 'documents'; }).length };
    }, gros.toString());
    assert.deepEqual(r, { id: 'a2', blob: true, lectures: 0 });
  } finally { await app.fermer(); }
});

test('liste des documents d\'une fiche : nom et description de fichier échappés (pas d\'injection HTML)', async () => {
  const app = await ouvrirApp();
  try {
    const html = await app.page.evaluate(async function () {
      await dbPut('documents', { id: 'x1', entity_type: 'client', entity_id: 'c9', name: '<img src=x onerror=alert(1)>.pdf', description: '<b>gras</b>', type: 'application/pdf', size: 3, blob: 'data:application/pdf;base64,QUJD', upload_date: '2026-11-01' });
      let el = document.getElementById('client-doc-list');
      if (!el) { el = document.createElement('div'); el.id = 'client-doc-list'; document.body.appendChild(el); }
      await refreshDocumentsForEntity('client', 'c9');
      return el.innerHTML;
    });
    assert.ok(html.indexOf('<img') === -1 && html.indexOf('<b>gras') === -1, 'aucune balise injectée');
    assert.match(html, /&lt;img/);
  } finally { await app.fermer(); }
});

test('service worker : seules les réponses 200 sont mises en cache (jamais un 206), put() est retourné', async () => {
  const sw = fs.readFileSync(PAGE_ERP.replace(/[^/\\]+$/, 'sw.js'), 'utf8');
  assert.equal((sw.match(/res\.status === 200/g) || []).length, 2);
  assert.equal((sw.match(/return c\.put\(req, copie\)/g) || []).length, 2);
  assert.equal(/res && res\.ok\)/.test(sw), false);
});
