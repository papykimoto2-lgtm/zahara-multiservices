/* Foncier Connect — phase 1 : règles métier du cahier des charges (RM-01 à RM-11, RM-13).
   Charge la vraie page de l'ERP. Stores locaux : aucun appel à Supabase. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  await page.evaluate(function () {
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville' }, { id: 'p2', ref: 'PARC-2', localisation: 'Bassam' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }, { id: 'u2', nom: 'Géomètre', login: 'geo' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier' };
    DATA.dossiers_fonciers = []; DATA.evenements_fonciers = [];
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
  });
}
async function ouvrir(page, extra) {
  return page.evaluate(function (x) { return fcOuvrirDossier(Object.assign({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' }, x || {})); }, extra || null);
}

test('ouverture : référence unique, doublon refusé sauf confirmation (RM-01)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const a = await ouvrir(app.page);
  assert.equal(a.ok, true);
  assert.match(a.dossier.reference, /^DF-\d{4}-001$/);
  const b = await ouvrir(app.page);
  assert.equal(b.ok, false); assert.match(b.erreur, /déjà ouvert/);
  const c = await ouvrir(app.page, { forcer: true });
  assert.equal(c.ok, true); assert.match(c.dossier.reference, /-002$/);
  const refs = await app.page.evaluate(function () { return DATA.dossiers_fonciers.map(function (d) { return d.reference; }); });
  assert.equal(new Set(refs).size, refs.length);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('ouverture : parcelle, type et responsable obligatoires', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  assert.match((await ouvrir(app.page, { parcelle_id: 'inconnue' })).erreur, /Parcelle introuvable/);
  assert.match((await ouvrir(app.page, { type: 'nimporte' })).erreur, /Type de procédure invalide/);
  assert.match((await ouvrir(app.page, { responsable_id: '' })).erreur, /responsable est obligatoire/);
});

test('le workflow dépend de la procédure : toutes les étapes ne sont pas imposées', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    return ['acd', 'morcellement', 'mutation'].reduce(function (o, t) { var e = fcEtapesPour(t); o[t] = { n: e.length, acdSign: e.some(function (x) { return x.code === 'acd_signature'; }), titre: e.some(function (x) { return x.code === 'formalites_titre'; }) }; return o; }, {});
  });
  assert.equal(r.acd.n, 30); assert.equal(r.acd.acdSign, true);
  assert.equal(r.morcellement.n, 24); assert.equal(r.morcellement.acdSign, false); assert.equal(r.morcellement.titre, false);
  assert.equal(r.mutation.acdSign, false); assert.equal(r.mutation.titre, true);
});

test('rejeté, annulé et bloqué exigent un motif ; le changement est journalisé (RM-02)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page)).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    var sans = await fcChangerStatutEtape(id, 'creation_dossier', 'rejete', {});
    var avec = await fcChangerStatutEtape(id, 'creation_dossier', 'bloque', { motif: 'pièce illisible' });
    return { sans: sans, avec: avec, ev: DATA.evenements_fonciers.filter(function (e) { return e.type === 'changement_statut'; }) };
  }, id);
  assert.equal(r.sans.ok, false); assert.match(r.sans.erreur, /motif/i);
  assert.equal(r.avec.ok, true); assert.equal(r.avec.dossier.statut, 'bloque');
  assert.equal(r.ev.length, 1); assert.equal(r.ev[0].ancien, 'a_preparer'); assert.equal(r.ev[0].nouveau, 'bloque'); assert.equal(r.ev[0].motif, 'pièce illisible');
});

test('un justificatif est requis pour terminer (RM-03) et sa source est obligatoire (RM-08)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page)).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    var refuse = await fcChangerStatutEtape(id, 'depot', 'termine', {});
    var sansSource = await fcAjouterJustificatif(id, 'depot', { reference: 'REC-1' });
    var vide = await fcAjouterJustificatif(id, 'depot', { source: 'promoteur' });
    var ok = await fcAjouterJustificatif(id, 'depot', { reference: 'REC-1', source: 'administration_declaree' });
    var fin = await fcChangerStatutEtape(id, 'depot', 'termine', {});
    return { refuse: refuse, sansSource: sansSource, vide: vide, ok: ok, fin: fin, e: fcEtape(fcDossier(id), 'depot') };
  }, id);
  assert.equal(r.refuse.ok, false); assert.equal(r.refuse.justificatif_manquant, true);
  assert.equal(r.sansSource.ok, false); assert.equal(r.vide.ok, false);
  assert.equal(r.ok.ok, true); assert.equal(r.fin.ok, true);
  assert.equal(r.e.statut, 'termine'); assert.ok(r.e.date_fin); assert.equal(r.e.valide_par, 'Resp Foncier');
});

test('dérogation : motif obligatoire, journalisée à part', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page)).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    var sans = await fcChangerStatutEtape(id, 'depot', 'termine', { derogation: true });
    var avec = await fcChangerStatutEtape(id, 'depot', 'termine', { derogation: true, motif: 'reçu perdu, attestation à venir' });
    return { sans: sans, avec: avec, ev: DATA.evenements_fonciers.filter(function (e) { return e.type === 'derogation'; }) };
  }, id);
  assert.equal(r.sans.ok, false); assert.equal(r.avec.ok, true); assert.equal(r.avec.derogation, true); assert.equal(r.ev.length, 1);
});

test('une étape terminée n\'est pas modifiable en silence ; la correction exige un motif et garde l\'ancienne valeur (RM-09)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page)).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    await fcChangerStatutEtape(id, 'creation_dossier', 'termine', {});
    var direct = await fcChangerStatutEtape(id, 'creation_dossier', 'en_cours', {});
    var sansMotif = await fcCorrigerEtape(id, 'creation_dossier', { date_fin: '2026-01-01' }, '');
    var champInterdit = await fcCorrigerEtape(id, 'creation_dossier', { statut: 'a_venir' }, 'test');
    var avant = fcEtape(fcDossier(id), 'creation_dossier').date_fin;
    var ok = await fcCorrigerEtape(id, 'creation_dossier', { date_fin: '2026-01-01' }, 'date de saisie erronée');
    return { direct: direct, sansMotif: sansMotif, champInterdit: champInterdit, ok: ok, avant: avant, ev: DATA.evenements_fonciers.filter(function (e) { return e.type === 'correction'; }) };
  }, id);
  assert.equal(r.direct.ok, false); assert.equal(r.sansMotif.ok, false); assert.equal(r.champInterdit.ok, false);
  assert.equal(r.ok.ok, true); assert.equal(r.ev.length, 1); assert.equal(r.ev[0].ancien, r.avant); assert.equal(r.ev[0].nouveau, '2026-01-01'); assert.equal(r.ev[0].motif, 'date de saisie erronée');
});

test('« terminé » n\'est pas « accordé » : l\'issue exige un document officiel reçu et contrôlé (RM-07, RM-08)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page)).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    await fcAjouterJustificatif(id, 'reponse', { reference: 'Appel téléphonique', source: 'administration_declaree' });
    await fcChangerStatutEtape(id, 'reponse', 'termine', {});
    var issueApresTermine = fcEtape(fcDossier(id), 'reponse').issue;
    var declaree = await fcDefinirIssue(id, 'reponse', 'favorable');
    await fcAjouterJustificatif(id, 'reponse', { reference: 'Décision n°123', source: 'administration_confirmee' });
    var confirmee = await fcDefinirIssue(id, 'reponse', 'favorable');
    return { issueApresTermine: issueApresTermine, declaree: declaree, confirmee: confirmee, issue: fcEtape(fcDossier(id), 'reponse').issue };
  }, id);
  assert.equal(r.issueApresTermine, ''); assert.equal(r.declaree.ok, false); assert.equal(r.confirmee.ok, true); assert.equal(r.issue, 'favorable');
});

test('un statut actif exige un responsable (RM-04)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page)).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    var d = fcDossier(id); d.responsable_id = ''; fcEtape(d, 'creation_dossier').responsable_id = '';
    return fcChangerStatutEtape(id, 'creation_dossier', 'en_cours', {});
  }, id);
  assert.equal(r.ok, false); assert.match(r.erreur, /responsable/i);
});

test('clôture : refusée tant que des étapes restent ouvertes, sinon dérogation motivée (RM-13)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const id = (await ouvrir(app.page)).dossier.id;
  const r = await app.page.evaluate(async function (id) {
    var refus = await fcChangerStatutEtape(id, 'cloture', 'termine', {});
    var sansMotif = await fcChangerStatutEtape(id, 'cloture', 'termine', { derogation: true });
    var ok = await fcChangerStatutEtape(id, 'cloture', 'termine', { derogation: true, motif: 'dossier abandonné par le promoteur' });
    var d = fcDossier(id);
    var apres = await fcChangerStatutEtape(id, 'depot', 'en_cours', {});
    return { refus: refus, sansMotif: sansMotif, ok: ok, statut: d.statut, dateCloture: d.date_cloture, apres: apres };
  }, id);
  assert.equal(r.refus.ok, false); assert.equal(r.refus.etapes_restantes, true); assert.equal(r.sansMotif.ok, false);
  assert.equal(r.ok.ok, true); assert.equal(r.statut, 'cloture'); assert.ok(r.dateCloture);
  assert.equal(r.apres.ok, false);
});

test('retards : un délai administratif dépassé n\'est pas un retard interne ni un rejet (RM-11)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var hier = '2000-01-01', demain = '2999-01-01';
    return [
      fcEtatEcheance({ date_cible: hier, statut: 'en_cours' }), fcEtatEcheance({ date_cible: hier, statut: 'attente_administration' }),
      fcEtatEcheance({ date_cible: hier, statut: 'attente_decision' }), fcEtatEcheance({ date_cible: hier, statut: 'termine' }),
      fcEtatEcheance({ date_cible: hier, statut: 'rejete' }), fcEtatEcheance({ date_cible: demain, statut: 'en_cours' }), fcEtatEcheance({ date_cible: '', statut: 'en_cours' })
    ];
  });
  assert.deepEqual(r, ['retard_interne', 'delai_administratif_depasse', 'delai_administratif_depasse', '', '', '', '']);
});

test('synthèse du promoteur', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var a = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var b = (await fcOuvrirDossier({ parcelle_id: 'p2', type: 'morcellement', responsable_id: 'u1' })).dossier;
    await fcChangerStatutEtape(a.id, 'completude_documents', 'attente_document', {});
    await fcChangerStatutEtape(a.id, 'depot', 'attente_administration', {});
    await fcChangerStatutEtape(b.id, 'creation_dossier', 'bloque', { motif: 'litige' });
    fcEtape(a, 'depot').date_cible = '2000-01-01';
    return fcSynthese();
  });
  assert.equal(r.total, 2); assert.equal(r.en_cours, 2); assert.equal(r.incomplets, 1); assert.equal(r.attente_administration, 1);
  assert.equal(r.bloques, 1); assert.equal(r.delai_administratif_depasse, 1); assert.equal(r.retard_interne, 0);
});

test('journal en ajout seul, stores locaux et aucune synchronisation cloud', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    await fcChangerStatutEtape(d.id, 'creation_dossier', 'termine', {});
    var avant = DATA.evenements_fonciers.length;
    return {
      avant: avant, supprimer: typeof fcSupprimerEvenement, modifier: typeof fcModifierEvenement,
      stores: ALL_STORES.indexOf('dossiers_fonciers') !== -1 && ALL_STORES.indexOf('evenements_fonciers') !== -1,
      local: SANIX_STORES_LOCAL_UNIQUEMENT.indexOf('dossiers_fonciers') !== -1 && SANIX_STORES_LOCAL_UNIQUEMENT.indexOf('evenements_fonciers') !== -1,
      mappe: SUPA_STORE_MAP.some(function (p) { return p[1] === 'dossiers_fonciers' || p[1] === 'evenements_fonciers'; }),
      sync: window.__sync
    };
  });
  assert.ok(r.avant >= 2); assert.equal(r.supprimer, 'undefined'); assert.equal(r.modifier, 'undefined');
  assert.equal(r.stores, true); assert.equal(r.local, false); assert.equal(r.mappe, true); assert.equal(r.sync, 0);
});

test('interface : onglet, liste et détail s\'affichent sans erreur', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    fcRender(); fcOuvrirDetail(d.id);
    return { onglet: !!document.getElementById('tab-foncier-dossiers'), liste: document.getElementById('fc-root').innerHTML.indexOf(d.reference) !== -1, detail: document.getElementById('fc-detail').innerHTML.indexOf('Phase A') !== -1, bouton: document.body.innerHTML.indexOf("switchTab('foncier','dossiers')") !== -1 };
  });
  assert.deepEqual(r, { onglet: true, liste: true, detail: true, bouton: true });
  assert.deepEqual(app.etat.erreursPage, []);
});
