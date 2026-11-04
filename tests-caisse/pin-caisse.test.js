const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Revue du module caisse, point 2 : le code PIN (4 chiffres, SHA-256 simple, aucune limite d'essais) est durci :
   4 à 6 chiffres sans suite ni répétition, PBKDF2 avec migration transparente, blocage croissant après 3 échecs. */
test('politique : 4 à 6 chiffres ; suites, chiffres identiques et non-chiffres refusés', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      const ko = ['123', '1234567', '1111', '0000', '1234', '4321', '98765', '12345', 'abcd', '48 27', ''].map(function (p) { return [p, _caissePinValide(p)]; });
      const ok = ['4827', '2580', '482715', '135790', '7351'].map(function (p) { return [p, _caissePinValide(p)]; });
      return { ko: ko, ok: ok };
    });
    r.ko.forEach(function (x) { assert.ok(x[1], 'doit être refusé : « ' + x[0] + ' »'); });
    r.ok.forEach(function (x) { assert.equal(x[1], '', 'doit être accepté : ' + x[0]); });
  } finally { await app.fermer(); }
});

test('hachage PBKDF2 : le bon PIN est reconnu, un mauvais refusé ; aucun PIN en clair', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const u = { id: 'u7' };
      await _caissePinHasher(u, '4827');
      return { algo: u.caisse_pin_algo, iter: u.caisse_pin_iter, hash: u.caisse_pin_hash, ok: await _caissePinVerifier(u, '4827'), ko: await _caissePinVerifier(u, '4828'), json: JSON.stringify(u) };
    });
    assert.equal(r.algo, 'pbkdf2'); assert.equal(r.iter, 210000); assert.equal(r.hash.length, 64);
    assert.equal(r.ok, true); assert.equal(r.ko, false); assert.ok(r.json.indexOf('4827') < 0);
  } finally { await app.fermer(); }
});

test('migration transparente : un ancien PIN SHA-256 est reconnu puis re-haché en PBKDF2 ; un mauvais PIN ne migre pas', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const u = { id: 'u8', caisse_pin_salt: 'selancien' };
      u.caisse_pin_hash = await hashPassword('4827', u.caisse_pin_salt);
      const ancienHash = u.caisse_pin_hash;
      const mauvais = await _caissePinVerifier(u, '0001'); const apresMauvais = { algo: u.caisse_pin_algo || null, hash: u.caisse_pin_hash };
      const bon = await _caissePinVerifier(u, '4827'); const apresBon = { algo: u.caisse_pin_algo, hashChange: u.caisse_pin_hash !== ancienHash };
      const encore = await _caissePinVerifier(u, '4827');
      return { mauvais: mauvais, apresMauvais: apresMauvais, bon: bon, apresBon: apresBon, encore: encore, ancienHash: ancienHash };
    });
    assert.equal(r.mauvais, false); assert.equal(r.apresMauvais.algo, null); assert.equal(r.apresMauvais.hash, r.ancienHash);
    assert.equal(r.bon, true); assert.equal(r.apresBon.algo, 'pbkdf2'); assert.equal(r.apresBon.hashChange, true);
    assert.equal(r.encore, true);
  } finally { await app.fermer(); }
});

test('limitation d\'essais : 2 échecs libres, blocage dès le 3e (30 s) puis délai doublé ; un succès remet à zéro', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      const u = { id: 'u9' }, e = [];
      for (let i = 0; i < 5; i++) e.push(_caissePinEchec(u));
      const attente = _caissePinAttente(u);
      _caissePinSucces(u);
      return { e: e, attente: attente, apres: _caissePinAttente(u) };
    });
    assert.deepEqual(r.e.map(function (x) { return x.restants; }), [2, 1, 0, 0, 0]);
    assert.deepEqual(r.e.map(function (x) { return x.attente; }), [0, 0, 30, 60, 120]);
    assert.ok(r.attente > 100 && r.attente <= 120); assert.equal(r.apres, 0);
  } finally { await app.fermer(); }
});

test('déverrouillage : 3 mauvais codes bloquent, même le bon code est refusé pendant le blocage, puis il passe', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      await _caissePinHasher(APP.currentUser, '4827');
      CAISSE_UI.verrouille = true;
      const saisir = async function (pin) { document.getElementById('cv-pin').value = pin; await caisseDeverrouiller(); return document.getElementById('cv-err').textContent; };
      const msgs = [await saisir('1357'), await saisir('2468'), await saisir('9753')];
      const bloque = await saisir('4827');
      const verrouilleEncore = CAISSE_UI.verrouille;
      _caissePinSucces(APP.currentUser);                       /* fin du délai (simulée) */
      const bon = await saisir('4827');
      return { msgs: msgs, bloque: bloque, verrouilleEncore: verrouilleEncore, bon: bon, verrouilleApres: CAISSE_UI.verrouille };
    });
    assert.match(r.msgs[0], /2 essai/); assert.match(r.msgs[1], /1 essai/); assert.match(r.msgs[2], /Trop d'essais/);
    assert.match(r.bloque, /Trop d'essais/); assert.equal(r.verrouilleEncore, true);
    assert.equal(r.verrouilleApres, false);
  } finally { await app.fermer(); }
});

test('ouverture de caisse : mauvais PIN refusé et compté, blocage au 3e échec, aucune session créée', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      await _caissePinHasher(APP.currentUser, '4827');
      DATA.caisse_sessions = [];
      const set = function (id, v) { document.getElementById(id).value = v; };
      const essayer = async function (pin) { set('co-caisse-id', 'c1'); set('co-fond', '0'); set('co-pin', pin); window.__toasts = []; await caisseOuvrir(); return window.__toasts.join(' | '); };
      window.__toasts = []; const t = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); };
      const msgs = [await essayer('1357'), await essayer('2468'), await essayer('9753'), await essayer('4827')];
      window.toast = t;
      return { msgs: msgs, sessions: DATA.caisse_sessions.length };
    });
    assert.match(r.msgs[0], /incorrect/); assert.match(r.msgs[2], /Trop d'essais/); assert.match(r.msgs[3], /Trop d'essais/);
    assert.equal(r.sessions, 0);
  } finally { await app.fermer(); }
});
