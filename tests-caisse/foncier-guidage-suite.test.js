/* Guidage (suite) : mode simple / expert, prêt à déposer, équipe et charge. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const USERS = [{ id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }, { id: 's1', nom: 'Foncier 1', login: 's1', role: 'service_foncier' }, { id: 's2', nom: 'Foncier 2', login: 's2', role: 'service_foncier' }, { id: 'c1', nom: 'Comptable', login: 'c1', role: 'comptable' }];
async function preparer(page, validation) {
  await page.evaluate(async (a) => {
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.params.fc_validation_fonctions = a.validation; DATA.params.fc_fonctions_roles = undefined;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = a.users; window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {}; try { localStorage.removeItem('fc_mode'); } catch (e) {}
  }, { users: USERS, validation: !!validation });
}

test('mode simple : frise par phase avec détail repliable, bascule mémorisée, expert inchangé', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir', repartition_auto: true })).dossier, o = {};
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>'); APP._fcSel = d.id;
    fcRenderDetail(d.id); let h = document.getElementById('fc-detail').innerHTML; o.expert = [/🛠 Expert/.test(h), /Voir le détail de toutes les étapes/.test(h), document.querySelectorAll('#fc-detail tr[data-fcph]').length];
    fcBasculerMode(true); h = document.getElementById('fc-detail').innerHTML;
    o.simple = [fcModeSimple(), /Voir le détail de toutes les étapes/.test(h), document.querySelectorAll('#fc-detail tr[data-fcph]').length === o.expert[2], /terminées/.test(h), /Phase A — Ouverture et diagnostic/.test(h)];
    fcBasculerMode(false); o.retour = fcModeSimple(); return o;
  });
  assert.deepEqual(r.expert.slice(0, 2), [true, false]); assert.ok(r.expert[2] > 20); assert.deepEqual(r.simple, [true, true, true, true, true]); assert.equal(r.retour, false);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('prêt à déposer : étapes avant le dépôt, pièces à contrôler, urbain via la phase 1, dossier déjà déposé', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir' })).dossier, o = {};
    let p = fcPretADeposer(fcDossier(d.id)); o.initial = [p.pret, p.depose, p.manquantes.length > 5];
    const dd = fcDossier(d.id), dep = fcEtape(dd, 'depot'); dd.etapes.forEach(e => { if (e.ordre < dep.ordre) e.statut = 'termine'; });
    p = fcPretADeposer(dd); o.pret = [p.pret, p.manquantes.length];
    DATA.pieces_foncieres.push({ id: 'pc', dossier_id: d.id, etape_code: 'depot', nom: 'x.pdf', statut: 'a_verifier' }); p = fcPretADeposer(dd); o.piece = [p.pret, p.a_controler];
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>'); fcRenderDetail(d.id); o.html = /pas encore prêt/.test(document.getElementById('fc-detail').innerHTML);
    DATA.pieces_foncieres = []; fcRenderDetail(d.id); o.htmlPret = /dossier prêt à déposer/.test(document.getElementById('fc-detail').innerHTML);
    dep.statut = 'termine'; o.depose = [fcPretADeposer(dd).depose, fcPanneauDepot(dd)];
    const u = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'immatriculation_urbaine', responsable_id: 'dir', forcer: true })).dossier; const pu = fcPretADeposer(fcDossier(u.id)); o.urbain = [pu.pret, pu.manquantes.length > 5];
    return o;
  });
  assert.deepEqual(r.initial, [false, false, true]); assert.deepEqual(r.pret, [true, 0]); assert.deepEqual(r.piece, [false, 1]); assert.equal(r.html, true); assert.equal(r.htmlPret, true);
  assert.deepEqual(r.depose, [true, '']); assert.deepEqual(r.urbain, [false, true]);
});

test('équipe et charge : charge par personne et par fonction, retards, validations en attente, étapes bloquées, onglet direction', async () => {
  const app = await ouvrirApp(); await preparer(app.page, true);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir', repartition_auto: true })).dossier, o = {};
    const dd = fcDossier(d.id), auj = fcAuj(); fcEtape(dd, 'creation_dossier').statut = 'termine';
    const e = fcEtape(dd, 'completude_documents'); e.date_cible = fcAjouterJours(auj, -5); const resp = e.responsable_id;
    const idp = fcEtape(dd, 'identification_procedure'); idp.statut = 'en_cours'; idp.validation = { statut: 'demandee', fonction: 'direction', demande_par: 'x', demande_le: fcAjouterJours(auj, -4) + 'T08:00:00Z' };
    fcEtape(dd, 'anomalies').statut = 'bloque';
    const i = fcIndicateursEquipe(auj);
    o.charge = i.personnes.reduce((s, p) => s + p.charge, 0) > 0; o.retard = i.personnes.find(p => p.id === resp).retard >= 1;
    o.valider = [i.validations.length, i.validations[0].jours >= 4, i.personnes.find(p => p.id === 'dir').a_valider];
    o.bloquees = i.bloquees.length; o.sansPersonne = i.fonctions.filter(f => !f.personnes).map(f => f.f).sort();
    document.body.insertAdjacentHTML('beforeend', '<div id="fp-root"></div>'); APP._fpVue = 'equipe'; fcRenderPilotage();
    const h = document.getElementById('fp-root').innerHTML; o.html = [/Charge par personne/.test(h), /goulot/.test(h), /Étapes bloquées/.test(h), /Équipe et charge/.test(h)];
    APP.currentUser = { id: 'x', nom: 'Agent', role: 'foncier' }; APP._fpVue = 'equipe'; fcRenderPilotage(); o.accesRestreint = !/Charge par personne/.test(document.getElementById('fp-root').innerHTML);
    return o;
  });
  assert.equal(r.charge, true); assert.equal(r.retard, true); assert.deepEqual(r.valider, [1, true, 1]); assert.equal(r.bloquees, 1);
  assert.deepEqual(r.sansPersonne, ['assistance', 'commercial', 'juridique', 'technique']); assert.deepEqual(r.html, [true, true, true, true]); assert.equal(r.accesRestreint, true);
  assert.deepEqual(app.etat.erreursPage, []);
});
