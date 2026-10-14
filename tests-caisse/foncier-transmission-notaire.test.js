/* Foncier Connect — dossier de transmission au notaire : sections cochées, pièces une à une, exclusions, retrait automatique. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    window.syncToSupabase = function () {}; window.toast = function (m) { (window.__toasts = window.__toasts || []).push(m); };
    window.attSoldeRafraichirUI = function () {}; window.attLierJuridique = async function () { return null; };
    window.userPeutSurStore = function () { return true; };
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1' }]; DATA.lots = [{ id: 'l1', parcelle_id: 'p1' }];
    DATA.clients = [{ id: 'c1', nom: 'BENDE', prenoms: 'Jean', lot_id: 'l1' }, { id: 'c2', nom: 'AUTRE', lot_id: 'l1' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf', role: 'foncier' }, { id: 'u2', nom: 'Autre agent', login: 'ag', role: 'foncier' }];
    var futur = new Date(Date.now() + 30 * 86400000).toISOString();
    DATA.intervenants_fonciers = [{ id: 'n1', type: 'notaire', nom_organisation: 'Étude Koffi', statut_relation: 'actif', email: 'n@x.ci', code_acces_hash: 'h', code_expiration: futur },
                                  { id: 'n2', type: 'notaire', nom_organisation: 'Étude Yao', statut_relation: 'actif' }];
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    window.hasRole = function () { return false; };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers'].forEach(function (s) { DATA[s] = []; });
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var mk = function (id, o) { var p = Object.assign({ id: id, dossier_id: d.id, etape_code: 'depot', nom: id + '.pdf', type: 'application/pdf', taille: 100, categorie: 'autre', confidentialite: 'normale', version: 1, chemin: d.id + '/' + id, depose_par: { role: 'promoteur' }, client_id: '', depose_le: new Date().toISOString(), retire: false }, o || {}); DATA.pieces_foncieres.push(p); return p; };
    mk('ok'); mk('restreinte', { confidentialite: 'restreinte' }); mk('retiree', { retire: true }); mk('sansfichier', { chemin: '' }); mk('autre_client', { client_id: 'c2' }); mk('mienne', { client_id: 'c1' });
    attNotaireChoisir('c1', 'n1');
    return d.id;
  });
}
const run = (page, fn, arg) => page.evaluate(fn, arg || null);

test('sections : rien n\'est transmis par défaut ; cocher / décocher, journalisé ; notaire obligatoire', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, () => {
    var o = {}; o.defaut = dnTransmission(DATA.clients[0]);
    o.sansNotaire = dnSection('c2', 'identite', true).ok;
    o.on = dnSection('c1', 'identite', true).ok && dnSection('c1', 'bien', true).ok; o.apres = dnTransmission(DATA.clients[0]);
    dnSection('c1', 'bien', false); o.bienOff = dnTransmission(DATA.clients[0]).bien;
    o.inconnue = dnSection('c1', 'montants', true).ok;
    o.journal = DATA.evenements_fonciers.filter(function (e) { return e.type === 'transmission_notaire'; }).map(function (e) { return e.description; });
    return o;
  });
  assert.deepEqual([r.defaut.identite, r.defaut.bien, r.defaut.avancement], [false, false, false]);
  assert.equal(r.sansNotaire, false); assert.equal(r.on, true); assert.deepEqual([r.apres.identite, r.apres.bien, r.apres.avancement], [true, true, false]); assert.equal(r.bienOff, false); assert.equal(r.inconnue, false);
  assert.equal(r.journal.length, 3); assert.match(r.journal[0], /Transmis au notaire Étude Koffi/); assert.match(r.journal[2], /Retiré/);
});

test('pièces : transmissibles = celles du dossier, non retirées, non restreintes, de ce souscripteur ; le fichier doit être dans le stockage', async () => {
  const app = await ouvrirApp(); const d = await preparer(app.page);
  const r = await run(app.page, async () => {
    var c = DATA.clients[0], o = {};
    o.liste = dnPiecesDuClient(c).map(function (p) { return p.id; }).sort();
    o.restreinte = await dnPiece('c1', 'restreinte', true); o.autre = await dnPiece('c1', 'autre_client', true); o.retiree = await dnPiece('c1', 'retiree', true); o.sansfichier = await dnPiece('c1', 'sansfichier', true);
    o.ok = await dnPiece('c1', 'ok', true); o.mienne = await dnPiece('c1', 'mienne', true);
    o.coches = DATA.pieces_foncieres.filter(function (p) { return (p.transmis_notaire_clients || []).indexOf('c1') !== -1; }).map(function (p) { return p.id; }).sort();
    o.retrait = (await dnPiece('c1', 'ok', false)).ok; o.apresRetrait = fcPiece('ok').transmis_notaire_clients;
    o.journal = DATA.evenements_fonciers.filter(function (e) { return e.type === 'transmission_notaire' && e.source_ref === 'ok'; }).length;
    return o;
  });
  assert.deepEqual(r.liste, ['mienne', 'ok', 'sansfichier']);
  assert.match(r.restreinte.erreur, /restreint/); assert.match(r.autre.erreur, /n'appartient pas/); assert.match(r.retiree.erreur, /n'appartient pas/); assert.match(r.sansfichier.erreur, /pas encore dans le stockage/);
  assert.equal(r.ok.ok, true); assert.equal(r.mienne.ok, true); assert.deepEqual(r.coches, ['mienne', 'ok']); assert.equal(r.retrait, true); assert.deepEqual(r.apresRetrait, []); assert.equal(r.journal, 2);
  assert.ok(d);
});

test('droits : un agent qui n\'est pas responsable du dossier ne transmet rien ; un administrateur le peut', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, async () => {
    var o = {}; APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' };
    o.section = dnSection('c1', 'identite', true); o.piece = await dnPiece('c1', 'ok', true);
    window.hasRole = function (x) { return x === 'admin'; }; o.admin = dnSection('c1', 'identite', true).ok;
    return o;
  });
  assert.equal(r.section.ok, false); assert.match(r.section.erreur, /responsables/); assert.equal(r.piece.ok, false); assert.equal(r.admin, true);
});

test('changer ou retirer le notaire retire toutes les transmissions (sections et pièces)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, async () => {
    var o = {}; dnSection('c1', 'identite', true); dnSection('c1', 'avancement', true); await dnPiece('c1', 'ok', true); await dnPiece('c1', 'mienne', true);
    attNotaireChoisir('c1', 'n2'); await new Promise(function (r) { setTimeout(r, 50); });
    o.apresChangement = { t: dnTransmission(DATA.clients[0]), pieces: DATA.pieces_foncieres.filter(function (p) { return (p.transmis_notaire_clients || []).length; }).length, notaire: DATA.clients[0].notaire_intervenant_id };
    dnSection('c1', 'bien', true); attNotaireChoisir('c1', ''); await new Promise(function (r) { setTimeout(r, 50); });
    o.apresRetrait = { t: dnTransmission(DATA.clients[0]), notaire: DATA.clients[0].notaire_intervenant_id };
    return o;
  });
  assert.deepEqual([r.apresChangement.t.identite, r.apresChangement.t.avancement], [false, false]); assert.equal(r.apresChangement.pieces, 0); assert.equal(r.apresChangement.notaire, 'n2');
  assert.deepEqual([r.apresRetrait.t.bien], [false]); assert.equal(r.apresRetrait.notaire, '');
});

test('panneau : affiché seulement avec un notaire désigné ; pièces exclues absentes ; avertissement si fichier pas envoyé', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, () => {
    var c = DATA.clients[0], o = {}; o.avec = dnPanneau(c);
    o.sans = dnPanneau(DATA.clients[1]);
    return o;
  });
  assert.match(r.avec, /Dossier de transmission au notaire/); assert.match(r.avec, /Étude Koffi/); assert.match(r.avec, /Identité du souscripteur/); assert.match(r.avec, /ok\.pdf/); assert.match(r.avec, /mienne\.pdf/);
  assert.doesNotMatch(r.avec, /restreinte\.pdf|retiree\.pdf|autre_client\.pdf/); assert.match(r.avec, /sansfichier\.pdf[\s\S]*pas encore envoyé au stockage/); assert.equal(r.sans, '');
  assert.deepEqual(app.etat.erreursPage, []);
});
