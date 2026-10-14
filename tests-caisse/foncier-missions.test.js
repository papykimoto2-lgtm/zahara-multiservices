/* Foncier Connect — phase 2 : intervenants, missions, livrables (cahier §7 et §8). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }, { id: 'u2', nom: 'Autre agent', login: 'ag' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    DATA.dossiers_fonciers = []; DATA.evenements_fonciers = []; DATA.intervenants_fonciers = []; DATA.missions_foncieres = [];
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var g = (await fcEnregistrerIntervenant({ nom_organisation: 'Cabinet Géo Kouadio', type: 'geometre', email: 'geo@exemple.ci' })).intervenant;
    var n = (await fcEnregistrerIntervenant({ nom_organisation: 'Étude Koffi', type: 'notaire', telephone: '+225 00 00 00 00' })).intervenant;
    return { d: d.id, g: g.id, n: n.id };
  });
}
async function mission(page, ids, extra) {
  return page.evaluate(function (a) { return fcCreerMission(Object.assign({ dossier_id: a.ids.d, intervenant_id: a.ids.g, titre: 'Bornage', livrables: ['Plan de bornage', 'PV'], echeance: '2999-01-01', etape_code: 'reception_livrables' }, a.extra || {})); }, { ids: ids, extra: extra || null });
}
/* Amène une mission à « en_cours » */
async function demarrer(page, mid) {
  return page.evaluate(async function (mid) {
    await fcChangerStatutMission(mid, 'envoyee'); await fcChangerStatutMission(mid, 'acceptee', { reference: 'e-mail du 13/10' }); return fcChangerStatutMission(mid, 'en_cours');
  }, mid);
}

test('intervenant : nom, type et un moyen de contact obligatoires ; doublon refusé', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    return [await fcEnregistrerIntervenant({ type: 'geometre', email: 'x@y.z' }), await fcEnregistrerIntervenant({ nom_organisation: 'A', type: 'inconnu', email: 'x@y.z' }),
      await fcEnregistrerIntervenant({ nom_organisation: 'B', type: 'geometre' }), await fcEnregistrerIntervenant({ nom_organisation: ' cabinet géo kouadio ', type: 'geometre', email: 'autre@y.z' })];
  });
  assert.equal(r.every(function (x) { return x.ok === false; }), true);
  assert.match(r[3].erreur, /existe déjà/);
  assert.deepEqual(app.etat.erreursPage, []);
  assert.ok(ids.g);
});

test('mission : dossier, intervenant actif, livrable et échéance obligatoires', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  assert.match((await mission(app.page, ids, { livrables: [] })).erreur, /livrable/);
  assert.match((await mission(app.page, ids, { echeance: '' })).erreur, /échéance/i);
  assert.match((await mission(app.page, ids, { titre: ' ' })).erreur, /titre/i);
  assert.match((await mission(app.page, ids, { etape_code: 'inexistante' })).erreur, /étape/i);
  assert.match((await mission(app.page, Object.assign({}, ids, { d: 'x' }))).erreur, /Dossier introuvable/);
  await app.page.evaluate(function (id) { fcIntervenant(id).statut_relation = 'archive'; }, ids.g);
  assert.match((await mission(app.page, ids)).erreur, /pas actif/);
  const ok = await mission(app.page, Object.assign({}, ids, { g: ids.n }));
  assert.equal(ok.ok, true); assert.match(ok.mission.reference, /^MF-\d{4}-001$/); assert.equal(ok.mission.statut, 'brouillon');
});

test('cycle de vie : seuls les passages prévus sont possibles', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const mid = (await mission(app.page, ids)).mission.id;
  const r = await app.page.evaluate(async function (mid) {
    var sauts = [await fcChangerStatutMission(mid, 'validee'), await fcChangerStatutMission(mid, 'en_cours'), await fcChangerStatutMission(mid, 'cloturee')];
    var env = await fcChangerStatutMission(mid, 'envoyee');
    return { sauts: sauts, env: env };
  }, mid);
  assert.equal(r.sauts.every(function (x) { return x.ok === false; }), true); assert.match(r.sauts[0].erreur, /Passage impossible/);
  assert.equal(r.env.ok, true);
});

test('acceptation : la manière dont elle a été reçue est obligatoire ; sans contrat, signalé (§7.4)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const mid = (await mission(app.page, ids)).mission.id;
  const r = await app.page.evaluate(async function (mid) {
    await fcChangerStatutMission(mid, 'envoyee');
    var sans = await fcChangerStatutMission(mid, 'acceptee', {});
    var avec = await fcChangerStatutMission(mid, 'acceptee', { reference: 'e-mail du 13/10' });
    return { sans: sans, avec: avec, ev: DATA.evenements_fonciers.filter(function (e) { return e.nouveau === 'acceptee'; })[0] };
  }, mid);
  assert.equal(r.sans.ok, false); assert.equal(r.avec.ok, true); assert.equal(r.avec.sans_contrat, true);
  assert.equal(r.ev.source, 'prestataire'); assert.equal(r.ev.source_ref, 'e-mail du 13/10');
});

test('annulation : motif obligatoire', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const mid = (await mission(app.page, ids)).mission.id;
  const r = await app.page.evaluate(async function (mid) { return [await fcChangerStatutMission(mid, 'annulee', {}), await fcChangerStatutMission(mid, 'annulee', { motif: 'doublon de mission' })]; }, mid);
  assert.equal(r[0].ok, false); assert.equal(r[1].ok, true);
});

test('livrable : dépôt seulement en cours ou à corriger ; chaque version est conservée (§8.4)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const m = (await mission(app.page, ids)).mission, lid = m.livrables[0].id;
  const avant = await app.page.evaluate(function (a) { return fcSoumettreLivrable(a.mid, a.lid, { reference: 'plan-v1.pdf' }); }, { mid: m.id, lid: lid });
  assert.equal(avant.ok, false);
  await demarrer(app.page, m.id);
  const r = await app.page.evaluate(async function (a) {
    var vide = await fcSoumettreLivrable(a.mid, a.lid, {});
    var v1 = await fcSoumettreLivrable(a.mid, a.lid, { reference: 'plan-v1.pdf' });
    var double = await fcSoumettreLivrable(a.mid, a.lid, { reference: 'plan-v1bis.pdf' });
    return { vide: vide, v1: v1, double: double };
  }, { mid: m.id, lid: lid });
  assert.equal(r.vide.ok, false); assert.equal(r.v1.ok, true); assert.equal(r.v1.version.numero, 1); assert.equal(r.double.ok, false);
});

test('validation : réservée au responsable désigné ; aucun passage en « validée » sans tous les livrables validés', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const m = (await mission(app.page, ids)).mission;
  await demarrer(app.page, m.id);
  const r = await app.page.evaluate(async function (a) {
    var m = fcMission(a.mid);
    await fcSoumettreLivrable(m.id, m.livrables[0].id, { reference: 'plan.pdf' });
    await fcChangerStatutMission(m.id, 'livrable_soumis');
    APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' };
    var interdit = await fcChangerStatutMission(m.id, 'en_verification');
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    var verif = await fcChangerStatutMission(m.id, 'en_verification');
    APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' };
    var valInterdite = await fcValiderLivrable(m.id, m.livrables[0].id);
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    var v1 = await fcValiderLivrable(m.id, m.livrables[0].id);
    var tropTot = await fcChangerStatutMission(m.id, 'validee');
    return { interdit: interdit, verif: verif, valInterdite: valInterdite, v1: v1, tropTot: tropTot };
  }, { mid: m.id });
  assert.equal(r.interdit.ok, false); assert.match(r.interdit.erreur, /responsable désigné/); assert.equal(r.verif.ok, true);
  assert.equal(r.valInterdite.ok, false); assert.equal(r.v1.ok, true);
  assert.equal(r.tropTot.ok, false); assert.match(r.tropTot.erreur, /Tous les livrables/);
});

test('refus : motif et éléments à corriger obligatoires ; nouvelle version sans effacer l\'ancienne (§8.4)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const m = (await mission(app.page, ids)).mission;
  await demarrer(app.page, m.id);
  const r = await app.page.evaluate(async function (a) {
    var m = fcMission(a.mid), l = m.livrables[0];
    await fcSoumettreLivrable(m.id, l.id, { reference: 'plan-v1.pdf' }); await fcChangerStatutMission(m.id, 'livrable_soumis'); await fcChangerStatutMission(m.id, 'en_verification');
    var sansMotif = await fcRefuserLivrable(m.id, l.id, { elements: 'coordonnées' });
    var sansElements = await fcRefuserLivrable(m.id, l.id, { motif: 'erreur' });
    var ok = await fcRefuserLivrable(m.id, l.id, { motif: 'Coordonnées incohérentes', elements: 'Bornes B2 et B3', delai: '2026-11-01' });
    var statut = m.statut;
    var v2 = await fcSoumettreLivrable(m.id, l.id, { reference: 'plan-v2.pdf' });
    return { sansMotif: sansMotif, sansElements: sansElements, ok: ok, statut: statut, v2: v2, versions: l.versions.map(function (v) { return v.numero + ':' + v.statut; }), refus: l.versions[0].refus };
  }, { mid: m.id });
  assert.equal(r.sansMotif.ok, false); assert.equal(r.sansElements.ok, false); assert.equal(r.ok.ok, true); assert.equal(r.statut, 'a_corriger');
  assert.equal(r.v2.ok, true); assert.deepEqual(r.versions, ['1:refuse', '2:soumis']);
  assert.equal(r.refus.motif, 'Coordonnées incohérentes'); assert.equal(r.refus.elements, 'Bornes B2 et B3'); assert.equal(r.refus.delai, '2026-11-01'); assert.ok(r.refus.par); assert.ok(r.refus.date);
});

test('validation complète : le livrable reçu devient un justificatif sourcé de l\'étape, sans la terminer (RM-07, RM-08)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const m = (await mission(app.page, ids)).mission;
  await demarrer(app.page, m.id);
  const r = await app.page.evaluate(async function (a) {
    var m = fcMission(a.mid);
    for (var i = 0; i < m.livrables.length; i++) await fcSoumettreLivrable(m.id, m.livrables[i].id, { reference: 'f' + i + '.pdf' });
    await fcChangerStatutMission(m.id, 'livrable_soumis'); await fcChangerStatutMission(m.id, 'en_verification');
    for (var j = 0; j < m.livrables.length; j++) await fcValiderLivrable(m.id, m.livrables[j].id);
    var val = await fcChangerStatutMission(m.id, 'validee'); var clo = await fcChangerStatutMission(m.id, 'cloturee');
    var e = fcEtape(fcDossier(m.dossier_id), 'reception_livrables');
    return { val: val, clo: clo, statutEtape: e.statut, justifs: e.justificatifs.map(function (x) { return x.source; }) };
  }, { mid: m.id });
  assert.equal(r.val.ok, true); assert.equal(r.clo.ok, true);
  assert.notEqual(r.statutEtape, 'termine'); assert.equal(r.justifs.length, 2); assert.deepEqual(r.justifs, ['prestataire', 'prestataire']);
});

test('retard de mission et synthèse (§12.3)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await mission(app.page, ids, { echeance: '2000-01-01' }); const b = (await mission(app.page, ids, { titre: 'Autre' })).mission;
  const r = await app.page.evaluate(async function (bid) {
    var ms = DATA.missions_foncieres;
    await fcChangerStatutMission(ms[0].id, 'envoyee'); await fcChangerStatutMission(bid, 'envoyee');
    return { retardA: fcMissionEnRetard(ms[0]), retardB: fcMissionEnRetard(ms[1]), brouillon: fcMissionEnRetard({ statut: 'brouillon', echeance: '2000-01-01' }), s: fcSyntheseMissions() };
  }, b.id);
  assert.equal(r.retardA, true); assert.equal(r.retardB, false); assert.equal(r.brouillon, false);
  assert.equal(r.s.total, 2); assert.equal(r.s.attribuees, 2); assert.equal(r.s.en_retard, 1);
});

test('vue intervenant : seulement ses missions, sans données internes ni financières (§8.5)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const m1 = (await mission(app.page, ids)).mission;
  const m2 = (await mission(app.page, Object.assign({}, ids, { g: ids.n }), { titre: 'Acte notarié', etape_code: 'depot' })).mission;
  const r = await app.page.evaluate(async function (a) {
    await fcChangerStatutMission(a.m1, 'envoyee'); await fcChangerStatutMission(a.m2, 'envoyee');
    var d = fcDossier(fcMission(a.m1).dossier_id); d.observations = 'NOTE INTERNE CONFIDENTIELLE'; fcEtape(d, 'depot').observations = 'AUTRE NOTE INTERNE';
    return { geo: fcVueIntervenant(a.g), notaire: fcVueIntervenant(a.n), inconnu: fcVueIntervenant('zzz') };
  }, { m1: m1.id, m2: m2.id, g: ids.g, n: ids.n });
  assert.deepEqual(r.geo.missions.map(function (x) { return x.titre; }), ['Bornage']);
  assert.deepEqual(r.notaire.missions.map(function (x) { return x.titre; }), ['Acte notarié']);
  assert.deepEqual(r.inconnu.missions, []);
  const texte = JSON.stringify(r.geo);
  assert.equal(/INTERNE|observations|responsable|montant|prix/i.test(texte), false);
  assert.deepEqual(r.geo.missions[0].etapes.map(function (e) { return e.code; }), ['reception_livrables']);
  assert.equal(Object.keys(r.geo.missions[0].dossier).sort().join(), 'parcelle,reference');
});

test('brouillon et mission annulée invisibles pour l\'intervenant', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const m = (await mission(app.page, ids)).mission;
  const r = await app.page.evaluate(async function (a) {
    var avant = fcVueIntervenant(a.g).missions.length; await fcChangerStatutMission(a.m, 'annulee', { motif: 'erreur' });
    return { avant: avant, apres: fcVueIntervenant(a.g).missions.length };
  }, { m: m.id, g: ids.g });
  assert.deepEqual(r, { avant: 0, apres: 0 });
});

test('stores locaux, aucune synchronisation cloud, interface sans erreur', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const m = (await mission(app.page, ids)).mission;
  const r = await app.page.evaluate(function (mid) {
    fcRenderIntervenants(); fcMissionDetail(mid);
    return {
      stores: ['intervenants_fonciers', 'missions_foncieres'].every(function (s) { return ALL_STORES.indexOf(s) !== -1 && SANIX_STORES_LOCAL_UNIQUEMENT.indexOf(s) !== -1 && !SUPA_STORE_MAP.some(function (p) { return p[1] === s; }); }),
      sync: window.__sync, liste: document.getElementById('fi-root').innerHTML.indexOf('MF-') !== -1, detail: document.getElementById('fi-detail').innerHTML.indexOf('Plan de bornage') !== -1,
      onglet: !!document.getElementById('tab-foncier-intervenants')
    };
  }, m.id);
  assert.deepEqual(r, { stores: true, sync: 0, liste: true, detail: true, onglet: true });
  assert.deepEqual(app.etat.erreursPage, []);
});
