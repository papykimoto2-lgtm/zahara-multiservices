/* Guidage : validation par fonction, prochaine action, assistant d'ouverture. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const USERS = [
  { id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }, { id: 's1', nom: 'Foncier 1', login: 's1', role: 'service_foncier' },
  { id: 'c1', nom: 'Comptable', login: 'c1', role: 'comptable' }
];
async function preparer(page, users, validation) {
  await page.evaluate(async (a) => {
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.params.fc_validation_fonctions = a.validation; DATA.params.fc_fonctions_roles = undefined;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = a.users; window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
  }, { users: users || USERS, validation: !!validation });
}

test('validation par fonction : refus sans validation, demande, notification, validation = étape terminée, refus motivé', async () => {
  const app = await ouvrirApp(); await preparer(app.page, USERS, true);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier;
    const E = c => fcEtape(fcDossier(d.id), c), o = {};
    APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };
    await fcChangerStatutEtape(d.id, 'creation_dossier', 'termine', {}); await fcChangerStatutEtape(d.id, 'completude_documents', 'termine', {});
    await fcChangerStatutEtape(d.id, 'identification_procedure', 'en_cours', {});
    const t = await fcChangerStatutEtape(d.id, 'identification_procedure', 'termine', {});
    o.refus = [t.ok, t.validation_requise, t.fonction]; o.statutApresRefus = E('identification_procedure').statut;
    const dem = await fcDemanderValidationEtape(d.id, 'identification_procedure'); o.demande = dem.ok && E('identification_procedure').validation.statut;
    o.doublon = (await fcDemanderValidationEtape(d.id, 'identification_procedure')).ok;
    o.notifs = DATA.notifications_foncieres.filter(n => n.template_code === 'validation_etape' && n.destinataire_id === 'dir').length;
    o.peutNon = (await fcDecisionValidationEtape(d.id, 'identification_procedure', 'validee')).ok;
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    o.refusSansMotif = (await fcDecisionValidationEtape(d.id, 'identification_procedure', 'refusee', '')).ok;
    const ref = await fcDecisionValidationEtape(d.id, 'identification_procedure', 'refusee', 'Pièce manquante'); o.refusee = ref.ok && E('identification_procedure').validation.statut;
    APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' }; o.redemande = (await fcDemanderValidationEtape(d.id, 'identification_procedure')).ok;
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    const ok = await fcDecisionValidationEtape(d.id, 'identification_procedure', 'validee'); o.validee = [ok.ok, ok.terminee, E('identification_procedure').statut, E('identification_procedure').validation.par];
    o.evt = ['validation_demandee', 'validation_refusee', 'validation_accordee'].map(t => DATA.evenements_fonciers.filter(e => e.type === t).length);
    return o;
  });
  assert.deepEqual(r.refus, [false, true, 'direction']); assert.equal(r.statutApresRefus, 'en_cours'); assert.equal(r.demande, 'demandee'); assert.equal(r.doublon, false); assert.ok(r.notifs >= 1);
  assert.equal(r.peutNon, false); assert.equal(r.refusSansMotif, false); assert.equal(r.refusee, 'refusee'); assert.equal(r.redemande, true);
  assert.deepEqual(r.validee, [true, true, 'termine', 'Directeur']); assert.deepEqual(r.evt, [2, 1, 1]);
});

test('validation : l\'administrateur termine directement (et la validation est enregistrée) ; fonction sans personne = pas de blocage ; réglage désactivable', async () => {
  const app = await ouvrirApp(); await preparer(app.page, USERS, true);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir' })).dossier, o = {};
    await fcChangerStatutEtape(d.id, 'creation_dossier', 'termine', {}); await fcChangerStatutEtape(d.id, 'completude_documents', 'termine', {});
    await fcChangerStatutEtape(d.id, 'identification_procedure', 'en_cours', {});
    const t = await fcChangerStatutEtape(d.id, 'identification_procedure', 'termine', {}); o.admin = [t.ok, fcEtape(fcDossier(d.id), 'identification_procedure').validation.statut];
    // fonction « technique » : validation_technique est validée par la direction (présente) ; ind_identification_lot exécutée par technique, sans validation
    o.requisDirection = fcValidationRequise(fcDossier(d.id), { code: 'validation_technique', statut: 'a_venir' });
    DATA.users = DATA.users.filter(u => u.role !== 'admin'); o.sansPersonne = fcValidationRequise(fcDossier(d.id), { code: 'validation_technique', statut: 'a_venir' });
    DATA.users.push({ id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }); DATA.params.fc_validation_fonctions = false; o.desactive = fcValidationRequise(fcDossier(d.id), { code: 'validation_technique', statut: 'a_venir' });
    return o;
  });
  assert.deepEqual(r.admin, [true, 'validee']); assert.equal(r.requisDirection, 'direction'); assert.equal(r.sansPersonne, ''); assert.equal(r.desactive, '');
});

test('prochaine action : étape prête, personne, bouton adapté (démarrer / demander la validation / terminer), blocage, dossier clôturé', async () => {
  const app = await ouvrirApp(); await preparer(app.page, USERS, true);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1', repartition_auto: true })).dossier, o = {};
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>');
    let a = fcProchaineAction(fcDossier(d.id)); o.premiere = a.etape.code;
    fcRenderDetail(d.id); let h = document.getElementById('fc-detail').innerHTML; o.carte = /Prochaine action/.test(h); o.demarrer = /Démarrer/.test(h);
    APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };
    await fcChangerStatutEtape(d.id, 'creation_dossier', 'termine', {}); await fcChangerStatutEtape(d.id, 'completude_documents', 'termine', {}); await fcChangerStatutEtape(d.id, 'identification_procedure', 'en_cours', {});
    a = fcProchaineAction(fcDossier(d.id)); o.suivante = [a.etape.code, a.valide, a.active, a.exec];
    fcRenderDetail(d.id); h = document.getElementById('fc-detail').innerHTML; o.demande = /Demander la validation \(Direction\)/.test(h);
    await fcActionEtapeUI(d.id, 'identification_procedure', 'termine');   // confirm() accepté par le harnais : validation demandée
    a = fcProchaineAction(fcDossier(d.id)); o.attente = a.validation;
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; fcRenderDetail(d.id); h = document.getElementById('fc-detail').innerHTML; o.valider = /Valider et terminer/.test(h);
    // blocage : toutes les étapes ouvertes dépendent d'une étape non terminée
    const d2 = fcDossier(d.id); d2.etapes.forEach(e => { if (e.statut !== 'termine') e.statut = 'a_venir'; });
    d2.statut = 'cloture'; o.cloture = fcProchaineAction(d2);
    return o;
  });
  assert.equal(r.premiere, 'creation_dossier'); assert.equal(r.carte, true); assert.equal(r.demarrer, true);
  assert.deepEqual(r.suivante, ['identification_procedure', 'direction', true, 'foncier']); assert.equal(r.demande, true); assert.equal(r.attente, 'demandee'); assert.equal(r.valider, true); assert.equal(r.cloture, null);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('assistant d\'ouverture : proposition selon la situation, étapes écartées, équipe manquante, formulaire prérempli', async () => {
  const app = await ouvrirApp(); await preparer(app.page, USERS, false);
  const r = await app.page.evaluate(async () => {
    const o = {}, brut = fcAssistantPropose({ situation: 'terrain_coutumier', proprietaires: 'plusieurs', voie: '' }), un = fcAssistantPropose({ situation: 'terrain_coutumier', proprietaires: 'un', voie: 'acd' });
    o.brut = [brut.type, brut.urbain, brut.nb]; o.un = [un.urbain, un.nb < brut.nb, un.ecartees >= 2]; o.sans = brut.sans_equipe.indexOf('juridique') !== -1;
    const acd = fcAssistantPropose({ situation: 'acd_delivre' }); o.acd = [acd.type, acd.urbain];
    const inconnu = fcAssistantPropose({}); o.inconnu = inconnu.type;
    const sv = fcAssistantPropose({ situation: 'terrain_coutumier', pour: 'souscripteur' }); o.souscr = sv.avertissements.some(x => /Titres individuels/.test(x));
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-root"></div>'); fcRender();
    o.form = !!document.getElementById('fc-q1') && !!document.getElementById('fc-assistant-recap');
    const q1 = document.getElementById('fc-q1'); q1.value = 'terrain_coutumier'; fcAssistantMaj(); o.recap = /Immatriculation d'une parcelle urbaine/.test(document.getElementById('fc-assistant-recap').innerHTML);
    o.urbVisible = [].every.call(document.querySelectorAll('.fc-q-urb'), z => z.style.display === '');
    document.getElementById('fc-q2').value = 'un'; document.getElementById('fc-q3').value = 'approbation'; fcAssistantAppliquer();
    o.champs = [document.getElementById('fc-n-situation').value, document.getElementById('fc-n-type').value, document.getElementById('fc-n-prop').value, document.getElementById('fc-n-voie').value];
    const avant = DATA.dossiers_fonciers.length; await fcAssistantOuvrir(); o.sansResp = DATA.dossiers_fonciers.length === avant;
    document.getElementById('fc-n-resp').value = 'dir'; await fcAssistantOuvrir(); const d = DATA.dossiers_fonciers[DATA.dossiers_fonciers.length - 1];
    o.ouvert = [d && d.type_procedure, d && d.voie_immatriculation, d && d.proprietaires, d && d.situation_initiale];
    return o;
  });
  assert.deepEqual(r.brut.slice(0, 2), ['immatriculation_urbaine', true]); assert.ok(r.brut[2] > 40); assert.deepEqual(r.un, [true, true, true]); assert.equal(r.sans, true);
  assert.deepEqual(r.acd, ['avec_acd', false]); assert.equal(r.inconnu, 'acd'); assert.equal(r.souscr, true);
  assert.equal(r.form, true); assert.equal(r.recap, true); assert.equal(r.urbVisible, true);
  assert.deepEqual(r.champs, ['terrain_coutumier', 'immatriculation_urbaine', 'un', 'approbation']); assert.equal(r.sansResp, true);
  assert.deepEqual(r.ouvert, ['immatriculation_urbaine', 'approbation', 'un', 'terrain_coutumier']);
  assert.deepEqual(app.etat.erreursPage, []);
});
