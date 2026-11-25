/* Message groupé aux souscripteurs selon statut et niveau de paiement. */
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
    var mk = function (id, nom, tel, total, statut) { return { id: id, nom: nom, prenoms: 'P' + id, dossier: 'D' + id, tel: tel, montant_total: total, statut: statut || 'actif', date_souscription: '2020-01-01' }; };
    DATA.clients = [mk('a', 'Un', '07 00 00 00 01', 1000000), mk('b', 'Deux', '27 21 00 00 00', 1000000), mk('c', 'Trois', '05 00 00 00 03', 1000000), mk('d', 'Quatre', '07 00 00 00 04', 1000000, 'resilie')];
    DATA.versements = [
      { id: 'v1', client_id: 'a', montant: 900000, statut: 'valide' },
      { id: 'v2', client_id: 'b', montant: 100000, statut: 'valide' },
      { id: 'v3', client_id: 'c', montant: 1000000, statut: 'valide' }];
    for (const c of DATA.clients) await dbPut('clients', c);
    Object.assign(CSMSG, { statut: '', niveau: '', prog: '', comm: '', canal: '', rech: '', exclus: {}, modele: 'auto', texte: '', objet: '', file: [], pos: 0, faits: 0, passes: 0 });
  });
}

test('filtre par niveau de paiement et statut ; résiliés exclus', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var ids = function () { return csmsgSelection().map(function (x) { return x.c.id; }).sort().join(','); };
    var o = { tous: ids() };
    CSMSG.niveau = '80-99'; o.n80 = ids();
    CSMSG.niveau = '100'; o.solde = ids();
    CSMSG.niveau = ''; CSMSG.statut = 'solde'; o.statSolde = ids();
    CSMSG.statut = 'sortie'; o.sortie = ids();
    CSMSG.statut = ''; CSMSG.niveau = '0-25'; o.n0 = ids();
    CSMSG.niveau = ''; o.cibles = csmsgCibles().map(function (x) { return x.c.id; }).sort().join(',');
    return o;
  });
  assert.equal(r.tous, 'a,b,c'); assert.equal(r.n80, 'a'); assert.equal(r.solde, 'c'); assert.equal(r.statSolde, 'c');
  assert.equal(r.sortie, 'd'); assert.equal(r.n0, 'b'); assert.equal(r.cibles, 'a,c', 'b : fixe sans e-mail, injoignable');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('message automatique par statut et message libre avec variables', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var xa = csuiviCalculer().find(function (x) { return x.c.id === 'a'; });
    var auto = csmsgTexte(xa);
    CSMSG.modele = 'libre'; CSMSG.texte = 'Bonjour {prenom}, versé {pourcent}, reste {reste}. {inconnu}';
    return { auto: auto, libre: csmsgTexte(xa), code: xa.code };
  });
  assert.equal(r.code, 'bientot_solde'); assert.match(r.auto, /Pa,/); assert.match(r.auto, /solder/);
  assert.match(r.libre, /^Bonjour Pa, versé 90 %, reste /); assert.match(r.libre, /\{inconnu\}/, 'variable inconnue laissée visible (envoi bloqué)');
});

test('interface, file un par un et trace dans le journal du souscripteur', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    document.body.insertAdjacentHTML('beforeend', '<div id="csuivi-contenu"></div><button id="csuivi-tab-messages"></button>');
    csuiviSetTab('messages');
    var html = document.getElementById('csuivi-contenu').innerHTML;
    csmsgDemarrer(); await new Promise(function (res) { setTimeout(res, 600); });
    var fileHtml = document.getElementById('csuivi-contenu').innerHTML;
    var c0 = csmsgCourant().c.id;
    await csmsgTrace(c0, 'whatsapp');
    csmsgPasser(true); csmsgPasser(false);
    var fin = document.getElementById('csuivi-contenu').innerHTML;
    var cl = DATA.clients.find(function (c) { return c.id === c0; });
    return { sel: /destinataire\(s\) retenu/.test(html), file: /Ouvrir WhatsApp/.test(fileHtml), fin: /Terminé/.test(fin),
      log: (cl.actions_commerciales || []).map(function (a) { return a.canal; }), faits: CSMSG.faits, passes: CSMSG.passes };
  });
  assert.equal(r.sel, true); assert.equal(r.file, true); assert.equal(r.fin, true);
  assert.deepEqual(r.log, ['whatsapp']); assert.equal(r.faits, 1); assert.equal(r.passes, 1);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('accès au portail joints à tous les messages, y compris aux souscripteurs en retard', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    document.body.insertAdjacentHTML('beforeend', '<div id="csuivi-contenu"></div>');
    var att = function () { return new Promise(function (res) { setTimeout(res, 600); }); };
    /* a : à jour sans accès ; c : soldé avec accès existant */
    var c = DATA.clients.find(function (x) { return x.id === 'c'; }); c.code_acces_hash = 'h'; c.code_acces_salt = 's';
    DATA.versements = DATA.versements.filter(function (v) { return v.client_id !== 'a'; });
    DATA.clients.push({ id: 'r', nom: 'Retard', prenoms: 'Rita', dossier: 'DR', tel: '07 00 00 00 09', montant_total: 1000000, statut: 'actif', date_souscription: '2020-01-01' });
    var calc = csuiviCalculer(); var xr = calc.find(function (x) { return x.c.id === 'r'; }), xc = calc.find(function (x) { return x.c.id === 'c'; });
    xr.code = 'retard'; xr.retard = { moisRetard: 4, montantDu: 250000 };   /* souscripteur en retard */
    var apercu = csmsgTexte(xr);
    var o = { codeRetard: xr.code, apercuAcces: /Votre Espace Souscripteur/.test(apercu), apercuPlaceholder: /créé automatiquement/.test(apercu),
      existant: /déjà été remis/.test(csmsgTexte(xc)), avantSignature: apercu.indexOf('Espace Souscripteur') < apercu.indexOf('Cordialement') };
    Object.assign(CSMSG, { statut: '', niveau: '', rech: 'Retard', exclus: {}, modele: 'auto', file: [], pos: 0, acces: true, regen: false, code: '', codeId: '' });
    csmsgDemarrer(); await att();
    var cur = csmsgCourant(), reel = csmsgTexte(cur), code = CSMSG.code;
    o.codeCree = /^\d{6}$/.test(code); o.dansMessage = reel.indexOf('Code d’accès : ' + code) >= 0; o.hache = !!cur.c.code_acces_hash && JSON.stringify(DATA.clients).indexOf(code) < 0;
    await csmsgTrace(cur.c.id, 'email'); o.envoye = csuiviAccesEtat(cur.c);
    CSMSG.acces = false; o.sans = /Espace Souscripteur/.test(csmsgTexte(cur));
    CSMSG.acces = true; CSMSG.modele = 'libre'; CSMSG.texte = 'Bonjour {prenom}\n{acces}\nMerci'; o.libreVar = /Identifiant : DR/.test(csmsgTexte(cur, '123456'));
    return o;
  });
  assert.equal(r.codeRetard, 'retard'); assert.equal(r.apercuAcces, true); assert.equal(r.apercuPlaceholder, true);
  assert.equal(r.existant, true); assert.equal(r.avantSignature, true);
  assert.equal(r.codeCree, true); assert.equal(r.dansMessage, true); assert.equal(r.hache, true); assert.equal(r.envoye, 'envoye');
  assert.equal(r.sans, false); assert.equal(r.libreVar, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('actions commerciales : le message d\'un souscripteur en retard contient ses accès au portail', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    document.body.insertAdjacentHTML('beforeend', '<div id="csuivi-contenu"></div>');
    var cible = null;
    window.open = function () { return { location: { set href(v) { cible = v; } } }; };
    DATA.clients.find(function (c) { return c.id === 'a'; }).email = 'a@x.ci';
    var x = csuiviCalculer().find(function (y) { return y.c.id === 'a'; });
    var h = csuiviHtmlTable([x]);
    /* mailto : on intercepte la construction du lien via csuiviInsererBloc + portailBlocAcces */
    x.code = 'retard'; x.retard = { moisRetard: 4, montantDu: 250000 };
    var code = '';
    var r = await csuiviCreerAcces('souscripteur', x.c); code = r.code;
    var msg = csuiviInsererBloc(csuiviMessage(x), portailBlocAcces(x.c, '🔑 Code d’accès : ' + code));
    return { boutons: /csuiviEnvoiLigne\('a','email'\)/.test(h) && /csuiviEnvoiLigne\('a','whatsapp'\)/.test(h), ancien: /mailto:/.test(h),
      retard: /retard/i.test(csuiviMessage(x)), acces: msg.indexOf('Code d’accès : ' + code) >= 0 && /Identifiant : Da/.test(msg), avantSignature: msg.indexOf('Espace Souscripteur') < msg.indexOf('Cordialement') };
  });
  assert.equal(r.boutons, true); assert.equal(r.ancien, false, 'plus de lien mailto figé sans accès');
  assert.equal(r.retard, true); assert.equal(r.acces, true); assert.equal(r.avantSignature, true);
  assert.deepEqual(app.etat.erreursPage, []);
});
