/* Module Validations : les demandes de validation d'étapes de dossier foncier y figurent et s'y décident. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const USERS = [
  { id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }, { id: 's1', nom: 'Foncier 1', login: 's1', role: 'service_foncier' },
  { id: 'c1', nom: 'Comptable', login: 'c1', role: 'comptable' }
];
async function preparer(page) {
  await page.evaluate(async (users) => {
    window.toast = m => { (window.__t = window.__t || []).push(m); };
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.params.fc_validation_fonctions = true; DATA.params.fc_fonctions_roles = undefined;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = users; window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers', 'validations'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {}; window.confirm = () => true;
  }, USERS);
}

test('une demande de validation d\'étape foncière apparaît dans Validations et s\'y décide', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier, o = {};
    const E = c => fcEtape(fcDossier(d.id), c), V = () => DATA.validations.filter(v => v.type === 'etape_fonciere');
    APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };
    await fcChangerStatutEtape(d.id, 'creation_dossier', 'termine', {}); await fcChangerStatutEtape(d.id, 'completude_documents', 'termine', {});
    await fcChangerStatutEtape(d.id, 'identification_procedure', 'en_cours', {});
    await fcDemanderValidationEtape(d.id, 'identification_procedure');
    o.cree = V().length; o.statut = V()[0].statut; o.fonction = V()[0].meta.fonction; o.libelleDossier = V()[0].libelle.indexOf(fcDossier(d.id).reference) === 0;
    o.peutFoncier = valPeutDecider(V()[0]);
    await valDecide(V()[0].id, 'valide', '');
    o.etapeApresInterdit = E('identification_procedure').statut; o.encoreAttente = V()[0].statut;
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    o.peutDir = valPeutDecider(V()[0]);
    renderValidations(); o.lignes = (document.getElementById('tbody-validations') || {}).innerHTML.indexOf('Étape de dossier foncier') !== -1;
    await valDecide(V()[0].id, 'valide', '');
    o.etapeApres = E('identification_procedure').statut; o.valideur = V()[0].valideur; o.decision = V()[0].statut; o.parQui = E('identification_procedure').validation.par;
    o.doublon = V().length;
    return o;
  });
  assert.equal(r.cree, 1); assert.equal(r.statut, 'en_attente'); assert.equal(r.fonction, 'direction'); assert.ok(r.libelleDossier);
  assert.equal(r.peutFoncier, false);
  assert.notEqual(r.etapeApresInterdit, 'termine'); assert.equal(r.encoreAttente, 'en_attente');
  assert.equal(r.peutDir, true); assert.ok(r.lignes);
  assert.equal(r.etapeApres, 'termine'); assert.equal(r.decision, 'valide'); assert.equal(r.valideur, 'Directeur'); assert.equal(r.parQui, 'Directeur');
  assert.equal(r.doublon, 1);
});

test('refus depuis Validations : motif obligatoire, étape non terminée, redemande possible ; décision côté dossier clôt la ligne', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier, o = {};
    const E = c => fcEtape(fcDossier(d.id), c), V = () => DATA.validations.filter(v => v.type === 'etape_fonciere');
    APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };
    await fcChangerStatutEtape(d.id, 'creation_dossier', 'termine', {}); await fcChangerStatutEtape(d.id, 'completude_documents', 'termine', {});
    await fcChangerStatutEtape(d.id, 'identification_procedure', 'en_cours', {});
    await fcDemanderValidationEtape(d.id, 'identification_procedure');
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    await valDecide(V()[0].id, 'rejete', ''); o.sansMotif = V()[0].statut;
    await valDecide(V()[0].id, 'rejete', 'Pièce manquante'); o.refus = V()[0].statut + ':' + V()[0].motif; o.etape = E('identification_procedure').validation.statut;
    APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };
    await fcDemanderValidationEtape(d.id, 'identification_procedure'); o.nb = V().length; o.derniere = V()[1].statut;
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    await fcDecisionValidationEtape(d.id, 'identification_procedure', 'validee'); o.clos = V()[1].statut;
    return o;
  });
  assert.equal(r.sansMotif, 'en_attente');
  assert.equal(r.refus, 'rejete:Pièce manquante'); assert.equal(r.etape, 'refusee');
  assert.equal(r.nb, 2); assert.equal(r.derniere, 'en_attente'); assert.equal(r.clos, 'valide');
});

test('rattrapage : une demande antérieure sans ligne centrale y est ajoutée', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier;
    const e = fcEtape(fcDossier(d.id), 'identification_procedure'); e.statut = 'en_cours'; e.validation = { statut: 'demandee', fonction: 'direction', demande_par: 'Foncier 1', demande_le: new Date().toISOString() };
    DATA.validations = []; APP._valRattrapage = false;
    await valRattraperEtapes();
    const a = DATA.validations.length; await valRattraperEtapes();
    return { a, b: DATA.validations.length, type: DATA.validations[0].type };
  });
  assert.equal(r.a, 1); assert.equal(r.b, 1); assert.equal(r.type, 'etape_fonciere');
});

test('aperçu du dossier depuis Validations : contenu, validation sans consultation demandée, ouverture directe sur l\'étape', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier, o = {};
    const V = () => DATA.validations.filter(v => v.type === 'etape_fonciere');
    APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };
    await fcChangerStatutEtape(d.id, 'creation_dossier', 'termine', {}); await fcChangerStatutEtape(d.id, 'completude_documents', 'termine', {});
    await fcChangerStatutEtape(d.id, 'identification_procedure', 'en_cours', {});
    await fcDemanderValidationEtape(d.id, 'identification_procedure');
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    window.confirm = () => false; await valDecide(V()[0].id, 'valide', ''); o.sansConsulter = V()[0].statut;
    renderValidations(); o.boutons = (document.getElementById('tbody-validations') || {}).innerHTML.indexOf('valApercuEtapeFonciere') !== -1;
    valApercuEtapeFonciere(V()[0].id);
    const m = document.getElementById('val-apercu-fc'); o.modal = !!m; const t = m ? m.textContent : '';
    o.contenu = [t.indexOf(fcDossier(d.id).reference) !== -1, t.indexOf('Pièces de l’étape') !== -1, t.indexOf('Direction') !== -1, t.indexOf('Avancement') !== -1];
    o.btns = m ? [m.innerHTML.indexOf('valApercuDecider') !== -1, m.innerHTML.indexOf('valOuvrirDossierFoncier') !== -1] : [];
    o.vu = !!APP._valApercuVus[V()[0].id];
    valApercuFermer(); o.ferme = !document.getElementById('val-apercu-fc');
    APP._valApercuVus = {}; valApercuEtapeFonciere(V()[0].id); await valApercuDecider(V()[0].id, true); o.apresApercu = V()[0].statut; o.modalFerme = !document.getElementById('val-apercu-fc');
    return o;
  });
  assert.equal(r.sansConsulter, 'en_attente'); assert.ok(r.boutons); assert.ok(r.modal);
  assert.deepEqual(r.contenu, [true, true, true, true]); assert.deepEqual(r.btns, [true, true]); assert.ok(r.vu); assert.ok(r.ferme);
  assert.equal(r.apresApercu, 'valide'); assert.ok(r.modalFerme);
});

test('ouvrir le dossier : onglet Étapes, étape visible et mise en évidence', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier, o = {};
    APP._fcPh = {}; APP._fcPh[d.id] = { [fcEtape(fcDossier(d.id), 'identification_procedure').phase]: true };
    o.ok = fcAllerEtape(d.id, 'identification_procedure');
    await new Promise(r => setTimeout(r, 400));
    const tr = document.querySelector('#fc-detail tr[data-fcet="identification_procedure"]');
    o.ligne = !!tr; o.visible = !!tr && tr.style.display !== 'none'; o.flash = !!tr && tr.classList.contains('fc-flash');
    o.onglet = (document.querySelector('#fc-detail [data-fcpane="etapes"]') || {}).className || '';
    o.inconnu = fcAllerEtape('zz', 'x');
    return o;
  });
  assert.ok(r.ok); assert.ok(r.ligne); assert.ok(r.visible); assert.ok(r.flash); assert.match(r.onglet, /on/); assert.equal(r.inconnu, false);
});
