/* Foncier Connect — phase 3 : information du souscripteur (cahier §9, RM-05, RM-07, RM-08). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.programmes = [{ id: 'g1', nom: 'Résidence Les Palmiers' }, { id: 'g2', nom: 'Lotissement Autre' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville', programme_id: 'g1' }, { id: 'p2', ref: 'PARC-2', localisation: 'Bassam', programme_id: 'g2' }];
    DATA.lots = [{ id: 'l1', parcelle_id: 'p1' }, { id: 'l2', parcelle_id: 'p2' }];
    DATA.clients = [{ id: 'c1', nom: 'Aminata Koné', lot_id: 'l1' }, { id: 'c2', nom: 'Jean Yao', lot_id: 'l2' }, { id: 'c3', nom: 'Sans lot' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }, { id: 'u2', nom: 'Autre agent', login: 'ag' }];
    DATA.params = Object.assign(DATA.params || {}, { societe: 'Menko Immo', tel: '+225 01 02 03 04 05' });
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    DATA.dossiers_fonciers = []; DATA.evenements_fonciers = []; DATA.publications_foncieres = []; DATA.demandes_fonciers = [];
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
    var d1 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var d2 = (await fcOuvrirDossier({ parcelle_id: 'p2', type: 'acd', responsable_id: 'u1' })).dossier;
    return { d1: d1.id, d2: d2.id };
  });
}
const pub = (page, d, code, p) => page.evaluate(function (a) { return fcPublierInformation(a.d, a.code, Object.assign({ libelle: 'Dossier déposé', source: 'promoteur' }, a.p || {})); }, { d: d, code: code, p: p || null });

test('publication : réservée au responsable du dossier', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await app.page.evaluate(function () { APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' }; });
  const r = await pub(app.page, ids.d1, 'depot');
  assert.equal(r.ok, false); assert.match(r.erreur, /responsable du dossier/);
});

test('publication : une étape interne n\'est pas publiable (RM-05)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await pub(app.page, ids.d1, 'completude_documents');
  assert.equal(r.ok, false); assert.match(r.erreur, /pas publiable/);
});

test('publication : titre et source obligatoires ; décision officielle seulement avec document contrôlé (RM-08)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  assert.match((await pub(app.page, ids.d1, 'depot', { libelle: '' })).erreur, /titre public/);
  assert.match((await pub(app.page, ids.d1, 'depot', { source: '' })).erreur, /source/);
  assert.match((await pub(app.page, ids.d1, 'reponse', { source: 'administration_confirmee', libelle: 'Réponse reçue' })).erreur, /document officiel/);
  await app.page.evaluate(function (d) { return fcAjouterJustificatif(d, 'reponse', { reference: 'Décision n°1', source: 'administration_confirmee' }); }, ids.d1);
  assert.equal((await pub(app.page, ids.d1, 'reponse', { source: 'administration_confirmee', libelle: 'Réponse reçue' })).ok, true);
});

test('jamais d\'approbation sans issue établie par un document officiel (RM-07)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const refus = [];
  for (const t of ['Votre titre est établi', 'ACD obtenu', 'Demande approuvée', 'Réponse favorable de l\'administration', 'Titre délivré'])
    refus.push((await pub(app.page, ids.d1, 'reponse', { libelle: t })).ok);
  assert.deepEqual(refus, [false, false, false, false, false]);
  assert.equal((await pub(app.page, ids.d1, 'depot', { libelle: 'Dossier déposé', description: 'En cours d\'instruction' })).ok, true);
  await app.page.evaluate(async function (d) {
    await fcAjouterJustificatif(d, 'reponse', { reference: 'Décision n°1', source: 'administration_confirmee' });
    await fcDefinirIssue(d, 'reponse', 'favorable');
  }, ids.d1);
  assert.equal((await pub(app.page, ids.d1, 'reponse', { libelle: 'Réponse favorable reçue', source: 'administration_confirmee' })).ok, true);
});

test('non publié = invisible ; publié = visible avec sa source ; retiré = invisible, motif obligatoire', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const avant = await app.page.evaluate(function () { return fcVueSouscripteur('c1').dossiers[0].historique.length; });
  const p = (await pub(app.page, ids.d1, 'depot', { source: 'administration_declaree', source_ref: 'Récépissé n°45' })).publication;
  const apres = await app.page.evaluate(function () { return fcVueSouscripteur('c1').dossiers[0].historique; });
  const sansMotif = await app.page.evaluate(function (id) { return fcRetirerPublication(id, ''); }, p.id);
  const retrait = await app.page.evaluate(async function (id) { var r = await fcRetirerPublication(id, 'erreur de saisie'); return { r: r, h: fcVueSouscripteur('c1').dossiers[0].historique.length, ev: DATA.evenements_fonciers.filter(function (e) { return e.type === 'publication_retiree'; }).length, doubleRetrait: await fcRetirerPublication(id, 'x') }; }, p.id);
  assert.equal(avant, 0); assert.equal(apres.length, 1); assert.equal(apres[0].titre, 'Dossier déposé');
  assert.match(apres[0].source, /non confirmée/); assert.equal(apres[0].reference_source, 'Récépissé n°45');
  assert.equal(sansMotif.ok, false); assert.equal(retrait.r.ok, true); assert.equal(retrait.h, 0); assert.equal(retrait.ev, 1); assert.equal(retrait.doubleRetrait.ok, false);
});

test('isolation : un souscripteur ne voit que son dossier (RM-05)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await pub(app.page, ids.d1, 'depot', { libelle: 'Dépôt du dossier Palmiers' });
  await pub(app.page, ids.d2, 'depot', { libelle: 'Dépôt du dossier Autre' });
  const r = await app.page.evaluate(function () { return { c1: fcVueSouscripteur('c1'), c2: fcVueSouscripteur('c2'), c3: fcVueSouscripteur('c3'), inconnu: fcVueSouscripteur('zzz') }; });
  assert.equal(r.c1.dossiers.length, 1); assert.equal(r.c1.dossiers[0].programme, 'Résidence Les Palmiers');
  assert.equal(JSON.stringify(r.c1).indexOf('Dépôt du dossier Autre'), -1); assert.equal(JSON.stringify(r.c2).indexOf('Dépôt du dossier Palmiers'), -1);
  assert.equal(r.c3.dossiers.length, 0); assert.equal(r.inconnu.dossiers.length, 0);
});

test('fuite : aucune donnée interne dans ce que voit le souscripteur', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (a) {
    var d = fcDossier(a.d1); d.observations = 'NOTE INTERNE CONFIDENTIELLE';
    var e = fcEtape(d, 'depot'); e.observations = 'COMMENTAIRE SECRET'; e.motif = 'MOTIF SECRET';
    await fcAjouterJustificatif(a.d1, 'depot', { reference: 'JUSTIF-INTERNE-77', source: 'promoteur', note: 'NOTE DE JUSTIF' });
    await fcPublierInformation(a.d1, 'depot', { libelle: 'Dossier déposé', source: 'promoteur' });
    return JSON.stringify(fcVueSouscripteur('c1'));
  }, ids);
  for (const interdit of ['NOTE INTERNE', 'COMMENTAIRE SECRET', 'MOTIF SECRET', 'JUSTIF-INTERNE', 'NOTE DE JUSTIF', 'Resp Foncier', 'observations', 'responsable', 'justificatifs'])
    assert.equal(r.indexOf(interdit), -1, 'fuite : ' + interdit);
  assert.match(r, /Menko Immo/);
});

test('progression : étapes publiables seulement, pondérée, expliquée, jamais une probabilité (§9.3)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (a) {
    var zero = fcVueSouscripteur('c1').dossiers[0].progression;
    await fcAjouterJustificatif(a.d1, 'depot', { reference: 'REC-1', source: 'promoteur' });
    await fcChangerStatutEtape(a.d1, 'depot', 'termine', {});
    var un = fcVueSouscripteur('c1').dossiers[0].progression;
    DATA.params.fc_poids_phases = { C: 1, D: 1, E: 1 };
    var egal = fcVueSouscripteur('c1').dossiers[0].progression;
    return { zero: zero, un: un, egal: egal };
  }, ids);
  assert.equal(r.zero.pourcentage, 0); assert.equal(r.un.pourcentage, 10); assert.equal(r.egal.pourcentage, 9);
  assert.deepEqual(Object.keys(r.un.par_phase).sort(), ['C', 'D', 'E']);
  assert.match(r.un.explication, /ni une probabilité/); assert.match(r.un.explication, /garantie juridique/);
});

test('statut synthétique : une étape terminée n\'est jamais présentée comme une approbation', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (a) {
    var s0 = fcVueSouscripteur('c1').dossiers[0].statut;
    await fcChangerStatutEtape(a.d1, 'suivi_instruction', 'attente_administration', {});
    var s1 = fcVueSouscripteur('c1').dossiers[0].statut;
    await fcChangerStatutEtape(a.d1, 'suivi_instruction', 'termine', {});
    var s2 = fcVueSouscripteur('c1').dossiers[0];
    return { s0: s0, s1: s1, s2: s2.statut, prochaine: s2.prochaine_etape && s2.prochaine_etape.libelle };
  }, ids);
  assert.equal(r.s0, 'Démarches à venir'); assert.equal(r.s1, "En attente d'une réponse de l'administration"); assert.equal(r.s2, 'Démarches en cours');
  assert.equal(/approuv|accord|obtenu|favorable/i.test(r.s0 + r.s1 + r.s2), false);
  assert.match(r.prochaine, /Dépôt de la demande au Guichet Unique du Foncier/);
});

test('demandes d\'information : seulement sur son propre dossier, avec suivi de statut (§9.6)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (a) {
    var autreDossier = await fcCreerDemande('c1', a.d2, 'Question', 'Où en est mon dossier ?');
    var vide = await fcCreerDemande('c1', a.d1, '', 'x');
    var ok = await fcCreerDemande('c1', a.d1, 'Avancement', 'Où en est mon dossier ?');
    var statutCree = ok.demande.statut;
    var c2 = await fcCreerDemande('c2', a.d2, 'Autre', 'Ma question');
    var v1 = fcVueSouscripteur('c1');
    var repSans = await fcRepondreDemande(ok.demande.id, '');
    APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' };
    var interdit = await fcRepondreDemande(ok.demande.id, 'Réponse');
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    var rep = await fcRepondreDemande(ok.demande.id, 'Le dossier est déposé.');
    var apres = fcVueSouscripteur('c1').demandes[0];
    var clo = await fcChangerStatutDemande(ok.demande.id, 'cloturee');
    var tard = await fcRepondreDemande(ok.demande.id, 'trop tard');
    return { statutCree: statutCree, autreDossier: autreDossier, vide: vide, ok: ok, c2: c2, n1: v1.demandes.length, repSans: repSans, interdit: interdit, rep: rep, apres: apres, clo: clo, tard: tard, demandes: JSON.stringify(v1.demandes) };
  }, ids);
  assert.equal(r.autreDossier.ok, false); assert.match(r.autreDossier.erreur, /pas rattaché/); assert.equal(r.vide.ok, false);
  assert.equal(r.ok.ok, true); assert.match(r.ok.demande.reference, /^DI-\d{4}-001$/); assert.equal(r.statutCree, 'nouvelle'); assert.equal(r.c2.ok, true);
  assert.equal(r.n1, 1); assert.equal(r.demandes.indexOf('Ma question'), -1);
  assert.equal(r.repSans.ok, false); assert.equal(r.interdit.ok, false); assert.equal(r.rep.ok, true);
  assert.equal(r.apres.statut, 'Répondue'); assert.equal(r.apres.messages.length, 2);
  assert.equal(r.clo.ok, true); assert.equal(r.tard.ok, false);
});

test('stores locaux, aucune synchronisation cloud, interface sans erreur', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await pub(app.page, ids.d1, 'depot');
  const r = await app.page.evaluate(async function (a) {
    await fcCreerDemande('c1', a.d1, 'Avancement', 'Où en est mon dossier ?');
    fcRenderSouscripteurs(); fcRender(); fcOuvrirDetail(a.d1);
    return {
      stores: ['publications_foncieres', 'demandes_fonciers'].every(function (s) { return ALL_STORES.indexOf(s) !== -1 && SANIX_STORES_LOCAL_UNIQUEMENT.indexOf(s) !== -1 && !SUPA_STORE_MAP.some(function (p) { return p[1] === s; }); }),
      sync: window.__sync, apercu: document.getElementById('fs-root').innerHTML.indexOf('Résidence Les Palmiers') !== -1, demande: document.getElementById('fs-root').innerHTML.indexOf('DI-') !== -1,
      detail: document.getElementById('fc-detail').innerHTML.indexOf('Informations publiées au souscripteur') !== -1, onglet: !!document.getElementById('tab-foncier-souscripteurs')
    };
  }, ids);
  assert.deepEqual(r, { stores: true, sync: 0, apercu: true, demande: true, detail: true, onglet: true });
  assert.deepEqual(app.etat.erreursPage, []);
});
