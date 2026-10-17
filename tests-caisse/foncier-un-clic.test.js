/* Actions en un clic par étape : mission type et courrier préparé. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const USERS = [{ id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }];
async function preparer(page) {
  await page.evaluate(async (users) => {
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.params.fc_modeles_mission = undefined;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [{ id: 'c1', nom: 'Kouassi', prenoms: 'Awa', email: 'a@x.ci' }];
    DATA.users = users; window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {}; window.confirm = () => true;
  }, USERS);
}

test('mission en un clic : intervenant le moins chargé, échéance bornée, doublon refusé, envoyée', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir' })).dossier, o = {};
    o.sans = (await fcMissionEnUnClic(d.id, 'documents_techniques')).erreur;
    DATA.intervenants_fonciers.push({ id: 'g1', nom_organisation: 'Géo A', type: 'geometre', statut_relation: 'actif' }, { id: 'g2', nom_organisation: 'Géo B', type: 'geometre', statut_relation: 'actif' });
    DATA.missions_foncieres.push({ id: 'x', dossier_id: 'autre', intervenant_id: 'g1', statut: 'en_cours', livrables: [] });
    const e = fcEtape(fcDossier(d.id), 'documents_techniques'); e.date_cible = fcAjouterJours(fcAuj(), 5);
    const m = await fcMissionEnUnClic(d.id, 'documents_techniques', { envoyer: true });
    o.m = [m.ok, m.envoyee, m.intervenant.id, m.mission.etape_code, m.mission.echeance === e.date_cible, m.mission.statut, m.mission.livrables.length > 0];
    o.doublon = (await fcMissionEnUnClic(d.id, 'documents_techniques')).erreur;
    o.aucune = (await fcMissionEnUnClic(d.id, 'creation_dossier')).erreur;
    return o;
  });
  assert.match(r.sans, /Aucun intervenant actif/);
  assert.deepEqual(r.m, [true, true, 'g2', 'documents_techniques', true, 'envoyee', true]);
  assert.match(r.doublon, /existe déjà/); assert.match(r.aucune, /Aucune mission type/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('boutons d’étape : Missionner / mission liée / Courrier, courrier préparé dans l’onglet pièces', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir', client_id: 'c1', client_ids: ['c1'] })).dossier, o = {};
    fcDossier(d.id).client_ids = ['c1']; DATA.intervenants_fonciers.push({ id: 'g1', nom_organisation: 'Géo A', type: 'geometre', statut_relation: 'actif', email: 'g@x.ci' });
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>'); APP._fcSel = d.id; fcRenderDetail(d.id);
    let h = document.getElementById('fc-detail').innerHTML; o.avant = [/⚡ Missionner/.test(h), /✉️ Courrier/.test(h)];
    await fcMissionUnClicUI(d.id, 'documents_techniques'); fcRenderDetail(d.id); h = document.getElementById('fc-detail').innerHTML;
    o.apres = [DATA.missions_foncieres.length, DATA.missions_foncieres[0].statut, /📌 MF-/.test(h)];
    fcCourrierEtapeUI(d.id, 'completude_documents');
    o.courrier = [document.getElementById('fcc-g').value, /Dossier foncier/.test((document.getElementById('fcc-objet')||{}).value ), document.querySelector('[data-fcpane="pieces"]').classList.contains('on')];
    return o;
  });
  assert.deepEqual(r.avant, [true, true]); assert.equal(r.apres[0], 1); assert.equal(r.apres[1], 'envoyee'); assert.equal(r.apres[2], true);
  assert.deepEqual(r.courrier, ['complement_souscripteur', true, true]);
  assert.deepEqual(app.etat.erreursPage, []);
});
