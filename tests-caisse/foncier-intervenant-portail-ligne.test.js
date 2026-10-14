/* Foncier Connect — portail intervenants (P2) : contrat entre le portail et l'ERP.
   Le portail modifie la mission et écrit l'événement EN SQL (fc_intervenant_accepter / fc_intervenant_demarrer).
   L'ERP, qui ne les a pas écrits lui-même, doit les comprendre : notification du responsable, suite du workflow, écran de détail.
   Les lignes ci-dessous reproduisent exactement ce que produit la fonction SQL (champs modifiés : statut, acceptation, _modifie). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }]; DATA.parcelles = [{ id: 'p1', ref: 'PARC-1' }];
    window.userPeutSurStore = function () { return true; }; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'admin' }; window.syncToSupabase = function () {};
    DATA.dossiers_fonciers = []; DATA.evenements_fonciers = []; DATA.intervenants_fonciers = []; DATA.missions_foncieres = []; DATA.notifications_foncieres = [];
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var i = (await fcEnregistrerIntervenant({ nom_organisation: 'Cabinet Géo', type: 'geometre', email: 'geo@x.ci' })).intervenant;
    var m = (await fcCreerMission({ dossier_id: d.id, intervenant_id: i.id, titre: 'Bornage', livrables: ['Plan'], echeance: '2099-12-31', etape_code: 'reception_livrables' })).mission;
    await fcChangerStatutMission(m.id, 'envoyee');
    return { d: d.id, i: i.id, m: m.id, l: m.livrables[0].id };
  });
}
/* Ce que fait fc__intervenant_changer_statut() : fusion de champs précis + événement au format de fcEvenement(). */
const ecritureSql = (page, ids, de, vers) => page.evaluate(function (a) {
  var m = fcMission(a.m), maintenant = new Date().toISOString();
  m.statut = a.vers; m._modifie = maintenant;
  if (a.vers === 'acceptee') m.acceptation = { reference: 'Portail intervenants', date: maintenant.slice(0, 10), enregistre_par: 'Cabinet Géo' };
  var lib = { envoyee: 'Envoyée', acceptee: 'Acceptée', en_cours: 'En cours' };
  DATA.evenements_fonciers.push({ id: 'ev' + a.vers, dossier_id: m.dossier_id, etape_code: m.etape_code, type: 'mission_statut', description: m.reference + ' : ' + lib[a.de] + ' → ' + lib[a.vers],
    ancien: a.de, nouveau: a.vers, source: 'prestataire', source_ref: a.vers === 'acceptee' ? 'Portail intervenants' : '', motif: '', acteur: 'Cabinet Géo', acteur_id: a.i, acteur_role: 'intervenant', date: maintenant, mission_id: a.m });
}, Object.assign({ de: de, vers: vers }, ids));

test('mission acceptée par le portail : le responsable est notifié (rattrapage des événements reçus)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await ecritureSql(app.page, ids, 'envoyee', 'acceptee');
  const r = await app.page.evaluate(async function () {
    var n = await fcRattraperNotifications(), apres = await fcRattraperNotifications();
    return { n: n, apres: apres, notifs: DATA.notifications_foncieres.filter(function (x) { return x.event_id === 'evacceptee'; }).map(function (x) { return [x.titre, x.destinataire_id, x.message]; }) };
  });
  assert.equal(r.n, 1); assert.equal(r.apres, 0, 'sans doublon au second passage');
  assert.deepEqual(r.notifs, [['Mission acceptée', 'u1', 'MF-2026-001 acceptée par Cabinet Géo']]);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('mission démarrée par le portail : l\'ERP poursuit le workflow (dépôt, soumission) et affiche l\'acceptation', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await ecritureSql(app.page, ids, 'envoyee', 'acceptee'); await ecritureSql(app.page, ids, 'acceptee', 'en_cours');
  const r = await app.page.evaluate(async function (a) {
    var depot = await fcSoumettreLivrable(a.m, a.l, { reference: 'PLAN.pdf' }), soumis = await fcChangerStatutMission(a.m, 'livrable_soumis');
    document.body.insertAdjacentHTML('beforeend', '<div id="fi-detail"></div><div id="fi-root"></div>');
    var err = null; try { fcRenderIntervenants(); fcRenderMissionDetail(a.m); } catch (e) { err = String(e); }
    return { depot: depot.ok, soumis: soumis.ok, statut: fcMission(a.m).statut, err: err, accept: document.getElementById('fi-detail').innerHTML.includes('Portail intervenants'), synthese: fcSyntheseMissions().en_cours, vue: fcVueIntervenant(a.i).missions[0].statut };
  }, ids);
  assert.deepEqual(r, { depot: true, soumis: true, statut: 'livrable_soumis', err: null, accept: true, synthese: 0, vue: 'livrable_soumis' });
});

test('l\'ERP refuse toujours une acceptation hors circuit : transitions inchangées', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (a) {
    return { saut: await fcChangerStatutMission(a.m, 'en_cours'), t: FC_TRANSITIONS_MISSION.envoyee.concat(['|'], FC_TRANSITIONS_MISSION.acceptee) };
  }, ids);
  assert.equal(r.saut.ok, false); assert.deepEqual(r.t, ['acceptee', 'annulee', '|', 'en_cours', 'annulee'], 'la fonction SQL reprend ces transitions : tout changement doit être répercuté');
});
