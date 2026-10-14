/* Foncier Connect — gestion documentaire (§11) et tableaux de bord (§12). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.programmes = [{ id: 'g1', nom: 'Résidence Les Palmiers' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville', programme_id: 'g1' }, { id: 'p2', ref: 'PARC-2', localisation: 'Bassam', programme_id: 'g1' }];
    DATA.lots = [{ id: 'l1', parcelle_id: 'p1' }];
    DATA.clients = [{ id: 'c1', nom: 'Aminata Koné', lot_id: 'l1', email: 'a@exemple.ci' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }, { id: 'u2', nom: 'Autre agent', login: 'ag' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(function (s) { DATA[s] = []; });
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    fcEtape(d, 'depot').visibilite = 'souscripteur';
    window.PDF = { nom: 'cni.pdf', type: 'application/pdf', taille: 2000, contenu: 'data:application/pdf;base64,' + btoa('%PDF-1.4 test') };
    window.PDF2 = { nom: 'cni-v2.pdf', type: 'application/pdf', taille: 2000, contenu: 'data:application/pdf;base64,' + btoa('%PDF-1.7 autre') };
    window.jour = function (n) { var x = new Date(fcAuj()); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    return { d: d.id };
  });
}
const run = (page, fn, arg) => page.evaluate(fn, arg === undefined ? null : arg);
const ajouter = (page, d, o) => page.evaluate(function (a) { return fcAjouterPiece(a.d, 'depot', PDF, a.o || {}); }, { d: d, o: o || null });

test('documents : catégorie, signature du fichier et empreinte SHA-256', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  assert.match((await ajouter(app.page, d, { categorie: 'inconnue' })).erreur, /Catégorie/);
  const faux = await run(app.page, (d) => fcAjouterPiece(d, 'depot', { nom: 'a.pdf', type: 'application/pdf', taille: 10, contenu: 'data:application/pdf;base64,' + btoa('GIF89a-pas-un-pdf') }, {}), d);
  assert.match(faux.erreur, /signature invalide/);
  const r = await ajouter(app.page, d, { categorie: 'identite' });
  assert.equal(r.ok, true);
  assert.equal(r.piece.empreinte, crypto.createHash('sha256').update('%PDF-1.4 test').digest('hex'));
  assert.equal(r.piece.version, 1); assert.equal(r.piece.categorie, 'identite'); assert.equal(r.piece.confidentialite, 'normale');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('documents : nouvelle version conservée, courante seule listée, réservée au responsable', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const id = (await ajouter(app.page, d, {})).piece.id;
  await run(app.page, () => { APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' }; });
  assert.match((await run(app.page, (id) => fcNouvelleVersion(id, PDF2, {}), id)).erreur, /responsable/);
  await run(app.page, () => { APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' }; });
  const v2 = await run(app.page, (id) => fcNouvelleVersion(id, PDF2, {}), id);
  assert.equal(v2.ok, true); assert.equal(v2.piece.version, 2);
  assert.match((await run(app.page, (id) => fcNouvelleVersion(id, PDF2, {}), id)).erreur, /plus la version courante/);
  assert.deepEqual(await run(app.page, () => fcRechercherDocuments({}).map(function (p) { return p.nom; })), ['cni-v2.pdf']);
  assert.equal(await run(app.page, () => fcRechercherDocuments({ toutes_versions: true }).length), 2);
  assert.equal(await run(app.page, (id) => fcVersionsDocument(id).length, id), 2);
  assert.equal(await run(app.page, (id) => fcPiece(id).contenu.length > 0, id), true, 'ancienne version conservée');
});

test('documents : un fichier modifié est détecté par l\'empreinte', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const id = (await ajouter(app.page, d, {})).piece.id;
  assert.equal((await run(app.page, (id) => fcVerifierIntegrite(id), id)).conforme, true);
  await run(app.page, (id) => { fcPiece(id).contenu = 'data:application/pdf;base64,' + btoa('%PDF-1.4 modifie'); }, id);
  assert.equal((await run(app.page, (id) => fcVerifierIntegrite(id), id)).conforme, false);
  assert.equal(await run(app.page, (id) => fcPiece(id).integrite, id), 'alteree');
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.some(function (e) { return e.type === 'piece_integrite'; })), true);
});

test('documents : confidentialité restreinte, accès contrôlé et journalisé', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  assert.match((await ajouter(app.page, d, { confidentialite: 'restreinte', visibilite: 'souscripteur' })).erreur, /restreinte/);
  const id = (await ajouter(app.page, d, { confidentialite: 'restreinte' })).piece.id;
  assert.equal((await run(app.page, (id) => fcAccederPiece(id, 'telechargement'), id)).ok, true);
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.filter(function (e) { return e.type === 'piece_telechargee'; }).length), 1);
  await run(app.page, () => { APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' }; });
  assert.match((await run(app.page, (id) => fcAccederPiece(id, 'consultation'), id)).erreur, /restreint/);
  assert.equal(await run(app.page, () => fcRechercherDocuments({}).length), 0);
  assert.ok(!(await run(app.page, () => fcRegistreCsv({}))).includes('cni.pdf'));
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.filter(function (e) { return e.type === 'piece_consultee'; }).length), 0, 'un accès refusé n\'est pas un accès');
});

test('documents : expiration, recherche, archivage logique et export', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  assert.match((await ajouter(app.page, d, { expire_le: '12/05/2027' })).erreur, /expiration invalide/);
  const a = (await run(app.page, (d) => fcAjouterPiece(d, 'depot', Object.assign({}, PDF, { nom: 'bail; "spécial".pdf' }), { expire_le: jour(-1), categorie: 'acte' }), d)).piece;
  const b = (await run(app.page, (d) => fcAjouterPiece(d, 'depot', Object.assign({}, PDF, { nom: 'plan.pdf' }), { expire_le: jour(10), categorie: 'plan_cadastral' }), d)).piece;
  assert.equal(await run(app.page, (id) => fcPieceExpiration(fcPiece(id)), a.id), 'expiree');
  assert.equal(await run(app.page, (id) => fcPieceExpiration(fcPiece(id)), b.id), 'bientot');
  assert.equal(await run(app.page, () => fcPiecesExpirantes(30).length), 2);
  assert.deepEqual(await run(app.page, () => fcRechercherDocuments({ q: 'plan' }).map(function (p) { return p.nom; })), ['plan.pdf']);
  assert.deepEqual(await run(app.page, () => fcRechercherDocuments({ q: 'DF-' }).length), 2, 'recherche par référence du dossier');
  assert.deepEqual(await run(app.page, () => fcRechercherDocuments({ categorie: 'acte' }).map(function (p) { return p.nom; })), ['bail; "spécial".pdf']);
  const csv = await run(app.page, () => fcRegistreCsv({}));
  assert.ok(csv.startsWith('﻿Document;')); assert.ok(csv.includes('"bail; ""spécial"".pdf"'));
  assert.match((await run(app.page, (id) => fcRetirerPiece(id, ''), a.id)).erreur, /motif/i);
  await run(app.page, (id) => fcRetirerPiece(id, 'Périmé'), a.id);
  assert.equal(await run(app.page, () => fcRechercherDocuments({}).length), 1);
  assert.equal(await run(app.page, () => fcRechercherDocuments({ archives: 'seules' }).length), 1);
  assert.equal((await run(app.page, (id) => fcRestaurerPiece(id), a.id)).ok, true);
  assert.equal(await run(app.page, () => fcRechercherDocuments({}).length), 2);
});

test('pilotage promoteur : missions en retard, documents à contrôler, souscripteurs à informer', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, (d) => { DATA.missions_foncieres.push({ id: 'm1', reference: 'M-1', dossier_id: d, intervenant_id: 'i1', titre: 'Bornage', statut: 'en_cours', echeance: jour(-3), livrables: [{ id: 'l', libelle: 'Plan', versions: [] }], responsable_validation_id: 'u1' }); }, d);
  await run(app.page, (d) => { DATA.pieces_foncieres.push({ id: 'x1', dossier_id: d, etape_code: 'depot', nom: 'a.pdf', statut: 'a_verifier', depose_le: new Date().toISOString(), depose_par: { role: 'souscripteur' } }); }, d);
  const p = await run(app.page, () => fcIndicateursPromoteur());
  assert.equal(p.missions_en_retard, 1); assert.equal(p.documents_a_controler, 1); assert.equal(p.souscripteurs_a_informer, 1); assert.equal(p.total, 1);
  await run(app.page, (d) => fcPublierInformation(d, 'depot', { libelle: 'Dossier déposé', source: 'promoteur' }), d);
  assert.equal(await run(app.page, () => fcIndicateursPromoteur().souscripteurs_a_informer), 0);
});

test('pilotage responsable : tâches du jour, retards, échéances, sans mise à jour, à valider', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, (d) => {
    var x = fcDossier(d); var e = x.etapes.filter(function (s) { return FC_STATUTS_FINAUX.indexOf(s.statut) === -1; });
    e[0].date_cible = jour(0); e[1].date_cible = jour(-2); e[2].date_cible = jour(5); e[3].date_cible = jour(20);
    DATA.evenements_fonciers.forEach(function (ev) { ev.date = jour(-30) + 'T10:00:00.000Z'; });
    DATA.demandes_fonciers.push({ id: 'dm', reference: 'DI-1', dossier_id: d, client_id: 'c1', date: jour(-1), sujet: 'Où en est mon dossier ?', statut: 'nouvelle', responsable_id: 'u1', messages: [] });
    DATA.missions_foncieres.push({ id: 'm2', reference: 'M-2', dossier_id: d, titre: 'Levé', statut: 'livrable_soumis', echeance: jour(3), livrables: [], responsable_validation_id: 'u1' });
  }, d);
  const r = await run(app.page, () => { var x = fcIndicateursResponsable('u1'); return { jour: x.jour.length, retard: x.retard.length, proch: x.prochaines.length, compl: x.complements.length, maj: x.sans_maj.length, val: x.a_valider.length }; });
  assert.deepEqual(r, { jour: 1, retard: 1, proch: 1, compl: 1, maj: 1, val: 1 });
  const autre = await run(app.page, () => { var x = fcIndicateursResponsable('u2'); return x.jour.length + x.retard.length + x.prochaines.length + x.complements.length + x.sans_maj.length + x.a_valider.length; });
  assert.equal(autre, 0, 'chacun ne voit que ses éléments');
});

test('pilotage direction : durées mesurées au journal, seuil de fiabilité, aucune imputation', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const res = await run(app.page, (d) => {
    var x = fcDossier(d), codes = x.etapes.slice(0, 4).map(function (e) { return e.code; });
    var ev = function (code, de, a, date, motif) { DATA.evenements_fonciers.push({ id: uid(), dossier_id: d, etape_code: code, type: 'changement_statut', ancien: de, nouveau: a, date: date + 'T08:00:00.000Z', motif: motif || '' }); };
    DATA.evenements_fonciers = [];
    [codes[0], codes[1]].forEach(function (c) { ev(c, 'a_preparer', 'en_cours', '2026-01-01'); ev(c, 'en_cours', 'attente_administration', '2026-01-11'); ev(c, 'attente_administration', 'en_cours', '2026-01-15'); ev(c, 'en_cours', 'termine', '2026-01-20'); fcEtape(x, c).statut = 'termine'; });
    ev(codes[2], 'a_preparer', 'termine', '2026-01-05'); fcEtape(x, codes[2]).statut = 'termine';
    ev(codes[3], 'en_cours', 'bloque', '2026-01-06', 'Litige foncier'); ev(codes[3], 'bloque', 'en_cours', '2026-01-08'); ev(codes[3], 'en_cours', 'bloque', '2026-02-06', 'Litige foncier');
    var deux = fcIndicateursDirection('2026-03-15');
    var c3 = x.etapes[4].code; ev(c3, 'a_preparer', 'en_cours', '2026-01-01'); ev(c3, 'en_cours', 'termine', '2026-01-03'); fcEtape(x, c3).statut = 'termine';
    var trois = fcIndicateursDirection('2026-03-15');
    return { deux: deux.duree_moyenne_etape_interne, trois: trois.duree_moyenne_etape_interne, non: deux.etapes_non_mesurees, blocages: deux.blocages_par_cause, mensuel: deux.mensuel.length };
  }, d);
  assert.equal(res.deux.moyenne, 15); assert.equal(res.deux.n, 2); assert.equal(res.deux.fiable, false);
  assert.equal(res.trois.n, 3); assert.equal(res.trois.fiable, true); assert.equal(res.trois.moyenne, 10.7);
  assert.equal(res.non, 1); assert.deepEqual(res.blocages, { 'Litige foncier': 2 }); assert.equal(res.mensuel, 12);
});

test('pilotage direction : respect des échéances, évolution mensuelle, délai d\'ouverture à clôture avec attentes distinguées', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const r = await run(app.page, (d) => {
    var x = fcDossier(d); x.date_ouverture = '2026-01-01'; x.date_cloture = '2026-03-01'; x.statut = 'cloture';
    var ev = function (code, de, a, date) { DATA.evenements_fonciers.push({ id: uid(), dossier_id: d, etape_code: code, type: 'changement_statut', ancien: de, nouveau: a, date: date + 'T08:00:00.000Z', motif: '' }); };
    DATA.evenements_fonciers = [];
    var c0 = x.etapes[0].code, c1 = x.etapes[1].code;
    ev(c0, 'a_preparer', 'en_cours', '2026-01-02'); ev(c0, 'en_cours', 'attente_administration', '2026-01-12'); ev(c0, 'attente_administration', 'termine', '2026-02-11');
    x.etapes[0].statut = 'termine'; x.etapes[0].date_cible = '2026-02-20';
    ev(c1, 'a_preparer', 'en_cours', '2026-02-12'); ev(c1, 'en_cours', 'termine', '2026-02-20'); x.etapes[1].statut = 'termine'; x.etapes[1].date_cible = '2026-02-15';
    var dir = fcIndicateursDirection('2026-03-15');
    return { rech: dir.respect_echeances, delai: dir.delai_ouverture_cloture, mois: dir.mensuel.filter(function (m) { return m.mois === '2026-01' || m.mois === '2026-03'; }) };
  }, d);
  assert.equal(r.rech.a_temps, 1); assert.equal(r.rech.en_retard, 1); assert.equal(r.rech.fiable, false);
  assert.equal(r.delai.total.moyenne, 59); assert.equal(r.delai.attentes_mesurees.moyenne, 30); assert.equal(r.delai.hors_attentes_mesurees.moyenne, 29);
  assert.equal(r.delai.total.fiable, false);
  assert.deepEqual(r.mois.map(function (m) { return [m.mois, m.ouverts, m.clotures, m.portefeuille]; }), [['2026-01', 1, 0, 1], ['2026-03', 0, 1, 0]]);
});

test('pilotage intervenants et exports : retards, historique, droits', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, (d) => {
    DATA.intervenants_fonciers.push({ id: 'i1', nom_organisation: 'Cabinet Géo', statut_relation: 'actif' });
    DATA.missions_foncieres.push({ id: 'm1', reference: 'M-1', dossier_id: d, intervenant_id: 'i1', titre: 'Bornage', statut: 'en_cours', echeance: jour(-3), acceptation: { le: 'x' }, livrables: [{ id: 'l', libelle: 'Plan', versions: [] }], responsable_validation_id: 'u1' });
    DATA.missions_foncieres.push({ id: 'm2', reference: 'M-2', dossier_id: d, intervenant_id: 'i1', titre: 'Levé', statut: 'validee', echeance: jour(-9), livrables: [], responsable_validation_id: 'u1' });
    fcEtape(fcDossier(d), 'depot').date_cible = jour(-4);
  }, d);
  const iv = await run(app.page, () => fcIndicateursIntervenants()[0]);
  assert.deepEqual([iv.attribuees, iv.acceptees, iv.livrables_attendus, iv.en_cours, iv.terminees, iv.depassees], [2, 2, 1, 1, 1, 1]);
  const retards = await run(app.page, () => fcLignesPilotage('retards', 'u1'));
  assert.equal(retards.length, 3, 'en-tête + étape + mission'); assert.ok(retards.some(function (l) { return /Mission M-1/.test(l[2]); }));
  assert.ok(retards.every(function (l, i) { return i === 0 || !/administration/i.test(l[6]) || /déclaré/.test(l[6]); }), 'aucune imputation sans donnée');
  const hist = await run(app.page, (d) => fcHistoriqueDossierLignes(d), d);
  assert.ok(hist.length >= 2); assert.equal(hist[0][0], 'Date');
  assert.equal(await run(app.page, () => { window.getAllRoles = function () { return { foncier: { permissions: { Foncier: false } } }; }; STORE_MODULE.dossiers_fonciers = 'Foncier'; return fcPeutExporter(); }), false);
});

test('interface : tableaux de bord et documents s\'affichent sans erreur ; direction réservée', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await ajouter(app.page, d, { categorie: 'acte', expire_le: await run(app.page, () => jour(5)) });
  const html = await run(app.page, () => { document.body.insertAdjacentHTML('beforeend', '<div id="fp-root"></div><div id="fd-root"></div>'); var out = {}; ['promoteur', 'responsable', 'intervenants'].forEach(function (v) { APP._fpVue = v; fcRenderPilotage(); out[v] = document.getElementById('fp-root').innerHTML; }); APP._fpVue = 'direction'; fcRenderPilotage(); out.refuse = APP._fpVue; APP.currentUser.role = 'admin'; APP._fpVue = 'direction'; fcRenderPilotage(); out.direction = document.getElementById('fp-root').innerHTML; fcRenderDocuments(); out.docs = document.getElementById('fd-root').innerHTML; return out; });
  assert.match(html.promoteur, /Souscripteurs à informer/); assert.match(html.responsable, /Tâches du jour/); assert.match(html.intervenants, /Aucun intervenant|Intervenant/);
  assert.equal(html.refuse, 'promoteur'); assert.ok(!/Direction<\/button>/.test(html.promoteur), 'onglet Direction masqué'); assert.match(html.direction, /Données insuffisantes|indicatif|Répartition par procédure/);
  assert.match(html.docs, /Gestion documentaire/); assert.match(html.docs, /cni\.pdf/); assert.match(html.docs, /SHA-256/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('export du tableau de direction : refusé hors direction, autorisé pour l\'administrateur', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const n = await run(app.page, () => { window.__dl = 0; window.fcTelechargerTexte = function () { window.__dl++; };
    window.getAllRoles = function () { return { agent: { permissions: { Foncier: true } }, admin: { permissions: {} } }; }; STORE_MODULE.dossiers_fonciers = 'Foncier'; APP.currentUser = { id: 'u2', nom: 'Agent', role: 'agent' }; fcExporterPilotageUI('direction', 'csv'); var refuse = window.__dl;
    APP.currentUser = { id: 'u1', nom: 'Admin', role: 'admin' }; fcExporterPilotageUI('direction', 'csv'); return [refuse, window.__dl]; });
  assert.deepEqual(n, [0, 1]);
});
