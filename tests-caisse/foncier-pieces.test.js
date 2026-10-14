/* Foncier Connect — pièces jointes par étape, côté promoteur et côté souscripteur. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.programmes = [{ id: 'g1', nom: 'Résidence Les Palmiers' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville', programme_id: 'g1' }];
    DATA.lots = [{ id: 'l1', parcelle_id: 'p1' }];
    DATA.clients = [{ id: 'c1', nom: 'Aminata Koné', lot_id: 'l1', email: 'aminata@exemple.ci' }, { id: 'c2', nom: 'Jean Yao' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }, { id: 'u2', nom: 'Autre agent', login: 'ag' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers'].forEach(function (s) { DATA[s] = []; });
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    fcEtape(d, 'depot').visibilite = 'souscripteur';
    fcEtape(d, 'completude_documents').visibilite = 'interne';
    window.PDF = { nom: 'cni.pdf', type: 'application/pdf', taille: 2000, contenu: 'data:application/pdf;base64,' + btoa('%PDF-1.4 test') };
    return { d: d.id };
  });
}
const run = (page, fn, arg) => page.evaluate(fn, arg || null);

test('le promoteur joint une pièce interne : le souscripteur ne la voit pas', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const r = await run(app.page, (d) => fcAjouterPiece(d, 'depot', PDF, { visibilite: 'interne' }), d);
  assert.equal(r.ok, true);
  const v = await run(app.page, () => fcVueSouscripteur('c1').dossiers[0].documents.length);
  assert.equal(v, 0);
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.some(function (e) { return e.type === 'piece_jointe'; })), true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('visible du souscripteur seulement si l\'étape lui est publiée', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const refus = await run(app.page, (d) => fcAjouterPiece(d, 'completude_documents', PDF, { visibilite: 'souscripteur' }), d);
  assert.equal(refus.ok, false); assert.match(refus.erreur, /pas publiée/);
  assert.equal((await run(app.page, (d) => fcAjouterPiece(d, 'depot', PDF, { visibilite: 'souscripteur' }), d)).ok, true);
  const docs = await run(app.page, () => fcVueSouscripteur('c1').dossiers[0].documents.map(function (x) { return x.de + ':' + x.nom; }));
  assert.deepEqual(docs, ['promoteur:cni.pdf']);
  assert.equal(await run(app.page, () => fcVueSouscripteur('c2').dossiers.length), 0);
});

test('formats, taille et contenu incohérent sont refusés', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const essai = (f) => app.page.evaluate(function (a) { return fcAjouterPiece(a.d, 'depot', Object.assign({}, PDF, a.f), {}); }, { d: d, f: f });
  assert.match((await essai({ nom: 'virus.exe', type: 'application/x-msdownload' })).erreur, /Format non accepté/);
  assert.match((await essai({ contenu: 'data:image/png;base64,AAAA' })).erreur, /ne correspond pas/);
  assert.match((await essai({ taille: 6 * 1024 * 1024 })).erreur, /volumineux/);
  assert.equal(await run(app.page, () => DATA.pieces_foncieres.length), 0);
});

test('le souscripteur ne dépose que là où un dépôt est ouvert, pour ses propres dossiers', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const dep = (c) => app.page.evaluate(function (a) { return fcDeposerPieceSouscripteur(a.c, a.d, 'depot', PDF, 'ma CNI'); }, { c: c, d: d });
  assert.match((await dep('c1')).erreur, /Aucune pièce n'est demandée/);
  assert.match((await run(app.page, (d) => fcDemanderPiece(d, 'completude_documents', 'x'), d)).erreur, /pas publiée/);
  assert.equal((await run(app.page, (d) => fcDemanderPiece(d, 'depot', 'Copie de la CNI'), d)).ok, true);
  assert.match((await dep('c2')).erreur, /pas rattaché/);
  const ok = await dep('c1'); assert.equal(ok.ok, true); assert.equal(ok.piece.statut, 'a_verifier');
  const v = await run(app.page, () => fcVueSouscripteur('c1').dossiers[0]);
  assert.equal(v.documents[0].de, 'vous'); assert.equal(v.documents[0].statut, 'À vérifier'); assert.equal(v.pieces_demandees.length, 1);
  assert.equal(await run(app.page, () => fcVueSouscripteur('c2').dossiers.length), 0);
  assert.equal(await run(app.page, () => window.__sync), 0, 'jamais synchronisée');
});

test('refus : motif obligatoire, communiqué au souscripteur ; seul le responsable décide', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, (d) => fcDemanderPiece(d, 'depot', 'CNI'), d);
  const id = await run(app.page, (d) => fcDeposerPieceSouscripteur('c1', d, 'depot', PDF, '').then(function (r) { return r.piece.id; }), d);
  await run(app.page, () => { APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' }; });
  assert.match((await run(app.page, (id) => fcDecisionPiece(id, 'acceptee', ''), id)).erreur, /responsable/);
  await run(app.page, () => { APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' }; });
  assert.match((await run(app.page, (id) => fcDecisionPiece(id, 'refusee', ' '), id)).erreur, /motif/i);
  assert.equal((await run(app.page, (id) => fcDecisionPiece(id, 'refusee', 'Scan illisible'), id)).ok, true);
  const v = await run(app.page, () => fcVueSouscripteur('c1').dossiers[0].documents[0]);
  assert.equal(v.statut, 'Refusée'); assert.equal(v.motif_refus, 'Scan illisible');
  const n = await run(app.page, () => DATA.notifications_foncieres.filter(function (x) { return x.titre.indexOf('refusée') !== -1; }).length);
  assert.ok(n >= 1);
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.filter(function (e) { return e.type === 'piece_decision'; }).length), 1);
});

test('le promoteur est notifié d\'un dépôt ; le souscripteur d\'une demande', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, (d) => fcDemanderPiece(d, 'depot', 'CNI'), d);
  assert.ok(await run(app.page, () => DATA.notifications_foncieres.some(function (x) { return x.titre === 'Une pièce vous est demandée' && x.destinataire_id === 'c1'; })));
  await run(app.page, (d) => fcDeposerPieceSouscripteur('c1', d, 'depot', PDF, ''), d);
  assert.ok(await run(app.page, () => DATA.notifications_foncieres.some(function (x) { return x.titre === 'Pièce déposée par un souscripteur' && x.destinataire_id === 'u1'; })));
});

test('retrait : motif obligatoire, pièce masquée mais conservée', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const id = await run(app.page, (d) => fcAjouterPiece(d, 'depot', PDF, { visibilite: 'souscripteur' }).then(function (r) { return r.piece.id; }), d);
  assert.match((await run(app.page, (id) => fcRetirerPiece(id, ''), id)).erreur, /motif/i);
  assert.equal((await run(app.page, (id) => fcRetirerPiece(id, 'Mauvais document'), id)).ok, true);
  assert.equal(await run(app.page, () => fcVueSouscripteur('c1').dossiers[0].documents.length), 0);
  assert.equal(await run(app.page, () => DATA.pieces_foncieres.length), 1);
  assert.equal(await run(app.page, (d) => fcPiecesEtape(d, 'depot').length, d), 0);
});

test('un dossier clôturé n\'accepte plus de pièce ; un justificatif sourcé est créé si demandé', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const r = await run(app.page, (d) => fcAjouterPiece(d, 'depot', PDF, { source: 'administration_confirmee' }), d);
  assert.equal(r.ok, true);
  assert.equal(await run(app.page, (d) => fcEtape(fcDossier(d), 'depot').justificatifs.length, d), 1);
  await run(app.page, (d) => { fcDossier(d).statut = 'cloture'; }, d);
  assert.match((await run(app.page, (d) => fcAjouterPiece(d, 'depot', PDF, {}), d)).erreur, /aucune nouvelle pièce/);
});

test('store synchronisé (métadonnées) ; interface : panneau promoteur et aperçu souscripteur', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  assert.equal(await run(app.page, () => ALL_STORES.indexOf('pieces_foncieres') !== -1 && SANIX_STORES_LOCAL_UNIQUEMENT.indexOf('pieces_foncieres') === -1 && SUPA_STORE_MAP.some(function (x) { return x[0] === 'pi_pieces_foncieres' && x[1] === 'pieces_foncieres'; })), true);
  await run(app.page, (d) => fcDemanderPiece(d, 'depot', 'CNI'), d);
  const html = await run(app.page, (d) => { document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div><div id="fs-root"></div>'); APP._fcPiecesSel = { d: d, c: 'depot' }; return fcPanneauPieces(fcDossier(d)); }, d);
  assert.match(html, /Pièces jointes/); assert.match(html, /Dépôt ouvert au souscripteur/);
  await run(app.page, () => { APP._fsClient = 'c1'; fcRenderSouscripteurs(); });
  assert.match(await run(app.page, () => document.getElementById('fs-root').innerHTML), /Pièce demandée/);
  assert.deepEqual(app.etat.erreursPage, []);
});
