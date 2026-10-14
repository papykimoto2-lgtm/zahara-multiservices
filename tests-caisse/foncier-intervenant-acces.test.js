/* Foncier Connect — portail intervenants (P1) : accès au portail remis par le personnel.
   Code affiché une fois, stocké haché (SHA-256 + sel : exactement ce que portal-login vérifie), expiration, révocation, droits. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, role) {
  return page.evaluate(async function (role) {
    DATA.users = [{ id: 'u1', nom: 'Adm', login: 'adm' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Adm', role: role || 'admin' };
    DATA.intervenants_fonciers = [];
    window.confirm = function () { return true; };
    var a = await fcEnregistrerIntervenant({ nom_organisation: 'Cabinet Géo Plus', type: 'geometre', email: 'geo@plus.ci', telephone: '+225 07 68 65 37 63', contact_nom: 'M. Koffi' });
    var b = await fcEnregistrerIntervenant({ nom_organisation: 'Notaire Sans Contact', type: 'notaire', email: 'x@y.ci' });
    b.intervenant.email = ''; b.intervenant.telephone = '';
    var c = await fcEnregistrerIntervenant({ nom_organisation: 'Ancien Prestataire', type: 'autre', email: 'old@x.ci', statut_relation: 'archive' });
    return { a: a.intervenant.id, b: b.intervenant.id, c: c.intervenant.id };
  }, role);
}

test('génération : code de 8 caractères lisibles, stocké haché (SHA-256 + sel), jamais en clair', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    var g = await fcGenererAccesIntervenant(id), i = fcIntervenant(id);
    return { g: g, i: JSON.parse(JSON.stringify(i)), tout: JSON.stringify(DATA.intervenants_fonciers) };
  }, ids.a);
  assert.equal(r.g.ok, true);
  assert.match(r.g.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/, 'sans I, L, O, 0, 1');
  assert.equal(r.g.identifiant, 'geo@plus.ci');
  assert.equal(r.i.code_acces_hash, crypto.createHash('sha256').update(r.g.code + r.i.code_acces_salt).digest('hex'), 'même empreinte que portal-login');
  assert.equal(r.i.code_acces_salt.length, 64);
  assert.equal(r.tout.includes(r.g.code), false, 'le code en clair n\'est nulle part dans les données');
  assert.equal(r.i.code_acces, undefined); assert.equal(r.i.mot_de_passe, undefined);
  const jours = (new Date(r.i.code_expiration) - Date.now()) / 86400000;
  assert.ok(jours > 89 && jours <= 91, 'expire dans ~90 jours');
  assert.equal(r.i.acces_historique.length, 1);
  assert.equal(r.i.acces_historique[0].action, 'genere'); assert.equal(r.i.acces_historique[0].par, 'Adm');
  assert.equal(JSON.stringify(r.i.acces_historique).includes(r.g.code), false, 'l\'historique ne contient aucun secret');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('les codes sont aléatoires et sans biais apparent', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () { var s = {}, c = {}; for (var k = 0; k < 400; k++) { var x = fcCodeAcces(); s[x] = 1; x.split('').forEach(function (ch) { c[ch] = (c[ch] || 0) + 1; }); } return { uniques: Object.keys(s).length, car: Object.keys(c).length, max: Math.max.apply(null, Object.values(c)), min: Math.min.apply(null, Object.values(c)) }; });
  assert.equal(r.uniques, 400); assert.equal(r.car, 31);
  assert.ok(r.max / r.min < 2, 'répartition homogène des caractères');
});

test('régénération : l\'ancien code cesse de correspondre, l\'historique garde la trace', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    var g1 = await fcGenererAccesIntervenant(id), h1 = fcIntervenant(id).code_acces_hash;
    var g2 = await fcGenererAccesIntervenant(id), i = fcIntervenant(id);
    return { c1: g1.code, c2: g2.code, h1: h1, h2: i.code_acces_hash, salt: i.code_acces_salt, hist: i.acces_historique.map(function (x) { return x.action; }) };
  }, ids.a);
  assert.notEqual(r.c1, r.c2); assert.notEqual(r.h1, r.h2);
  assert.notEqual(crypto.createHash('sha256').update(r.c1 + r.salt).digest('hex'), r.h2, 'l\'ancien code ne passe plus');
  assert.deepEqual(r.hist, ['genere', 'regenere']);
});

test('refus : droits, intervenant archivé, aucun identifiant de connexion', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page, 'foncier');
  const r = await app.page.evaluate(async function (ids) {
    var sansDroit = await fcGenererAccesIntervenant(ids.a);
    APP.currentUser.role = 'admin';
    return { sansDroit: sansDroit, archive: await fcGenererAccesIntervenant(ids.c), sansId: await fcGenererAccesIntervenant(ids.b), inconnu: await fcGenererAccesIntervenant('nope'), rev: await fcRevoquerAccesIntervenant(ids.a), hash: !!fcIntervenant(ids.a).code_acces_hash };
  }, ids);
  assert.equal(r.sansDroit.ok, false); assert.match(r.sansDroit.erreur, /administrateur ou un manager/);
  assert.equal(r.archive.ok, false); assert.match(r.archive.erreur, /pas actif/);
  assert.equal(r.sansId.ok, false); assert.match(r.sansId.erreur, /e-mail ou un téléphone/);
  assert.equal(r.inconnu.ok, false);
  assert.equal(r.rev.ok, false); assert.match(r.rev.erreur, /pas d'accès/);
  assert.equal(r.hash, false, 'aucun accès créé par un refus');
});

test('révocation : le code disparaît, l\'historique le consigne, l\'accès peut être redonné', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    await fcGenererAccesIntervenant(id);
    var rev = await fcRevoquerAccesIntervenant(id), i = JSON.parse(JSON.stringify(fcIntervenant(id)));
    var etat = fcEtatAccesIntervenant(i).etat, nouveau = await fcGenererAccesIntervenant(id);
    return { rev: rev.ok, avant: i, etat: etat, nouveau: nouveau.ok, hist: fcIntervenant(id).acces_historique.map(function (x) { return x.action; }) };
  }, ids.a);
  assert.equal(r.rev, true);
  for (const k of ['code_acces_hash', 'code_acces_salt', 'code_acces_date', 'code_expiration']) assert.equal(r.avant[k], undefined, k);
  assert.equal(r.etat, 'aucun'); assert.equal(r.nouveau, true);
  assert.deepEqual(r.hist, ['genere', 'revoque', 'genere']);
});

test('état de l\'accès : aucun, actif, expiré, relation inactive', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (ids) {
    var i = fcIntervenant(ids.a), e = [];
    e.push(fcEtatAccesIntervenant(i).etat);
    await fcGenererAccesIntervenant(ids.a); e.push(fcEtatAccesIntervenant(i).etat);
    i.code_expiration = '2020-01-01T23:59:59Z'; e.push(fcEtatAccesIntervenant(i).etat);
    e.push(fcEtatAccesIntervenant(fcIntervenant(ids.c)).etat);
    return e;
  }, ids);
  assert.deepEqual(r, ['aucun', 'actif', 'expire', 'inactif']);
});

test('interface : le code n\'apparaît qu\'une fois, jamais après fermeture ni dans la liste', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (ids) {
    document.body.insertAdjacentHTML('beforeend', '<div id="fi-root"></div>');
    fcRenderIntervenants();
    var avant = document.getElementById('fi-root').innerHTML;
    await fcAccesIntervenantUI(ids.a);
    var code = APP._fiAcces.code, html = document.getElementById('fi-root').innerHTML;
    var apres = { carte: html.includes('à transmettre maintenant'), code: html.includes(code), wa: /wa\.me\/2250768653763|wa\.me\/225/.test(html), mail: html.includes('mailto:geo@plus.ci'), badge: html.includes('Actif jusqu') };
    fcFermerAcces();
    var ferme = document.getElementById('fi-root').innerHTML;
    return { avantBadge: avant.includes('Générer l\'accès'), apres: apres, fermeCode: ferme.includes(code), fermeCarte: ferme.includes('à transmettre maintenant'), fermeBadge: ferme.includes('Actif jusqu'), memoire: APP._fiAcces };
  }, ids);
  assert.equal(r.avantBadge, true);
  assert.deepEqual(r.apres, { carte: true, code: true, wa: true, mail: true, badge: true });
  assert.equal(r.fermeCode, false); assert.equal(r.fermeCarte, false); assert.equal(r.fermeBadge, true); assert.equal(r.memoire, null);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('interface : sans droit, aucun bouton de génération n\'est proposé', async () => {
  const app = await ouvrirApp(); await preparer(app.page, 'foncier');
  const r = await app.page.evaluate(function () { document.body.insertAdjacentHTML('beforeend', '<div id="fi-root"></div>'); fcRenderIntervenants(); var h = document.getElementById('fi-root').innerHTML; return { gen: h.includes('Générer l\'accès'), badge: h.includes('Aucun') }; });
  assert.deepEqual(r, { gen: false, badge: true });
});
