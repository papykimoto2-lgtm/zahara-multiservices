/* Foncier Connect — référentiel de la procédure ivoirienne (ACD, immatriculation, situations, IDUFCI, contrôles, blocs). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville' }, { id: 'p2', ref: 'PARC-2', localisation: 'Bassam' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres'].forEach(function (s) { DATA[s] = []; });
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
    return true;
  });
}
const ouvrir = (page, o) => page.evaluate(function (x) { return fcOuvrirDossier(Object.assign({ parcelle_id: 'p1', responsable_id: 'u1' }, x)); }, o);
const ordre = (page, type) => page.evaluate(function (t) { return fcEtapesPour(t).map(function (e) { return e.code; }); }, type);

test('référentiel : versionné, origine non vérifiée et avertissements présents', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () { return FC_PROCEDURE_REF; });
  assert.equal(r.version, '2026-10-13'); assert.match(r.origine, /non vérifié/); assert.match(r.a_valider_par, /professionnel habilité/);
  assert.match(r.avertissement, /ne constitue pas un organigramme interne exhaustif/); assert.match(r.non_equivalence, /pas des documents juridiquement équivalents/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('circuit de l\'ACD : neuf étapes, le titre foncier est créé AVANT la signature de l\'ACD', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () { var e = fcEtapesPour('acd'); var num = e.filter(function (x) { return /^Étape \d/.test(x.libelle); }); return { codes: e.map(function (x) { return x.code; }), numerotees: num.map(function (x) { return x.libelle.match(/^Étape (\d)/)[1] + ':' + x.code; }) }; });
  assert.deepEqual(r.numerotees, ['1:completude_documents', '1:verification_references', '2:documents_techniques', '3:depot', '4:suivi_instruction', '5:attestation_domaniale', '6:formalites_titre', '7:acd_signature', '8:enregistrement_publicite', '9:retrait_acd']);
  const i = function (c) { return r.codes.indexOf(c); };
  assert.ok(i('depot') < i('suivi_instruction') && i('suivi_instruction') < i('attestation_domaniale') && i('attestation_domaniale') < i('formalites_titre') && i('formalites_titre') < i('acd_signature') && i('acd_signature') < i('enregistrement_publicite') && i('enregistrement_publicite') < i('retrait_acd'));
});

test('chaque étape du circuit porte ses acteurs, son bloc fonctionnel et ses pièces', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var g = function (c) { var e = fcEtapesPour('acd').find(function (x) { return x.code === c; }); return { acteurs: e.acteurs, bloc: e.bloc, pieces: e.pieces.join(' | ') }; };
    return { depot: g('depot'), titre: g('formalites_titre'), signature: g('acd_signature'), publication: g('enregistrement_publicite'), retrait: g('retrait_acd'), tech: g('documents_techniques'), instruction: g('suivi_instruction') };
  });
  assert.ok(r.depot.acteurs.indexOf('guf') !== -1); assert.equal(r.depot.bloc, 1); assert.match(r.depot.pieces, /récépissé de dépôt/); assert.match(r.depot.pieces, /Justificatifs de paiement/);
  assert.deepEqual(r.titre.acteurs, ['conservation_fonciere', 'dgi']); assert.equal(r.titre.bloc, 4);
  assert.equal(r.signature.bloc, 5); assert.ok(r.signature.acteurs.indexOf('autorite_signature') !== -1);
  assert.equal(r.publication.bloc, 6); assert.deepEqual(r.retrait.acteurs, ['guf', 'demandeur']); assert.equal(r.retrait.bloc, 6); assert.match(r.retrait.pieces, /concordance/);
  assert.equal(r.tech.bloc, 3); assert.ok(r.tech.acteurs.indexOf('geometre') !== -1 && r.tech.acteurs.indexOf('cadastre') !== -1); assert.match(r.tech.pieces, /Coordonnées des sommets/);
  assert.equal(r.instruction.bloc, 2); assert.ok(r.instruction.acteurs.indexOf('mclu_domaine') !== -1);
});

test('immatriculation au Livre foncier : les six opérations dans l\'ordre, sans les étapes propres à l\'ACD', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const codes = await ordre(app.page, 'immatriculation');
  const i = function (c) { return codes.indexOf(c); };
  assert.ok(i('depot') !== -1 && i('depot') < i('publication_requisition') && i('publication_requisition') < i('recueil_oppositions') && i('recueil_oppositions') < i('bornage_contre_bornage') && i('bornage_contre_bornage') < i('traitement_oppositions') && i('traitement_oppositions') < i('formalites_livre_foncier'));
  for (const absent of ['acd_signature', 'attestation_domaniale', 'retrait_acd']) assert.equal(i(absent), -1, absent);
  const lib = await app.page.evaluate(function () { return fcEtapesPour('immatriculation').find(function (e) { return e.code === 'depot'; }).libelle; });
  assert.match(lib, /réquisition d'immatriculation/);
});

test('parcelle rurale : procédure distincte, aucune étape du circuit urbain', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const codes = await ordre(app.page, 'rural_a_examiner');
  assert.deepEqual(codes, ['creation_dossier', 'completude_documents', 'identification_procedure', 'verification_references', 'anomalies', 'cloture']);
});

test('situation initiale : procédure proposée, situations à déterminer, preuve exigée avant d\'identifier la procédure', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const sit = await app.page.evaluate(function () { return Object.keys(FC_SITUATIONS).map(function (k) { return k + ':' + FC_SITUATIONS[k].procedure + ':' + FC_SITUATIONS[k].a_determiner; }); });
  assert.deepEqual(sit, ['lettre_attribution:acd:false', 'acp:regularisation:true', 'acd_delivre:avec_acd:false', 'attestation_villageoise:regularisation:true', 'lotissement_non_approuve:regularisation:true', 'litige:regularisation:true', 'rural:rural_a_examiner:true', 'terrain_coutumier:immatriculation_urbaine:false']);
  assert.match((await ouvrir(app.page, { situation: 'inconnue', type: 'acd' })).erreur, /Situation initiale inconnue/);
  const r = await ouvrir(app.page, { situation: 'attestation_villageoise' });
  assert.equal(r.ok, true); assert.equal(r.dossier.type_procedure, 'regularisation'); assert.equal(r.dossier.procedure_a_determiner, true); assert.equal(r.dossier.situation_initiale, 'attestation_villageoise');
  const e = await app.page.evaluate(async function (id) { var x = fcEtape(fcDossier(id), 'identification_procedure'); var refus = await fcChangerStatutEtape(id, 'identification_procedure', 'termine', {}); return { requis: x.justificatif_requis, refus: refus }; }, r.dossier.id);
  assert.equal(e.requis, true); assert.equal(e.refus.ok, false); assert.equal(e.refus.justificatif_manquant, true);
  const l = await ouvrir(app.page, { parcelle_id: 'p2', situation: 'lettre_attribution' });
  assert.equal(l.dossier.type_procedure, 'acd');
  assert.equal(await app.page.evaluate(function (id) { return fcEtape(fcDossier(id), 'identification_procedure').justificatif_requis; }, l.dossier.id), false);
});

test('une situation qui contredit la procédure choisie déclenche un avertissement explicite', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await ouvrir(app.page, { situation: 'attestation_villageoise', type: 'acd' });
  assert.equal(r.ok, true); assert.equal(r.avertissements.length, 2);
  assert.match(r.avertissements[0], /pas des documents juridiquement équivalents/); assert.match(r.avertissements[1], /Procédure à déterminer/);
  const sans = await ouvrir(app.page, { parcelle_id: 'p2', situation: 'lettre_attribution', type: 'acd' });
  assert.deepEqual(sans.avertissements, []);
});

test('contrôles essentiels : neuf contrôles, source obligatoire, explication obligatoire pour une anomalie', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page, { type: 'acd' })).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    var n = fcDossier(id).controles.map(function (c) { return c.code + ':' + c.statut; });
    var sansSource = await fcEvaluerControle(id, 'identite', { statut: 'conforme' });
    var anomSansNote = await fcEvaluerControle(id, 'cadastre', { statut: 'anomalie', source: 'prestataire' });
    var naSansNote = await fcEvaluerControle(id, 'lotissement', { statut: 'non_applicable', source: 'promoteur' });
    var inconnu = await fcEvaluerControle(id, 'inexistant', { statut: 'conforme', source: 'promoteur' });
    var ok = await fcEvaluerControle(id, 'identite', { statut: 'conforme', source: 'administration_confirmee', note: 'CNI vérifiée' });
    var ev = DATA.evenements_fonciers.filter(function (e) { return e.type === 'controle'; });
    return { n: n, sansSource: sansSource, anomSansNote: anomSansNote, naSansNote: naSansNote, inconnu: inconnu, ok: ok, ev: ev.length, evSource: ev[0] && ev[0].source };
  }, id);
  assert.deepEqual(r.n.map(function (x) { return x.split(':')[0]; }), ['identite', 'origine_droits', 'situation_domaniale', 'lotissement', 'cadastre', 'titre_foncier', 'charges_oppositions', 'idufci', 'historique']);
  assert.equal(r.n.every(function (x) { return /:a_verifier$/.test(x); }), true);
  for (const x of [r.sansSource, r.anomSansNote, r.naSansNote, r.inconnu]) assert.equal(x.ok, false);
  assert.equal(r.ok.ok, true); assert.equal(r.ev, 1); assert.equal(r.evSource, 'administration_confirmee');
});

test('la préparation du dossier administratif exige les contrôles conclus ; dérogation motivée possible', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page, { type: 'acd' })).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    var refus = await fcChangerStatutEtape(id, 'preparation_dossier_admin', 'termine', {});
    await fcEvaluerControle(id, 'cadastre', { statut: 'anomalie', source: 'prestataire', note: 'superficie différente' });
    var codes = fcDossier(id).controles.map(function (c) { return c.code; });
    for (var i = 0; i < codes.length; i++) if (codes[i] !== 'cadastre') await fcEvaluerControle(id, codes[i], { statut: 'conforme', source: 'promoteur' });
    var anomalie = await fcChangerStatutEtape(id, 'preparation_dossier_admin', 'termine', {});
    await fcEvaluerControle(id, 'cadastre', { statut: 'conforme', source: 'prestataire', note: 'plan rectifié' });
    var ok = await fcChangerStatutEtape(id, 'preparation_dossier_admin', 'termine', {});
    return { refus: refus, anomalie: anomalie, ok: ok };
  }, id);
  assert.equal(r.refus.ok, false); assert.equal(r.refus.controles_restants, true); assert.match(r.refus.erreur, /Contrôles essentiels non conclus/);
  assert.equal(r.anomalie.ok, false); assert.match(r.anomalie.erreur, /Cadastre/); assert.equal(r.ok.ok, true);
  const id2 = (await ouvrir(app.page, { parcelle_id: 'p2', type: 'acd' })).dossier.id;
  const d = await app.page.evaluate(async function (id) {
    var sans = await fcChangerStatutEtape(id, 'preparation_dossier_admin', 'termine', { derogation: true });
    var avec = await fcChangerStatutEtape(id, 'preparation_dossier_admin', 'termine', { derogation: true, motif: 'dossier urgent, contrôles menés hors ligne' });
    return { sans: sans, avec: avec, ev: DATA.evenements_fonciers.filter(function (e) { return e.type === 'derogation'; }).length };
  }, id2);
  assert.equal(d.sans.ok, false); assert.equal(d.avec.ok, true); assert.equal(d.avec.derogation, true); assert.equal(d.ev, 1);
});

test('compatibilité : un dossier ouvert avant le référentiel n\'est pas bloqué et s\'affiche correctement', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    delete d.controles; delete d.situation_initiale; d.etapes.forEach(function (e) { delete e.acteurs; delete e.bloc; delete e.pieces; });
    var ok = await fcChangerStatutEtape(d.id, 'preparation_dossier_admin', 'termine', {});
    fcRender(); fcOuvrirDetail(d.id);
    return { ok: ok.ok, html: document.getElementById('fc-detail').innerHTML.indexOf('Bloc 1') !== -1, bloc: fcBlocCourant(fcDossier(d.id)) };
  });
  assert.equal(r.ok, true); assert.equal(r.html, true); assert.ok(r.bloc >= 0);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('IDUFCI : source obligatoire, doublon sur une autre parcelle signalé, jamais assimilé à un titre', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const a = (await ouvrir(app.page, { type: 'acd' })).dossier.id, b = (await ouvrir(app.page, { parcelle_id: 'p2', type: 'acd' })).dossier.id;
  const r = await app.page.evaluate(async function (ids) {
    var a = ids.a, b = ids.b;
    var sansSource = await fcDefinirReferences(a, { idufci: 'CI-123' });
    var ok = await fcDefinirReferences(a, { idufci: 'CI-123', numero_dossier_guf: 'GUF-9', source: 'administration_declaree' });
    var doublon = await fcDefinirReferences(b, { idufci: ' ci-123 ', source: 'promoteur' });
    var force = await fcDefinirReferences(b, { idufci: 'ci-123', source: 'promoteur', forcer: true });
    var d = fcDossier(a);
    return { sansSource: sansSource, ok: ok, doublon: doublon, force: force, statut: d.statut, issues: d.etapes.filter(function (e) { return e.issue; }).length, termines: d.etapes.filter(function (e) { return e.statut === 'termine'; }).length, note: FC_IDUFCI_NOTE, idu: d.idufci, guf: d.numero_dossier_guf, ev: DATA.evenements_fonciers.filter(function (e) { return e.type === 'references'; }).length };
  }, { a: a, b: b });
  assert.equal(r.sansSource.ok, false); assert.equal(r.ok.ok, true); assert.equal(r.doublon.ok, false); assert.match(r.doublon.erreur, /autre dossier/); assert.equal(r.force.ok, true);
  assert.equal(r.statut, 'ouvert'); assert.equal(r.issues, 0); assert.equal(r.termines, 0); assert.match(r.note, /pas un titre de propriété/); assert.match(r.note, /ne remplace ni l'ACD ni le titre foncier/);
  assert.equal(r.idu, 'CI-123'); assert.equal(r.guf, 'GUF-9'); assert.equal(r.ev, 2);
});

test('même IDUFCI sur la même parcelle : accepté (deux procédures sur la même parcelle)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const a = (await ouvrir(app.page, { type: 'acd' })).dossier.id, b = (await ouvrir(app.page, { type: 'mutation' })).dossier.id;
  const r = await app.page.evaluate(async function (ids) { await fcDefinirReferences(ids.a, { idufci: 'CI-1', source: 'promoteur' }); return fcDefinirReferences(ids.b, { idufci: 'CI-1', source: 'promoteur' }); }, { a: a, b: b });
  assert.equal(r.ok, true);
});

test('blocs fonctionnels : où se trouve chaque dossier', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var debut = fcBlocCourant(d);
    var suiv = {}; var ordreCodes = d.etapes.map(function (e) { return e.code; });
    var cible = ordreCodes.indexOf('formalites_titre');
    for (var i = 0; i < cible; i++) { d.etapes[i].statut = 'termine'; }
    var enTitre = fcBlocCourant(d);
    var sign = ordreCodes.indexOf('acd_signature');
    for (var k = cible; k < sign; k++) { d.etapes[k].statut = 'termine'; }
    var enSignature = fcBlocCourant(d);
    var d2 = (await fcOuvrirDossier({ parcelle_id: 'p2', type: 'acd', responsable_id: 'u1' })).dossier;
    return { debut: debut, enTitre: enTitre, enSignature: enSignature, synthese: fcSyntheseParBloc() };
  });
  assert.equal(r.debut, 0); assert.equal(r.enTitre, 4); assert.equal(r.enSignature, 5);
  assert.equal(Object.keys(r.synthese).reduce(function (a, k) { return a + r.synthese[k]; }, 0), 2);
});

test('interface : référentiel avec avertissements, six blocs, cinq sources officielles, formulaire de situation, panneau du dossier', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'regularisation', responsable_id: 'u1', situation: 'litige' })).dossier;
    fcRender(); fcOuvrirDetail(d.id);
    var racine = document.getElementById('fc-root'), detail = document.getElementById('fc-detail');
    var sel = document.getElementById('fc-n-situation'); sel.value = 'rural'; fcSituationChange(sel);
    return { ref: racine.innerHTML.indexOf('Procédure de référence') !== -1, avert: racine.innerHTML.indexOf('à valider') !== -1 || racine.innerHTML.indexOf('À valider') !== -1, blocs: (racine.innerHTML.match(/Bloc|bloc \d/g) || []).length > 0, liens: (racine.innerHTML.match(/href="https:\/\/[^"]+"/g) || []).length,
      sit: !!sel, type: document.getElementById('fc-n-type').value, info: document.getElementById('fc-n-sit-info').innerHTML.indexOf('rural') !== -1 || document.getElementById('fc-n-sit-info').innerHTML.indexOf('foncier rural') !== -1,
      detail: detail.innerHTML.indexOf('Contrôles essentiels') !== -1 && detail.innerHTML.indexOf('pas un titre de propriété') !== -1 && detail.innerHTML.indexOf('Situation initiale : Terrain faisant l') !== -1, parBloc: racine.innerHTML.indexOf('Où sont les dossiers') !== -1 };
  });
  assert.equal(r.ref, true); assert.equal(r.avert, true); assert.equal(r.liens, 5); assert.equal(r.sit, true); assert.equal(r.type, 'rural_a_examiner'); assert.equal(r.info, true); assert.equal(r.detail, true); assert.equal(r.parBloc, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('droits : contrôles et références protégés comme le reste du module ; aucune synchronisation cloud', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page, { type: 'acd' })).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    window.userPeutSurStore = function () { return false; };
    var a = await fcEvaluerControle(id, 'identite', { statut: 'conforme', source: 'promoteur' }), b = await fcDefinirReferences(id, { idufci: 'X', source: 'promoteur' });
    return { a: a, b: b, statut: fcDossier(id).controles[0].statut, sync: window.__sync };
  }, id);
  assert.equal(r.a.ok, false); assert.equal(r.b.ok, false); assert.match(r.a.erreur, /profil ne permet pas/); assert.equal(r.statut, 'a_verifier'); assert.equal(r.sync, 0);
});
