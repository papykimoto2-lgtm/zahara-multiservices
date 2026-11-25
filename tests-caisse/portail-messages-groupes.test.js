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
    csmsgDemarrer();
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
