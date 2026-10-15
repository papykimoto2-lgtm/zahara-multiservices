/* Connexion : l'application s'ouvre sans attendre staff-login ni un cloud lent. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, cloudLent) {
  await page.evaluate(function (cloudLent) {
    window.syncToSupabase = function () {}; window.dbPut = async function () { return true; }; window.toast = function () {};
    SB.url = 'https://x.supabase.co'; SB.key = 'k';
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: function () { return true; } });
    window.__LOGIN_CLOUD_TIMEOUT_MS = 300;
    window.fetchUserFromCloud = function () { return cloudLent ? new Promise(function () {}) : Promise.resolve(null); };
    window.__staffFini = false;
    window.staffLogin = function () { return new Promise(function (res) { setTimeout(function () { window.__staffFini = true; res(null); }, 1500); }); };
    window.demarrerSyncAuto = function () {}; window.startInactivityTimer = function () {}; window.pullFromCloudSilent = function () {};
    window.goTo = function () { window.__goTo = true; };
    DATA.users = [{ id: 'u1', login: 'KESSIE', password: 'secret123', nom: 'Kessie', role: 'admin', statut: 'actif' }];
    document.getElementById('login-user').value = 'KESSIE'; document.getElementById('login-pass').value = 'secret123';
    document.getElementById('app').style.display = 'none'; document.getElementById('login-screen').style.display = '';
    localStorage.removeItem('pici_login_attempts');
  }, cloudLent);
}
const lancer = (page) => page.evaluate(async function () {
  var t0 = Date.now(); var p = doLogin();
  while (document.getElementById('app').style.display !== 'flex' && Date.now() - t0 < 4000) await new Promise(function (r) { setTimeout(r, 25); });
  var out = { ouvertApres: Date.now() - t0, staffFini: window.__staffFini, goTo: !!window.__goTo };
  await p.catch(function () {}); return out;
});

test('l\'application s\'ouvre avant la fin de staff-login (Edge Function lente)', async () => {
  const app = await ouvrirApp(); await preparer(app.page, false);
  const r = await lancer(app.page);
  assert.ok(r.ouvertApres < 1000, 'ouverture en ' + r.ouvertApres + ' ms');
  assert.equal(r.staffFini, false, 'staff-login encore en cours à l\'ouverture'); assert.equal(r.goTo, true);
  await app.page.waitForFunction(function () { return window.__staffFini === true; }, null, { timeout: 5000 });
  assert.deepEqual(app.etat.erreursPage, []);
});

test('cloud qui ne répond pas : la connexion aboutit après le plafond, avec le compte local', async () => {
  const app = await ouvrirApp(); await preparer(app.page, true);
  const r = await lancer(app.page);
  assert.ok(r.ouvertApres >= 250 && r.ouvertApres < 2000, 'ouverture en ' + r.ouvertApres + ' ms');
  assert.deepEqual(app.etat.erreursPage, []);
});
