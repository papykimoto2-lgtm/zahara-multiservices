/* Envoi groupé d'accès au portail unique : souscripteurs et intervenants, selon un filtre. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.users = [{ id: 'u1', nom: 'Adm', login: 'adm' }];
    window.userPeutSurStore = function () { return true; };
    window.confirm = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Adm', role: 'admin' };
    DATA.programmes = [{ id: 'p1', nom: 'Prog A' }, { id: 'p2', nom: 'Prog B' }];
    DATA.clients = [
      { id: 'c1', nom: 'Kone', prenoms: 'Awa', dossier: 'D1', tel: '+225 07 00 00 00 01', programme_id: 'p1', statut: 'actif' },
      { id: 'c2', nom: 'Traore', prenoms: 'Ali', dossier: 'D2', email: 'ali@x.ci', programme_id: 'p2', statut: 'actif' },
      { id: 'c3', nom: 'Sans', prenoms: 'Contact', dossier: 'D3', programme_id: 'p1', statut: 'actif' },
      { id: 'c4', nom: 'Deja', prenoms: 'Code', dossier: 'D4', tel: '+225 07 00 00 00 04', programme_id: 'p1', statut: 'actif', code_acces_hash: 'h', code_acces_salt: 's' },
      { id: 'c5', nom: 'Resilie', prenoms: 'X', dossier: 'D5', tel: '+225 07 00 00 00 05', programme_id: 'p1', statut: 'resilie' }
    ];
    for (const c of DATA.clients) await dbPut('clients', c);
    DATA.intervenants_fonciers = [];
    await fcEnregistrerIntervenant({ nom_organisation: 'Geo Plus', type: 'geometre', email: 'geo@plus.ci', telephone: '+225 07 68 65 37 63' });
    await fcEnregistrerIntervenant({ nom_organisation: 'Notaire Z', type: 'notaire', email: 'n@z.ci' });
    CSUIVI.cible = 'souscripteur'; CSUIVI.facces = 'aucun'; CSUIVI.exclus = {};
    CSUIVI.fprog = CSUIVI.fcomm = CSUIVI.fstat = CSUIVI.ftype = CSUIVI.frech = '';
  });
}

test('filtre souscripteurs : accès à remettre, actifs, joignables, par programme', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var ids = function () { return csuiviCibles().map(function (x) { return x.id; }).sort().join(','); };
    var o = { aucun: ids() };
    CSUIVI.fprog = 'p1'; o.p1 = ids();
    CSUIVI.fprog = ''; CSUIVI.facces = 'tous'; o.tous = ids();
    CSUIVI.facces = 'code'; o.code = ids();
    return o;
  });
  assert.equal(r.aucun, 'c1,c2', 'c3 sans contact, c4 a déjà un code, c5 résilié');
  assert.equal(r.p1, 'c1');
  assert.equal(r.tous, 'c1,c2,c4');
  assert.equal(r.code, 'c4');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('cases décochées exclues ; interface rendue sans erreur', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    CSUIVI.tab = 'portail';
    document.getElementById('csuivi-contenu') || document.body.insertAdjacentHTML('beforeend', '<div id="csuivi-contenu"></div>');
    csuiviRender(); csuiviBasculer('c1');
    return { ids: csuiviCibles().map(function (x) { return x.id; }).join(','), html: document.getElementById('csuivi-sel').innerHTML };
  });
  assert.equal(r.ids, 'c2');
  assert.match(r.html, /1<\/b> destinataire/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('envoi assisté souscripteurs : code créé haché, file parcourue', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    document.body.insertAdjacentHTML('beforeend', '<div id="csuivi-contenu"></div>');
    csuiviDemarrerEnvoi(); await new Promise(function (res) { setTimeout(res, 300); });
    var c = csuiviCourant(), code = CSUIVI.code, msg = csuiviMessageCourant('souscripteur', c, code, '');
    var o = { file: CSUIVI.file.slice(), hash: !!c.code_acces_hash, clair: JSON.stringify(DATA.clients).indexOf(code) >= 0, msg: msg.indexOf(code) >= 0 };
    await csuiviMarquerEnvoye('souscripteur', c.id, 'whatsapp');
    o.envoye = csuiviAccesEtat(c);
    return o;
  });
  assert.deepEqual(r.file, ['c1', 'c2']);
  assert.equal(r.hash, true); assert.equal(r.clair, false); assert.equal(r.msg, true);
  assert.equal(r.envoye, 'envoye');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('intervenants : filtre par type/état, code 8 car., accès marqué envoyé avec historique', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    document.body.insertAdjacentHTML('beforeend', '<div id="csuivi-contenu"></div>');
    csuiviChoisirCible('intervenant');
    var tous = csuiviCibles().length; CSUIVI.ftype = 'notaire'; var notaire = csuiviCibles().length; CSUIVI.ftype = '';
    csuiviDemarrerEnvoi(); await new Promise(function (res) { setTimeout(res, 300); });
    var i = csuiviCourant(), code = CSUIVI.code;
    await csuiviMarquerEnvoye('intervenant', i.id, 'email');
    var j = fcIntervenant(i.id);
    return { tous: tous, notaire: notaire, cible: CSUIVI.fileCible, code: code, hist: j.acces_historique.map(function (h) { return h.action; }), clair: JSON.stringify(j).indexOf(code) >= 0,
      apres: (CSUIVI.facces = 'aucun', csuiviCibles().length) };
  });
  assert.equal(r.tous, 2); assert.equal(r.notaire, 1); assert.equal(r.cible, 'intervenant');
  assert.match(r.code, /^[A-Z2-9]{8}$/);
  assert.deepEqual(r.hist, ['genere', 'envoye']); assert.equal(r.clair, false);
  assert.equal(r.apres, 1, 'l\'intervenant qui a un accès sort du filtre « à remettre »');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('rôle sans droit : intervenants refusés', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    APP.currentUser = { id: 'u2', nom: 'Com', role: 'commercial' };
    return { s: csuiviPeut('souscripteur'), i: csuiviPeut('intervenant') };
  });
  assert.equal(r.s, true); assert.equal(r.i, false);
});

test('identification des numéros WhatsApp (règle CRM-SANIX) et filtre canal', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var a = function (x) { var w = waNumero(x); return w.kind + ':' + w.num; };
    var o = { mob: a('07 07 90 49 19'), plus: a('+225 05 12 34 56 78'), fixe: a('27 21 00 00 00'), vide: a(''), mal: a('12345'),
      multi: a('27 21 00 00 00 / 07 08 09 10 11'), ancien: a('07 90 49 19'), etr: a('+221 77 123 45 67') };
    DATA.clients.push({ id: 'c6', nom: 'Fixe', prenoms: 'Seul', dossier: 'D6', tel: '27 21 00 00 00', statut: 'actif' });
    CSUIVI.fcanal = 'wa'; o.wa = csuiviSelection().map(function (x) { return x.id; }).sort().join(',');
    CSUIVI.fcanal = 'sanswa'; o.sans = csuiviSelection().map(function (x) { return x.id; }).sort().join(',');
    CSUIVI.fcanal = ''; o.cibles = csuiviCibles().map(function (x) { return x.id; }).sort().join(',');
    return o;
  });
  assert.equal(r.mob, 'mobile:2250707904919'); assert.equal(r.plus, 'mobile:2250512345678');
  assert.equal(r.fixe, 'fixe:'); assert.equal(r.vide, 'vide:'); assert.equal(r.mal, 'invalide:');
  assert.equal(r.multi, 'mobile:2250708091011', 'premier mobile retenu'); assert.equal(r.ancien, 'mobile:2250707904919');
  assert.equal(r.etr, 'international:221771234567');
  assert.equal(r.wa, 'c1'); assert.equal(r.sans, 'c2,c3,c6');
  assert.equal(r.cibles, 'c1,c2', 'un fixe sans e-mail est injoignable');
  assert.deepEqual(app.etat.erreursPage, []);
});
