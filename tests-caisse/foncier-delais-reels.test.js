/* Suivi des délais réels : prévu (modèle / défaut) contre réel (journal), par étape et par intervenant. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('délais réels : écart par étape, par intervenant, onglet réservé à la direction', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.users = [{ id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }]; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    ['dossiers_fonciers', 'evenements_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.userPeutSurStore = () => true; window.syncToSupabase = () => {};
    const o = {}; o.vide = [fcDelaisReelsEtapes().length, fcDelaisReelsMissions().length, /Aucune étape terminée/.test(fcHtmlDelaisReels())];
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir' })).dossier;
    const ev = (code, nouveau, date) => DATA.evenements_fonciers.push({ id: 'e' + DATA.evenements_fonciers.length, dossier_id: d.id, etape_code: code, type: 'changement_statut', nouveau, date });
    ev('completude_documents', 'en_cours', '2026-01-01'); ev('completude_documents', 'termine', '2026-01-11');
    ev('depot', 'en_cours', '2026-01-01'); ev('depot', 'termine', '2026-01-03');
    const E = fcDelaisReelsEtapes(), c = E.find(x => x.code === 'completude_documents'), p = E.find(x => x.code === 'depot');
    o.etapes = [E.length, c.prevu, c.moyenne, c.ecart, c.taux, p.prevu, p.ecart, p.taux, E[0].code];
    DATA.params.fc_modeles = { acd: { actif: true, etapes: { completude_documents: { jours: 12 } } } };
    o.modele = [fcDelaisReelsEtapes().find(x => x.code === 'completude_documents').prevu, fcDelaisReelsEtapes().find(x => x.code === 'completude_documents').ecart];
    DATA.intervenants_fonciers.push({ id: 'i1', nom_organisation: 'Géo A', type: 'geometre', statut_relation: 'actif' }, { id: 'i2', nom_organisation: 'Géo B', type: 'geometre', statut_relation: 'actif' });
    const mi = (id, interv, statut, ech) => DATA.missions_foncieres.push({ id, dossier_id: d.id, intervenant_id: interv, statut, echeance: ech, livrables: [] });
    const me = (mid, nouveau, date) => DATA.evenements_fonciers.push({ id: 'm' + DATA.evenements_fonciers.length, dossier_id: d.id, type: 'mission_statut', mission_id: mid, nouveau, date });
    mi('m1', 'i1', 'validee', '2026-02-10'); me('m1', 'envoyee', '2026-02-01'); me('m1', 'validee', '2026-02-08');
    mi('m2', 'i1', 'cloturee', '2026-03-05'); me('m2', 'envoyee', '2026-03-01'); me('m2', 'validee', '2026-03-12');
    mi('m3', 'i2', 'en_cours', '2020-01-01');
    const M = fcDelaisReelsMissions(), a = M.find(x => x.intervenant_id === 'i1'), b = M.find(x => x.intervenant_id === 'i2');
    o.missions = [a.terminees, a.mesurees, a.prevu, a.reel, a.ecart, a.taux, !!b.retard_en_cours, M[0].intervenant_id];
    document.body.insertAdjacentHTML('beforeend', '<div id="fp-root"></div>');
    o.html = [/Délais réels/.test(fcHtmlDelaisReels()), /Géo A/.test(fcHtmlDelaisReels()), /Rassembler les pièces/.test(fcHtmlDelaisReels()), /\+/.test(fcHtmlDelaisReels())];
    return o;
  });
  assert.deepEqual(r.vide, [0, 0, true]);
  assert.deepEqual(r.etapes, [2, 5, 10, 5, 0, 3, -1, 100, 'completude_documents']);
  assert.deepEqual(r.modele, [12, -2]);
  assert.deepEqual(r.missions, [2, 2, 6.5, 9, 2.5, 50, true, 'i1']);
  assert.deepEqual(r.html, [true, true, true, true]);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('onglet Délais réels : visible pour la direction, absent pour un agent', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    DATA.users = [{ id: 'dir', nom: 'Directeur', role: 'admin' }, { id: 'ag', nom: 'Agent', role: 'foncier' }]; DATA.dossiers_fonciers = []; DATA.missions_foncieres = []; DATA.intervenants_fonciers = []; window.userPeutSurStore = () => true;
    document.body.insertAdjacentHTML('beforeend', '<div id="fp-root"></div>'); const o = {};
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; APP._fpVue = 'delais'; fcRenderPilotage(); o.dir = [APP._fpVue, /Délais réels — écart/.test(document.getElementById('fp-root').innerHTML)];
    APP.currentUser = { id: 'ag', nom: 'Agent', role: 'foncier' }; APP._fpVue = 'delais'; fcRenderPilotage(); o.agent = [APP._fpVue, /Délais réels — écart/.test(document.getElementById('fp-root').innerHTML)];
    return o;
  });
  assert.deepEqual(r.dir, ['delais', true]); assert.deepEqual(r.agent, ['promoteur', false]);
  assert.deepEqual(app.etat.erreursPage, []);
});
