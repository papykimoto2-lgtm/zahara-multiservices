/* RLS phase A — les circuits de synchronisation portent le jeton du personnel.
   Vérifie : attente de la session, repli transitoire sur la clé anonyme, différé quand le repli est désactivé,
   jeton transmis au temps réel, absence de clé anonyme écrite en dur hors connexion du portail. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { ouvrirApp, fermerNavigateur, PAGE_ERP } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  await page.evaluate(function () {
    SB.url = 'https://exemple.supabase.co'; SB.key = 'CLE_ANON';
    STAFF = { token: null, expire: 0, user: null };
    window._staffLoginEnCours = false; window._staffLoginDepuis = 0;
    window.IMMO_SYNC_ANON_FALLBACK = true;
    window.__fetchAppels = [];
    window.fetch = function (u, o) { window.__fetchAppels.push({ url: String(u), auth: o && o.headers && o.headers.Authorization }); return Promise.reject(new Error('réseau coupé (test)')); };
  });
}

test('attendre : sans connexion en cours, pas d\'attente', async () => {
  const app = await ouvrirApp();
  await preparer(app.page);
  const t0 = Date.now();
  const r = await app.page.evaluate(function () { return attendreSessionStaff(5000); });
  assert.equal(r, false);
  assert.ok(Date.now() - t0 < 1500);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('attendre : la session arrive pendant l\'attente -> true', async () => {
  const app = await ouvrirApp();
  await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    window._staffLoginEnCours = true; window._staffLoginDepuis = Date.now();
    setTimeout(function () { STAFF = { token: 'JWT', expire: Date.now() + 3600000, user: null }; _staffSessionPrete(); }, 300);
    return attendreSessionStaff(5000);
  });
  assert.equal(r, true);
});

test('attendre : la connexion échoue sans jeton -> false, sans attendre le délai maximal', async () => {
  const app = await ouvrirApp();
  await preparer(app.page);
  const t0 = Date.now();
  const r = await app.page.evaluate(async function () {
    window._staffLoginEnCours = true; window._staffLoginDepuis = Date.now();
    setTimeout(function () { window._staffLoginEnCours = false; _staffLoginTermine(); }, 300);
    return attendreSessionStaff(20000);
  });
  assert.equal(r, false);
  assert.ok(Date.now() - t0 < 5000);
});

test('attendre : un indicateur de connexion périmé ne bloque pas', async () => {
  const app = await ouvrirApp();
  await preparer(app.page);
  const t0 = Date.now();
  const r = await app.page.evaluate(function () { window._staffLoginEnCours = true; window._staffLoginDepuis = Date.now() - 120000; return attendreSessionStaff(20000); });
  assert.equal(r, false);
  assert.ok(Date.now() - t0 < 1500);
});

test('transition : sans session, le repli sur la clé anonyme reste autorisé', async () => {
  const app = await ouvrirApp();
  await preparer(app.page);
  assert.equal(await app.page.evaluate(function () { return syncAutorise('test'); }), true);
});

test('après fermeture de l\'accès anonyme : sans session, envoi et pull sont différés, aucun appel réseau', async () => {
  const app = await ouvrirApp();
  await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    window.IMMO_SYNC_ANON_FALLBACK = false;
    var autorise = await syncAutorise('test');
    await flushSyncOutbox();
    await pullFromCloudSilent();
    return { autorise: autorise, appels: window.__fetchAppels.length };
  });
  assert.equal(r.autorise, false);
  assert.equal(r.appels, 0);
});

test('avec une session ouverte : syncAutorise accepte même sans repli', async () => {
  const app = await ouvrirApp();
  await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    window.IMMO_SYNC_ANON_FALLBACK = false;
    STAFF = { token: 'JWT', expire: Date.now() + 3600000, user: null };
    return syncAutorise('test');
  });
  assert.equal(r, true);
});

test('temps réel : le jeton du personnel est transmis, puis la clé anonyme après déconnexion', async () => {
  const app = await ouvrirApp();
  await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var vus = [];
    _RT.client = { realtime: { setAuth: function (t) { vus.push(t); } } };
    STAFF = { token: 'JWT', expire: Date.now() + 3600000, user: null };
    _rtAppliquerJeton();
    staffLogout();
    _RT.client = null;
    return vus;
  });
  assert.deepEqual(r, ['JWT', 'CLE_ANON']);
});

test('staffLogin : ouvre la session, libère les circuits en attente et met le temps réel à jour', async () => {
  const app = await ouvrirApp();
  await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var vus = [];
    _RT.client = { realtime: { setAuth: function (t) { vus.push(t); } } };
    window.fetch = function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ token: 'JWT_SERVEUR', expires_in: 28800, user: { id: 'u1' } }); } }); };
    window._staffLoginEnCours = true; window._staffLoginDepuis = Date.now();
    var attente = attendreSessionStaff(5000);
    await staffLogin('u', 'p');
    var libere = await attente;
    var res = { libere: libere, token: STAFF.token, rt: vus.slice() };
    _RT.client = null; staffLogout();
    return res;
  });
  assert.equal(r.libere, true);
  assert.equal(r.token, 'JWT_SERVEUR');
  assert.deepEqual(r.rt, ['JWT_SERVEUR']);
});

test('source : aucune clé anonyme écrite en dur comme jeton, sauf la connexion du portail', () => {
  const src = fs.readFileSync(PAGE_ERP, 'utf8');
  const occ = src.match(/'Authorization'\s*:\s*'Bearer '\s*\+\s*SB\.key/g) || [];
  assert.equal(occ.length, 1, 'une seule exception attendue (portal-login), trouvé : ' + occ.length);
  const i = src.search(/'Authorization'\s*:\s*'Bearer '\s*\+\s*SB\.key/);
  assert.ok(/portal-login/.test(src.slice(Math.max(0, i - 400), i)), 'l\'exception doit être l\'appel portal-login');
});
