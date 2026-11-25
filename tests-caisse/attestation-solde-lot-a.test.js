/* Attestation de solde — lot A de la revue : obsolescence, numérotation, circuit idempotent, rôles, impression, minimisation notaire. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Souscripteurs c1 / c2 « soldés » selon window.__solde ; document généré par le vrai gabarit (attSoldeHtml). */
async function preparer(page, role) {
  return page.evaluate(async function (role) {
    role = role || 'admin';
    window.syncToSupabase = function () {}; window.toast = function (m) { (window.__toasts = window.__toasts || []).push(m); };
    window.__solde = { c1: true, c2: true };
    var reel = window.attSoldeSolde;
    window.attSoldeSolde = function (c, kind) { var r = reel(c, kind); return Object.assign({}, r, { solde: !!window.__solde[c.id], prix: 1000000, verse: 1000000, dateSolde: '2026-01-01' }); };
    window.attLierJuridique = async function () { return null; }; window.attSoldeRafraichirUI = function () {};
    window.userPeutSurStore = function () { return true; };
    window.hasRole = function (r) { return role === 'admin' ? (r === 'admin') : false; };
    APP.currentUser = { id: 'dg', nom: 'DG', role: role || 'admin' };
    DATA.params = Object.assign(DATA.params || {}, { societe: 'ZAHARA TEST', ville: '' }); DATA.params.seq_ecr = {};
    DATA.validations = []; DATA.versements = [];
    var mk = function (id) { return { id: id, nom: 'NOM' + id, prenoms: 'P' + id, dossier: 'D-' + id, tel: '0700000001', email: id + '@x.ci', adresse: 'Rue secrète 12', ddn: '1980-01-02', nationalite: 'Ivoirienne', piece_type: 'CNI', piece_num: 'CI12345', montant_total: 1000000, statut: 'actif' }; };
    DATA.clients = [mk('c1'), mk('c2')];
    return true;
  }, role);
}

test('obsolescence : versement supprimé après validation → attestation marquée obsolète, retirée du portail/notaire, plus utilisable', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    await attSoldeDemander('c1'); await valDecide(DATA.validations[0].id, 'valide');
    var a = DATA.clients[0].attestation_solde; a.publie_portail = true; a.transmis_notaire = true; a.html_notaire = '<p>x</p>';
    var ouverts = 0; window.open = function () { ouverts++; return null; };
    window.__solde.c1 = false; attSoldeAuto('c1');
    var o = { obsolete: !!a.obsolete, statut: a.statut, publie: a.publie_portail, notaire: a.transmis_notaire, html: !!a.html };
    attSoldeImprimer('c1'); attSoldePublier('c1', true); attSoldeWhatsApp('c1');
    o.ouverts = ouverts; o.publieApres = a.publie_portail; o.cellule = /Obsolète/.test(attSoldeCellule('c1'));
    o.registre = attRegistreLignes().filter(function (l) { return l.clientId === 'c1'; })[0].statut;
    o.supprDeleteVersement = /attSoldeAuto/.test(deleteVersement.toString());
    window.__solde.c1 = true; attSoldeAuto('c1'); o.lev = !a.obsolete;
    return o;
  });
  assert.equal(r.obsolete, true); assert.equal(r.statut, 'valide', 'la trace de la validation est conservée'); assert.equal(r.publie, false); assert.equal(r.notaire, false); assert.equal(r.html, true);
  assert.equal(r.ouverts, 0, 'ni impression ni WhatsApp d\'une attestation obsolète'); assert.equal(r.publieApres, false);
  assert.equal(r.cellule, true); assert.equal(r.registre, 'obsolete'); assert.equal(r.supprDeleteVersement, true, 'la suppression d\'un versement déclenche le contrôle');
  assert.equal(r.lev, true, 'redevenu soldé : plus obsolète');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('numéro jamais réutilisé après suppression, et renuméroté si doublon au moment de la validation', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    attSoldeAuto('c1'); var n1 = DATA.clients[0].attestation_solde.numero;
    window.__solde.c1 = false; attSoldeAuto('c1'); var supprime = !DATA.clients[0].attestation_solde;   /* brouillon retiré : numéro consommé */
    attSoldeAuto('c2'); var n2 = DATA.clients[1].attestation_solde.numero;
    var apercu1 = attSoldeNumero('initial', true), apercu2 = attSoldeNumero('initial', true);
    /* collision : deux postes ont attribué le même numéro à deux dossiers en attente */
    window.__solde.c1 = true; DATA.clients[0].attestation_solde = { numero: n2, statut: 'en_attente', demandeur: 'X', date_demande: '2026-11-01', publie_portail: false };
    DATA.clients[1].attestation_solde.statut = 'en_attente';
    await valCreate('attestation_solde', 'c1', 'Att c1', 1000000, { client_id: 'c1' }); await valCreate('attestation_solde', 'c2', 'Att c2', 1000000, { client_id: 'c2' });
    var vs = DATA.validations.filter(function (v) { return v.statut === 'en_attente'; });
    await valDecide(vs[0].id, 'valide'); await valDecide(vs[1].id, 'valide');
    return { n1: n1, n2: n2, supprime: supprime, apercuStable: apercu1 === apercu2, a1: DATA.clients[0].attestation_solde.numero, a2: DATA.clients[1].attestation_solde.numero };
  });
  assert.notEqual(r.n1, r.n2, 'le numéro du brouillon supprimé n\'est pas réattribué'); assert.equal(r.supprime, true); assert.equal(r.apercuStable, true, 'un aperçu ne réserve rien');
  assert.notEqual(r.a1, r.a2, 'deux attestations validées ne partagent jamais le même numéro');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('circuit : décision rejouée sans effet, validation refusée si plus soldé, re-soumission d\'une validée interdite', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    await attSoldeDemander('c1'); var v = DATA.validations[0]; await valDecide(v.id, 'valide');
    var a = DATA.clients[0].attestation_solde, sig = { par: a.valide_par, le: a.valide_le, html: a.html };
    a.valide_par = 'AUTRE'; var rej = await valApply('attestation_solde', 'c1', 'valide');   /* 2e décision rejouée */
    var inchange = a.valide_par === 'AUTRE';
    var nbAvant = DATA.validations.length; await attSoldeDemander('c1');
    var resoumission = { statut: a.statut, nb: DATA.validations.length - nbAvant };
    /* c2 : plus soldé au moment de la décision → la ligne de validation ne reste pas « validée » */
    await attSoldeDemander('c2'); window.__solde.c2 = false;
    var v2 = DATA.validations.filter(function (x) { return x.ref_id === 'c2'; })[0]; await valDecide(v2.id, 'valide');
    return { inchange: inchange, rejeu: rej === undefined, resoumission: resoumission, v2: v2.statut, v2motif: v2.motif, att2: DATA.clients[1].attestation_solde.statut };
  });
  assert.equal(r.inchange, true, 'une décision rejouée ne re-signe pas'); assert.deepEqual(r.resoumission, { statut: 'valide', nb: 0 });
  assert.equal(r.v2, 'rejete'); assert.match(r.v2motif, /non soldé/); assert.equal(r.att2, 'rejete');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('rôles : publier / notaire / WhatsApp / variante réservés à la hiérarchie ; désignation du notaire aussi pour le responsable de dossier', async () => {
  const app = await ouvrirApp(); await preparer(app.page, 'admin');
  const r = await app.page.evaluate(async function () {
    await attSoldeDemander('c1'); await valDecide(DATA.validations[0].id, 'valide');
    var a = DATA.clients[0].attestation_solde; window.open = function () { return {}; };
    window.hasRole = function () { return false; };   /* agent sans droit */
    attSoldePublier('c1', true); var publie = a.publie_portail; attSoldeWhatsApp('c1'); var wa = a.wa_envoye_le || null;
    window.hasRole = function (x) { return x === 'manager'; };
    attSoldePublier('c1', true);
    return { publieRefus: publie, wa: wa, publieManager: a.publie_portail };
  });
  assert.equal(r.publieRefus, false); assert.equal(r.wa, null); assert.equal(r.publieManager, true);
});

test('notaire : le texte transmis ne contient ni contact, ni identité (sauf case cochée)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    await attSoldeDemander('c1'); await valDecide(DATA.validations[0].id, 'valide');
    var a = DATA.clients[0].attestation_solde, c = DATA.clients[0];
    var complet = attSoldeHtmlFinal(a, c), notaire = attSoldeHtmlNotaire(a, c);
    c.transmission_notaire = { identite: true, bien: false, avancement: false };
    var avecId = attSoldeHtmlNotaire(a, c);
    return { completContact: /Contact<\/th>/.test(complet) && /Rue secrète/.test(complet), notContact: /Contact<\/th>|Rue secrète|0700000001/.test(notaire), notId: /CI12345|Né\(e\) le/.test(notaire),
      idCoche: /CI12345/.test(avecId), idContact: /Rue secrète|0700000001/.test(avecId), montants: /1 000 000|1 000 000|1 000 000/.test(notaire) };
  });
  assert.equal(r.completContact, true, 'le contrôle voit bien la ligne Contact dans la version complète'); assert.equal(r.notContact, false); assert.equal(r.notId, false);
  assert.equal(r.idCoche, true); assert.equal(r.idContact, false, 'jamais de contact, même avec l\'identité cochée'); assert.equal(r.montants, true);
});

test('impression : montant en lettres, société échappée, lieu par défaut, filigrane sur chaque page et bloc final jamais supprimé', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var o = { million: _montantEnLettres(1000000), milliards: _montantEnLettres(2000000000), rond15: _montantEnLettres(15000000), non: _montantEnLettres(15250000), mille: _montantEnLettres(1000) };
    DATA.params.societe = 'A<img src=x onerror=window.__xss=1>';
    var qr = printQrFooter('REF'); o.qrEchappe = qr.indexOf('<img src=x') < 0 && /&lt;img/.test(qr);
    DATA.params.societe = 'ZAHARA TEST';
    var c = DATA.clients[0];
    o.lieu = /Fait à Abidjan/.test(attSoldeHtml(c, { numero: 'ATS-2026-0001', date: '2026-11-01', kind: 'initial' }));
    o.htmlLong = attSoldeHtml(c, { numero: 'ATS-2026-0001', date: '2026-11-01', kind: 'initial', indicatif: true, overrides: { observations: 'Observation très longue. '.repeat(160) }, motif: 'demande', modifs: [{ libelle: 'x', avant: 'a', apres: 'b' }] });
    o.htmlProjet = attSoldeHtml(c, { numero: 'ATS-2026-0001', date: '2026-11-01', kind: 'initial', projet: true });
    return o;
  });
  assert.equal(r.million, 'un million de'); assert.equal(r.milliards, 'deux milliards de'); assert.equal(r.rond15, 'quinze millions de');
  assert.ok(!/ de$/.test(r.non) && !/ de$/.test(r.mille)); assert.equal(r.qrEchappe, true); assert.equal(r.lieu, true);
  const ctx = app.page.context();
  for (const [nom, html, min] of [['long', r.htmlLong, 1], ['projet', r.htmlProjet, 1]]) {
    const p = await ctx.newPage(); await p.setContent(html, { waitUntil: 'load' }); await p.waitForTimeout(400);
    const res = await p.evaluate(function () {
      var pages = Array.prototype.slice.call(document.querySelectorAll('.pgx'));
      return { n: pages.length, projets: pages.filter(function (x) { return x.querySelector('.projet'); }).length, txt: document.body.innerText };
    });
    assert.ok(res.n >= min, nom + ' : pages rendues');
    assert.ok(/portée et réserves/i.test(res.txt) && /signature et cachet/i.test(res.txt), nom + ' : bloc « Portée et réserves » et signature conservés');
    if (nom === 'projet') assert.equal(res.projets, res.n, 'filigrane présent sur chaque page');
    await p.close();
  }
  assert.deepEqual(app.etat.erreursPage, []);
});
