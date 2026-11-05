const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { ouvrirApp, fermerNavigateur, PAGE_ERP } = require('./harness');
after(fermerNavigateur);

/* Documents joints : la synchronisation courante ne transporte que la liste (sans contenu) ; le contenu est récupéré à la demande,
   sur les postes administrateur et manager uniquement. */
async function preparerRpc(page, reponse) {
  await page.evaluate(function (rep) {
    window.getSBConfig = function () {}; SB.url = 'https://test.supabase.co'; SB.key = 'k';
    window.__rpcCorps = []; window.__requetes = [];
    window.fetch = async function (url, opt) {
      window.__requetes.push(String(url));
      if (/rpc\/pull_incremental/.test(url)) { window.__rpcCorps.push(JSON.parse(opt.body)); return new Response(JSON.stringify(rep), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  }, reponse);
}
const ligne = (id, extra) => ({ id: id, updated_at: '2026-11-02T10:00:00Z', data: Object.assign({ id: id, name: id + '.pdf', type: 'application/pdf', size: 3, entity_type: 'client', entity_id: 'c1', upload_date: '2026-11-01', _modifie: '2026-11-02T10:00:00Z', _sans_contenu: true }, extra || {}) });

test('poste du personnel : la synchronisation demande la liste des documents sans contenu et la range sans fichier', async () => {
  const app = await ouvrirApp();
  try {
    await preparerRpc(app.page, { pi_documents: [ligne('d1')] });
    const r = await app.page.evaluate(async function () {
      await _pullBatchViaRPC();
      const d = (await dbGetAll('documents')).find(function (x) { return x.id === 'd1'; });
      return { mode: window.__rpcCorps[0].cursors._docs_legers, d: d && { sans: d._sans_contenu === true, blob: !!d.blob } };
    });
    assert.equal(r.mode, 'oui');
    assert.deepEqual(r.d, { sans: true, blob: false });
  } finally { await app.fermer(); }
});

test('session de portail externe (aucun utilisateur du personnel) : synchronisation complète conservée', async () => {
  const app = await ouvrirApp();
  try {
    await preparerRpc(app.page, {});
    const mode = await app.page.evaluate(async function () { APP.currentUser = null; await _pullBatchViaRPC(); return window.__rpcCorps[0].cursors._docs_legers; });
    assert.equal(mode, 'non');
  } finally { await app.fermer(); }
});

test('un document déjà complet sur le poste garde son contenu quand la liste est mise à jour', async () => {
  const app = await ouvrirApp();
  try {
    await preparerRpc(app.page, { pi_documents: [ligne('d2', { description: 'nouvelle description' })] });
    const r = await app.page.evaluate(async function () {
      await dbPut('documents', { id: 'd2', name: 'd2.pdf', type: 'application/pdf', size: 3, blob: 'data:application/pdf;base64,QUJD', entity_type: 'client', entity_id: 'c1', _modifie: '2026-11-01T00:00:00Z' });
      await _pullBatchViaRPC();
      const d = (await dbGetAll('documents')).find(function (x) { return x.id === 'd2'; });
      return { blob: d.blob, desc: d.description, sans: d._sans_contenu };
    });
    assert.equal(r.blob, 'data:application/pdf;base64,QUJD');
    assert.equal(r.desc, 'nouvelle description');
    assert.equal(!!r.sans, false);
  } finally { await app.fermer(); }
});

test('administrateur / manager : le contenu est récupéré à la demande, puis gardé sur le poste', async () => {
  const app = await ouvrirApp();
  try {
    await preparerRpc(app.page, { pi_documents: [ligne('d3')] });
    const r = await app.page.evaluate(async function () {
      await _pullBatchViaRPC();
      window.__sb = [];
      window.sbFetch = async function (chemin) { window.__sb.push(chemin); return [{ data: { id: 'd3', name: 'd3.pdf', type: 'application/pdf', size: 3, blob: 'data:application/pdf;base64,QUJD', entity_type: 'client', entity_id: 'c1', _modifie: '2026-11-02T10:00:00Z' } }]; };
      const doc = await docChargerContenu('d3');
      const stocke = (await dbGetAll('documents')).find(function (x) { return x.id === 'd3'; });
      const encore = await docChargerContenu('d3');
      return { blob: doc && doc.blob, stocke: !!(stocke && stocke.blob && !stocke._sans_contenu), encore: !!(encore && encore.blob), appels: window.__sb.length, chemin: window.__sb[0] };
    });
    assert.equal(r.blob, 'data:application/pdf;base64,QUJD');
    assert.equal(r.stocke, true);
    assert.equal(r.appels, 1, 'la seconde ouverture ne retélécharge pas');
    assert.match(r.chemin, /^pi_documents\?id=eq\.d3/);
    assert.equal(r.encore, true);
  } finally { await app.fermer(); }
});

test('autre rôle : le contenu n\'est pas récupéré (message), la liste reste visible', async () => {
  const app = await ouvrirApp();
  try {
    await preparerRpc(app.page, { pi_documents: [ligne('d4')] });
    const r = await app.page.evaluate(async function () {
      await _pullBatchViaRPC();
      window.hasRole = function () { return false; };
      window.__requetes = [];
      const doc = await docChargerContenu('d4');
      return { doc, req: window.__requetes.filter(function (u) { return /pi_documents\?id=eq/.test(u); }).length, msg: window.__toasts.join(' | ') };
    });
    assert.equal(r.doc, null);
    assert.equal(r.req, 0);
    assert.match(r.msg, /réservé aux postes administrateur et manager/);
  } finally { await app.fermer(); }
});

test('le téléchargement d\'un document de la liste passe par la récupération à la demande', async () => {
  const app = await ouvrirApp();
  try {
    await preparerRpc(app.page, { pi_documents: [ligne('d5')] });
    const r = await app.page.evaluate(async function () {
      await _pullBatchViaRPC();
      window.sbFetch = async function () { return [{ data: { id: 'd5', name: 'd5.pdf', type: 'application/pdf', blob: 'data:application/pdf;base64,QUJD' } }]; };
      const liens = [];
      HTMLAnchorElement.prototype.click = function () { liens.push(this.href); };
      await telechargerDocument('d5');
      return liens;
    });
    assert.deepEqual(r, ['data:application/pdf;base64,QUJD']);
  } finally { await app.fermer(); }
});

test('garde-fou : un document sans contenu n\'est jamais renvoyé au cloud', async () => {
  const html = fs.readFileSync(PAGE_ERP, 'utf8');
  const i = html.indexOf('async function syncToSupabase(table, obj, opts) {');
  assert.ok(i > 0);
  assert.match(html.slice(i, i + 400), /table === 'pi_documents' && obj && obj\._sans_contenu\) return true/);
});

test('fiche de document vidée dans le cloud : non appliquée, et ce poste renvoie le vrai document pour réparer le cloud', async () => {
  const app = await ouvrirApp();
  try {
    await preparerRpc(app.page, { pi_documents: [{ id: 'v1', updated_at: '2026-11-04T10:00:00Z', data: { id: 'v1', _modifie: '2026-11-04T10:00:00Z', updated_at: '2026-11-04T10:00:00Z', _baseModifie: '2026-11-04T10:00:00Z' } },
      { id: 'v2', updated_at: '2026-11-04T10:00:00Z', data: { id: 'v2', _modifie: '2026-11-04T10:00:00Z' } }] });
    const r = await app.page.evaluate(async function () {
      await dbPut('documents', { id: 'v1', name: 'vrai.pdf', type: 'application/pdf', size: 3, blob: 'data:application/pdf;base64,QUJD', entity_type: 'client', entity_id: 'c1', _modifie: '2026-10-26T16:06:11Z' });
      window.__envoyes = [];
      window.syncToSupabase = async function (t, o) { window.__envoyes.push(t + ':' + o.id + ':' + (o.name || '')); return true; };
      await _pullBatchViaRPC();
      const v1 = (await dbGetAll('documents')).find(function (x) { return x.id === 'v1'; });
      const v2 = (await dbGetAll('documents')).find(function (x) { return x.id === 'v2'; });
      return { v1: v1 && v1.name, v1blob: !!(v1 && v1.blob), v2: !!v2, envoyes: window.__envoyes };
    });
    assert.equal(r.v1, 'vrai.pdf');
    assert.equal(r.v1blob, true);
    assert.equal(r.v2, false, 'fiche vide sans copie locale : ignorée');
    assert.deepEqual(r.envoyes, ['pi_documents:v1:vrai.pdf']);
  } finally { await app.fermer(); }
});

test('garde-fou : une fiche de document vide n\'est jamais envoyée', async () => {
  const html = fs.readFileSync(PAGE_ERP, 'utf8');
  const i = html.indexOf('async function syncToSupabase(table, obj, opts) {');
  assert.match(html.slice(i, i + 1200), /table === 'pi_documents' && obj && !obj\.name && !obj\.entity_type && !obj\.titre\)/);
});

/* Plantage « Aïe aïe aïe » à l'ouverture d'une fiche : toute la table des documents (fichiers compris) était chargée en mémoire. */
const gros = (id, type, ent) => ({ id: id, entity_type: type, entity_id: ent, name: id + '.pdf', type: 'application/pdf', size: 3, blob: 'data:application/pdf;base64,' + 'A'.repeat(200000), upload_date: '2026-11-01', visible_portail: true });

test('index IndexedDB sur les documents (entity_id, entity_type) créé à l\'ouverture de la base', async () => {
  const app = await ouvrirApp();
  try {
    const noms = await app.page.evaluate(function () { return Array.from(db.transaction('documents', 'readonly').objectStore('documents').indexNames).sort(); });
    assert.deepEqual(noms, ['entity_id', 'entity_type']);
  } finally { await app.fermer(); }
});

test('documents d\'une fiche : seuls ses fichiers sont lus, en copie légère, sans jamais charger toute la table', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      const gros = eval('(' + f + ')');
      for (const d of [gros('a1', 'client', 'c1'), gros('a2', 'client', 'c1'), gros('b1', 'client', 'c2'), gros('p1', 'programme', 'c1')]) await dbPut('documents', d);
      const reel = window.dbGetAll; window.__lectures = [];
      window.dbGetAll = function (s) { window.__lectures.push(s); return reel(s); };
      const legers = await docsDeEntite('client', 'c1');
      const pleins = await docsDeEntite('client', 'c1', true);
      const el = document.getElementById('client-doc-list');
      await refreshDocumentsForEntity('client', 'c1');
      const html = el.innerHTML;
      const ged = await gedCollecter();
      window.dbGetAll = reel;
      return { ids: legers.map(function (d) { return d.id; }).sort(), blobLeger: legers.some(function (d) { return d.blob || d.data; }), aContenu: legers.every(function (d) { return d._a_contenu === true; }),
        blobPlein: pleins.every(function (d) { return !!d.blob; }), lecturesDocuments: window.__lectures.filter(function (s) { return s === 'documents'; }).length, liste: /a1\.pdf/.test(html) && /a2\.pdf/.test(html) && !/b1\.pdf/.test(html), ged: ged.length };
    }, gros.toString());
    assert.deepEqual(r.ids, ['a1', 'a2']);
    assert.equal(r.blobLeger, false);
    assert.equal(r.aContenu, true);
    assert.equal(r.blobPlein, true);
    assert.equal(r.lecturesDocuments, 0, 'aucune lecture de toute la table');
    assert.equal(r.liste, true);
    assert.ok(r.ged >= 4);
  } finally { await app.fermer(); }
});

test('liste Souscripteurs : le nombre de fichiers par souscripteur est compté par les index, sans lire les fichiers', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      const gros = eval('(' + f + ')');
      for (const d of [gros('a1', 'client', 'c1'), gros('a2', 'client', 'c1'), gros('b1', 'client', 'c2'), gros('p1', 'programme', 'c1')]) await dbPut('documents', d);
      _docsClientInvalider();
      await new Promise(function (ok) { docsClientIndexer(ok); });
      return Object.assign({}, _docsClientIdx);
    }, gros.toString());
    assert.deepEqual(r, { c1: 2, c2: 1 });
  } finally { await app.fermer(); }
});
