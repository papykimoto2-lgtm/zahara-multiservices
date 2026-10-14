/* Foncier Connect — titre global (parcelle mère) et titres individuels (lots / souscripteurs). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, opts) {
  opts = opts || {};
  return page.evaluate(async function (opts) {
    DATA.programmes = [{ id: 'g1', nom: 'Résidence Les Palmiers' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville', programme_id: 'g1', statut: opts.tfDefinitif ? 'tf_definitif' : 'negociation' }, { id: 'p2', ref: 'PARC-2', localisation: 'Bassam', programme_id: 'g1' }];
    DATA.lots = [{ id: 'l1', numero: 'L1', parcelle_id: 'p1' }, { id: 'l2', numero: 'L2', parcelle_id: 'p1' }, { id: 'l3', numero: 'L3', parcelle_id: 'p1' }, { id: 'l4', numero: 'L4', parcelle_id: 'p1' }, { id: 'l9', numero: 'L9', parcelle_id: 'p2' }];
    DATA.clients = [{ id: 'c1', nom: 'Aminata Koné', lot_ids: ['l1', 'l2'], email: 'a@exemple.ci' }, { id: 'c2', nom: 'Jean Yao', lot_id: 'l3' }, { id: 'c3', nom: 'Autre opération', lot_id: 'l9' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }, { id: 'u2', nom: 'Autre agent', login: 'ag' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(function (s) { DATA[s] = []; });
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
    var g = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    return { g: g.id };
  }, opts);
}
const run = (page, fn, arg) => page.evaluate(fn, arg === undefined ? null : arg);

test('ouverture : lot sans souscripteur, lots de parcelles différentes, formulaire général', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { tfDefinitif: true });
  assert.match((await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l4' }))).erreur, /Aucun souscripteur/);
  assert.match((await run(app.page, () => fcOuvrirDossierIndividuel({ lot_ids: ['l1', 'l9'] }))).erreur, /même parcelle/);
  assert.match((await run(app.page, () => fcOuvrirDossierIndividuel({}))).erreur, /Choisissez un lot/);
  assert.match((await run(app.page, () => fcOuvrirDossier({ parcelle_id: 'p1', type: 'titre_individuel', responsable_id: 'u1' }))).erreur, /depuis le dossier global/);
});

test('le titre mère conditionne l\'ouverture ; dérogation motivée et journalisée', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l3' }));
  assert.equal(r.ok, false); assert.equal(r.titre_mere_manquant, true); assert.match(r.erreur, /titre de l'opération n'est pas disponible/);
  assert.equal((await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l3', forcer: true }))).ok, false, 'dérogation sans motif');
  const d = await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l3', forcer: true, motif_derogation: 'Titre mère attendu cette semaine' }));
  assert.equal(d.ok, true); assert.equal(d.dossier.titre_mere_derogation.motif, 'Titre mère attendu cette semaine');
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.filter(function (e) { return e.type === 'derogation' && /sans titre mère/.test(e.description); }).length), 1);
});

test('titre mère disponible : déclaré au portefeuille, ou références du dossier global avec document officiel contrôlé', async () => {
  const app = await ouvrirApp(); const { g } = await preparer(app.page);
  assert.equal(await run(app.page, () => fcTitreMere('p1').disponible), false);
  await run(app.page, (g) => fcChangerStatutEtape(g, 'references_justificatifs', 'en_cours', {}), g);
  await run(app.page, (g) => fcAjouterJustificatif(g, 'references_justificatifs', { source: 'prestataire', reference: 'Copie scannée' }), g);
  await run(app.page, (g) => fcChangerStatutEtape(g, 'references_justificatifs', 'termine', {}), g);
  assert.equal(await run(app.page, () => fcTitreMere('p1').disponible), false, 'terminé avec un simple document de prestataire ne suffit pas');
  await run(app.page, (g) => { fcEtape(fcDossier(g), 'references_justificatifs').justificatifs.push({ id: 'j', source: 'administration_confirmee', reference: 'TF 12345' }); }, g);
  assert.equal(await run(app.page, () => fcTitreMere('p1').disponible), true);
  await run(app.page, () => { DATA.parcelles[1].statut = 'tf_definitif'; });
  assert.equal(await run(app.page, () => fcTitreMere('p2').disponible), true);
});

test('dossier individuel : étapes propres, lien avec le global, doublon refusé, lots groupés d\'un même souscripteur', async () => {
  const app = await ouvrirApp(); const { g } = await preparer(app.page, { tfDefinitif: true });
  const r = await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l3' }));
  assert.equal(r.ok, true);
  const info = await run(app.page, (id) => { var d = fcDossier(id); return { niveau: d.niveau, g: d.dossier_global_id, c: d.client_id, codes: d.etapes.map(function (e) { return e.code; }), type: d.type_procedure, resp: d.responsable_id }; }, r.dossier.id);
  assert.equal(info.niveau, 'individuel'); assert.equal(info.g, g); assert.equal(info.c, 'c2'); assert.equal(info.resp, 'u1');
  ['ind_verification_titre_mere', 'ind_identification_lot', 'ind_pieces_souscripteur', 'ind_acte_mutation', 'ind_droits_frais', 'ind_titre_individuel', 'ind_remise_titre', 'cloture'].forEach(function (c) { assert.ok(info.codes.includes(c), c); });
  assert.ok(!info.codes.includes('acd_signature'), "pas d'ACD pour un titre individuel");
  assert.match((await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l3' }))).erreur, /déjà ouvert/);
  const groupe = await run(app.page, () => fcOuvrirDossierIndividuel({ lot_ids: ['l1', 'l2'] }));
  assert.equal(groupe.ok, true); assert.deepEqual(groupe.dossier.lots_ids, ['l1', 'l2']);
  assert.match((await run(app.page, () => fcOuvrirDossierIndividuel({ lot_ids: ['l1', 'l3'] }))).erreur, /tous ces lots/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('étanchéité : un souscripteur ne voit jamais le titre individuel d\'un autre', async () => {
  const app = await ouvrirApp(); const { g } = await preparer(app.page, { tfDefinitif: true });
  const d1 = (await run(app.page, () => fcOuvrirDossierIndividuel({ lot_ids: ['l1', 'l2'] }))).dossier.id;
  const d2 = (await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l3' }))).dossier.id;
  const refs = await run(app.page, () => ({ c1: fcDossiersDuSouscripteur(fcClient('c1')).map(function (d) { return d.niveau || 'global'; }).sort(), c2: fcDossiersDuSouscripteur(fcClient('c2')).map(function (d) { return d.id; }) }));
  assert.deepEqual(refs.c1, ['global', 'individuel']); assert.equal(refs.c2.includes(d1), false); assert.equal(refs.c2.includes(d2), true); assert.equal(refs.c2.includes(g), true);
  assert.equal(await run(app.page, (d) => fcDossierAppartientAuSouscripteur('c2', d), d1), false);
  assert.match((await run(app.page, (d) => fcCreerDemande('c2', d, 'Où en est le titre ?', 'bonjour'), d1)).erreur, /pas rattaché/);
  const v = await run(app.page, () => fcVueSouscripteur('c2').dossiers.map(function (d) { return d.libelle_niveau; }));
  assert.deepEqual(v.sort(), ["Titre de l'opération (parcelle mère)", 'Votre titre individuel — lot L3'].sort());
});

test('les étapes qui supposent le titre mère ne se terminent pas si le titre mère disparaît ; la remise exige une décharge', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { tfDefinitif: true });
  const d = (await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l3' }))).dossier.id;
  assert.equal((await run(app.page, (d) => fcChangerStatutEtape(d, 'ind_identification_lot', 'en_cours', {}), d)).ok, true);
  await run(app.page, () => { DATA.parcelles[0].statut = 'negociation'; });
  await run(app.page, (d) => fcChangerStatutEtape(d, 'ind_acte_mutation', 'en_cours', {}), d);
  assert.match((await run(app.page, (d) => fcChangerStatutEtape(d, 'ind_acte_mutation', 'termine', {}), d)).erreur, /titre mère/);
  await run(app.page, () => { DATA.parcelles[0].statut = 'tf_definitif'; });
  await run(app.page, (d) => fcChangerStatutEtape(d, 'ind_remise_titre', 'en_cours', {}), d);
  assert.match((await run(app.page, (d) => fcChangerStatutEtape(d, 'ind_remise_titre', 'termine', {}), d)).erreur, /justificatif/);
});

test('ouverture en lot : uniquement si le titre mère est disponible, sans doublon ; synthèse de l\'opération', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  assert.equal((await run(app.page, () => fcOuvrirIndividuelsEnLot('p1'))).ok, false);
  await run(app.page, () => { DATA.parcelles[0].statut = 'tf_definitif'; });
  const r = await run(app.page, () => fcOuvrirIndividuelsEnLot('p1'));
  assert.equal(r.ok, true); assert.equal(r.ouverts, 3, 'un dossier par lot suivi (l1, l2, l3)');
  assert.equal((await run(app.page, () => fcOuvrirIndividuelsEnLot('p1'))).ouverts, 0);
  const s = await run(app.page, () => fcSyntheseOperation('p1'));
  assert.equal(s.lots_suivis, 3); assert.equal(s.sans_dossier, 0); assert.equal(s.en_cours, 3); assert.equal(s.remis, 0);
});

test('titre remis : décharge obligatoire, comptabilisé dans la synthèse et le pilotage de direction', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { tfDefinitif: true });
  const d = (await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l3' }))).dossier.id;
  await run(app.page, (d) => fcChangerStatutEtape(d, 'ind_remise_titre', 'en_cours', {}), d);
  await run(app.page, (d) => fcAjouterJustificatif(d, 'ind_remise_titre', { source: 'promoteur', reference: 'Décharge signée' }), d);
  assert.equal((await run(app.page, (d) => fcChangerStatutEtape(d, 'ind_remise_titre', 'termine', {}), d)).ok, true);
  const s = await run(app.page, () => fcSyntheseOperation('p1'));
  assert.equal(s.remis, 1);
  const dir = await run(app.page, () => fcIndicateursDirection().operations.map(function (o) { return [o.lots_suivis, o.remis]; }));
  assert.deepEqual(dir, [[3, 1], [1, 0]], 'opération 1 : 1 remis sur 3 ; opération 2 : un lot suivi, aucun dossier');
  assert.ok((await run(app.page, () => fcLignesPilotage('direction', 'u1').some(function (l) { return /Titres individuels/.test(l[0]) && l[1] === '1 / 3'; }))));
});

test('interface : panneau des titres individuels, bandeau du dossier individuel, liste', async () => {
  const app = await ouvrirApp(); const { g } = await preparer(app.page, { tfDefinitif: true });
  const d = (await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l3' }))).dossier.id;
  const h = await run(app.page, (a) => { document.body.insertAdjacentHTML('beforeend', '<div id="fc-root"></div><div id="fc-detail"></div>'); return { pan: fcPanneauTitresIndividuels(fcDossier(a.g)), ban: fcBandeauNiveau(fcDossier(a.d)), vide: fcPanneauTitresIndividuels(fcDossier(a.d)) }; }, { g: g, d: d });
  assert.match(h.pan, /Titres individuels de l'opération/); assert.match(h.pan, /Jean Yao/); assert.match(h.pan, /Ouvrir le dossier/); assert.match(h.pan, /disponible/);
  assert.match(h.ban, /Titre individuel/); assert.match(h.ban, /dossier global/); assert.equal(h.vide, '');
  const liste = await run(app.page, () => { fcRender(); return document.getElementById('fc-root').innerHTML; });
  assert.match(liste, /Titre individuel/); assert.deepEqual(app.etat.erreursPage, []);
});
