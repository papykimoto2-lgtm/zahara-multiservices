/* Foncier Connect — dossier groupé d'un souscripteur et groupes de mutation. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.programmes = [{ id: 'g1', nom: 'Résidence Les Palmiers' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville', programme_id: 'g1', statut: 'tf_definitif' }, { id: 'p2', ref: 'PARC-2', localisation: 'Bassam', programme_id: 'g1', statut: 'tf_definitif' }];
    DATA.lots = [{ id: 'l1', numero: 'L1', parcelle_id: 'p1' }, { id: 'l2', numero: 'L2', parcelle_id: 'p1' }, { id: 'l3', numero: 'L3', parcelle_id: 'p1' }, { id: 'l4', numero: 'L4', parcelle_id: 'p1' }, { id: 'l9', numero: 'L9', parcelle_id: 'p2' }];
    DATA.clients = [{ id: 'c1', nom: 'Aminata Koné', lot_ids: ['l1', 'l2'], email: 'a@exemple.ci' }, { id: 'c2', nom: 'Jean Yao', lot_id: 'l3', email: 'j@exemple.ci' }, { id: 'c3', nom: 'Fatou Traoré', lot_id: 'l4' }, { id: 'c9', nom: 'Autre opération', lot_id: 'l9' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }, { id: 'u2', nom: 'Autre agent', login: 'ag' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'groupes_fonciers', 'intervenants_fonciers', 'missions_foncieres', 'publications_foncieres', 'demandes_fonciers'].forEach(function (s) { DATA[s] = []; });
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
    await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' });
    await fcOuvrirDossier({ parcelle_id: 'p2', type: 'acd', responsable_id: 'u1' });
    var ind = {};
    for (var l of ['l3', 'l4']) ind[l] = (await fcOuvrirDossierIndividuel({ lot_id: l })).dossier.id;
    DATA.dossiers_fonciers.filter(function (d) { return d.niveau !== 'individuel'; });
    return { d3: ind.l3, d4: ind.l4 };
  });
}
const run = (page, fn, arg) => page.evaluate(fn, arg === undefined ? null : arg);

test('dossier groupé d\'un souscripteur : plusieurs lots, un dossier ; souscripteurs différents refusés', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const g = await run(app.page, () => fcOuvrirDossierIndividuel({ lot_ids: ['l1', 'l2'] }));
  assert.equal(g.ok, true); assert.deepEqual(g.dossier.lots_ids, ['l1', 'l2']); assert.equal(g.dossier.client_id, 'c1');
  assert.match((await run(app.page, () => fcOuvrirDossierIndividuel({ lot_ids: ['l1', 'l3'] }))).erreur, /tous ces lots/);
});

test('groupe de mutation : création, règles, lien conservé sans fusion des dossiers', async () => {
  const app = await ouvrirApp(); const { d3, d4 } = await preparer(app.page);
  assert.match((await run(app.page, (d) => fcCreerGroupe({ dossier_ids: [d], libelle: 'x' }), d3)).erreur, /au moins deux/);
  assert.match((await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: ' ' }), { a: d3, b: d4 })).erreur, /libellé/);
  assert.match((await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, DATA.dossiers_fonciers[0].id], libelle: 'x' }), { a: d3 })).erreur, /individuels/);
  const r = await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'Mutation — notaire X', date_cible: '2026-12-01' }), { a: d3, b: d4 });
  assert.equal(r.ok, true); assert.match(r.groupe.reference, /^GM-\d{4}-001$/);
  const x = await run(app.page, (a) => [fcDossier(a.a).groupe_id, fcDossier(a.b).groupe_id, fcDossier(a.a).client_id, fcDossier(a.b).client_id], { a: d3, b: d4 });
  assert.equal(x[0], x[1]); assert.notEqual(x[2], x[3], 'chaque dossier garde son souscripteur');
  assert.match((await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'bis' }), { a: d3, b: d4 })).erreur, /appartient déjà à un groupe/);
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.filter(function (e) { return e.type === 'groupe_rattache'; }).length), 2);
  assert.equal(await run(app.page, () => window.__sync), 0, 'jamais synchronisé');
});

test('groupes : même parcelle exigée ; dossier clos refusé ; intervenant actif', async () => {
  const app = await ouvrirApp(); const { d3, d4 } = await preparer(app.page);
  const autre = await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l9' }).then(function (r) { return r.dossier.id; }));
  assert.match((await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'x' }), { a: d3, b: autre })).erreur, /même parcelle/);
  assert.match((await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'x', intervenant_id: 'fantome' }), { a: d3, b: d4 })).erreur, /Intervenant/);
  await run(app.page, (d) => { fcDossier(d).statut = 'cloture'; }, d4);
  assert.match((await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'x' }), { a: d3, b: d4 })).erreur, /cloture/);
});

test('action groupée : appliquée à chaque dossier selon SA règle, échecs rapportés par dossier', async () => {
  const app = await ouvrirApp(); const { d3, d4 } = await preparer(app.page);
  const gid = (await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'Mutation' }), { a: d3, b: d4 })).groupe.id;
  const r = await run(app.page, (g) => fcAppliquerAuGroupe(g, 'ind_acte_mutation', 'en_cours', {}), gid);
  assert.equal(r.ok, true); assert.equal(r.appliques, 2); assert.equal(r.echecs.length, 0);
  assert.deepEqual(await run(app.page, (a) => [fcEtape(fcDossier(a.a), 'ind_acte_mutation').statut, fcEtape(fcDossier(a.b), 'ind_acte_mutation').statut], { a: d3, b: d4 }), ['en_cours', 'en_cours']);
  await run(app.page, (d) => fcAjouterJustificatif(d, 'ind_remise_titre', { source: 'promoteur', reference: 'Décharge' }), d3);
  await run(app.page, (g) => fcAppliquerAuGroupe(g, 'ind_remise_titre', 'en_cours', {}), gid);
  const t = await run(app.page, (g) => fcAppliquerAuGroupe(g, 'ind_remise_titre', 'termine', {}), gid);
  assert.equal(t.appliques, 1, 'seul le dossier avec décharge peut terminer'); assert.equal(t.echecs.length, 1); assert.match(t.echecs[0].erreur, /justificatif/);
  assert.deepEqual(await run(app.page, (a) => [fcRemisTitre(fcDossier(a.a)), fcRemisTitre(fcDossier(a.b))], { a: d3, b: d4 }), [true, false]);
  assert.match((await run(app.page, (g) => fcAppliquerAuGroupe(g, 'etape_inconnue', 'en_cours', {}), gid)).erreur, /n'existe pas/);
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.filter(function (e) { return e.type === 'action_groupee'; }).length > 0), true);
});

test('justificatif commun : ajouté à chaque dossier avec la référence du groupe, source obligatoire', async () => {
  const app = await ouvrirApp(); const { d3, d4 } = await preparer(app.page);
  const gid = (await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'Mutation' }), { a: d3, b: d4 })).groupe.id;
  assert.match((await run(app.page, (g) => fcJustificatifGroupe(g, 'ind_droits_frais', { reference: 'Q-1' }), gid)).erreur, /source/);
  const r = await run(app.page, (g) => fcJustificatifGroupe(g, 'ind_droits_frais', { source: 'administration_confirmee', reference: 'Quittance collective 88' }), gid);
  assert.equal(r.ajoutes, 2);
  const refs = await run(app.page, (a) => [fcEtape(fcDossier(a.a), 'ind_droits_frais').justificatifs[0].reference, fcEtape(fcDossier(a.b), 'ind_droits_frais').justificatifs.length], { a: d3, b: d4 });
  assert.match(refs[0], /Quittance collective 88 \[GM-/); assert.equal(refs[1], 1);
});

test('retrait et dissolution : motif obligatoire ; sous deux dossiers, le groupe est dissous et les dossiers restent', async () => {
  const app = await ouvrirApp(); const { d3, d4 } = await preparer(app.page);
  const gid = (await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'Mutation' }), { a: d3, b: d4 })).groupe.id;
  assert.match((await run(app.page, (a) => fcRetirerDuGroupe(a.g, a.d, ''), { g: gid, d: d4 })).erreur, /motif/i);
  const r = await run(app.page, (a) => fcRetirerDuGroupe(a.g, a.d, 'Traité séparément'), { g: gid, d: d4 });
  assert.equal(r.ok, true); assert.equal(r.dissous, true);
  assert.equal(await run(app.page, (g) => fcGroupe(g).statut, gid), 'dissous');
  assert.equal(await run(app.page, (a) => !!fcDossier(a.a) && !!fcDossier(a.b), { a: d3, b: d4 }), true);
  assert.equal((await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'Nouveau' }), { a: d3, b: d4 })).ok, true, 'un dossier libéré peut être regroupé');
});

test('droits : un agent non responsable de tous les dossiers ne gère pas le groupe', async () => {
  const app = await ouvrirApp(); const { d3, d4 } = await preparer(app.page);
  const gid = (await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'Mutation' }), { a: d3, b: d4 })).groupe.id;
  await run(app.page, () => { APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' }; });
  assert.match((await run(app.page, (g) => fcAppliquerAuGroupe(g, 'ind_acte_mutation', 'en_cours', {}), gid)).erreur, /responsable de tous/);
  assert.match((await run(app.page, (g) => fcJustificatifGroupe(g, 'ind_droits_frais', { source: 'promoteur', reference: 'x' }), gid)).erreur, /responsable de tous/);
  assert.match((await run(app.page, (a) => fcAjouterAuGroupe(a.g, a.d), { g: gid, d: d3 })).erreur, /déjà/);
});

test('confidentialité : le souscripteur ne voit ni le groupe ni les autres dossiers', async () => {
  const app = await ouvrirApp(); const { d3, d4 } = await preparer(app.page);
  const g = (await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'Notaire X — lot secret', intervenant_id: '' }), { a: d3, b: d4 })).groupe;
  await run(app.page, (g) => fcAppliquerAuGroupe(g, 'ind_acte_mutation', 'en_cours', {}), g.id);
  const v = await run(app.page, () => JSON.stringify(fcVueSouscripteur('c2')));
  assert.ok(!v.includes('GM-') && !v.includes('Notaire X') && !v.includes('Fatou') && !v.includes('Traoré'), 'rien du groupe ni de l\'autre souscripteur');
  const refs = await run(app.page, (a) => fcDossiersDuSouscripteur(fcClient('c2')).map(function (d) { return d.id; }).indexOf(a.b), { b: d4 });
  assert.equal(refs, -1);
  const evs = await run(app.page, (a) => DATA.evenements_fonciers.filter(function (e) { return e.dossier_id === a.a && e.type === 'action_groupee'; }).map(function (e) { return e.description; }), { a: d3 });
  assert.ok(evs.every(function (d) { return !/Fatou|Traoré|Aminata/.test(d); }), 'le journal d\'un dossier ne nomme pas les autres souscripteurs');
});

test('interface : cases à cocher, panneau des groupes, détail et bandeau', async () => {
  const app = await ouvrirApp(); const { d3, d4 } = await preparer(app.page);
  const g = (await run(app.page, (a) => fcCreerGroupe({ dossier_ids: [a.a, a.b], libelle: 'Mutation du lot A' }), { a: d3, b: d4 })).groupe.id;
  const h = await run(app.page, (g) => { APP._fgSel = g; var glob = DATA.dossiers_fonciers.find(function (d) { return d.niveau !== 'individuel' && d.parcelle_id === 'p1'; }); return { pan: fcPanneauTitresIndividuels(glob), ban: fcBandeauNiveau(fcDossier(DATA.groupes_fonciers[0].dossier_ids[0])) }; }, g);
  assert.match(h.pan, /fc-ck-lot/); assert.match(h.pan, /Groupes de mutation/); assert.match(h.pan, /Appliquer à tout le groupe/); assert.match(h.pan, /Justificatif commun/); assert.match(h.pan, /GM-\d{4}-001/);
  assert.match(h.pan, /lots cochés \(même souscripteur\)/); assert.match(h.ban, /Groupe de mutation : <b>GM-/);
  assert.equal(await run(app.page, () => ALL_STORES.indexOf('groupes_fonciers') !== -1 && SANIX_STORES_LOCAL_UNIQUEMENT.indexOf('groupes_fonciers') === -1 && SUPA_STORE_MAP.some(function (p) { return p[1] === 'groupes_fonciers'; })), true);
  assert.deepEqual(app.etat.erreursPage, []);
});
