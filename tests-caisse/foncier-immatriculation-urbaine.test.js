/* Foncier — immatriculation d'une parcelle urbaine sans titre : phases, porte de phase 1, voie ACD/approbation, étapes facultatives, grandes étapes. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, extra) {
  return page.evaluate(async (extra) => {
    window.syncToSupabase = function () {}; window.toast = function () {}; window.dbPut = async function () { return true; }; window.userPeutSurStore = function () { return true; };
    DATA.params = DATA.params || {}; DATA.params.fc_urbain_facultatives = {};
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', programme_id: 'g1', statut: 'prospection' }];
    DATA.users = [{ id: 'u1', nom: 'Resp', login: 'r', role: 'admin' }, { id: 'u2', nom: 'Agent', login: 'a', role: 'user' }];
    ['dossiers_fonciers', 'evenements_fonciers', 'missions_foncieres', 'pieces_foncieres', 'audit_log', 'notifications_foncieres', 'clients'].forEach(function (s) { DATA[s] = []; });
    APP.currentUser = { id: 'u1', nom: 'Resp', role: 'admin' }; window.hasRole = function (r) { return r === 'admin'; };
    var r = await fcOuvrirDossier(Object.assign({ parcelle_id: 'p1', situation: 'terrain_coutumier', responsable_id: 'u1' }, extra || {}));
    return { ok: r.ok, erreur: r.erreur, id: r.ok ? r.dossier.id : null };
  }, extra);
}

test('ouverture : étapes, phases, situation, parcellaire écarté si propriétaire unique', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page, { plusieurs_proprietaires: false });
  assert.ok(a.ok, a.erreur);
  const r = await page.evaluate((id) => {
    var d = fcDossier(id), ph = {}; d.etapes.forEach(function (e) { ph[e.phase] = (ph[e.phase] || 0) + 1; });
    return { type: d.type_procedure, nb: d.etapes.length, ph: ph, premier: d.etapes[0].code, dernier: d.etapes[d.etapes.length - 1].code, parc: fcEtape(d, 'urb_parcellaire').statut, poly: fcEtape(d, 'urb_polygonale_ensemble').statut,
      souscripteur: d.etapes.filter(function (e) { return e.visibilite === 'souscripteur'; }).length, proprietaires: d.proprietaires, lib: FC_PHASES.U1 };
  }, a.id);
  assert.equal(r.type, 'immatriculation_urbaine'); assert.equal(r.premier, 'creation_dossier'); assert.equal(r.dernier, 'cloture');
  assert.ok(r.ph.U1 >= 17 && r.ph.U2 >= 8 && r.ph.U3 >= 9 && r.ph.U4 >= 8 && r.ph.U5 === 2);
  assert.equal(r.parc, 'annule'); assert.equal(r.poly, 'annule'); assert.equal(r.proprietaires, 'un'); assert.ok(r.souscripteur >= 8 && r.souscripteur < r.nb);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('porte de phase 1 : blocage, dérogation réservée à un administrateur, puis déblocage', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page);
  const r = await page.evaluate(async (id) => {
    var out = {}, d = fcDossier(id);
    var x = await fcChangerStatutEtape(id, 'urb_depot_guf', 'en_cours'); out.bloque = [x.ok, !!x.phase, x.erreur && /coutumière/.test(x.erreur)];
    window.hasRole = function () { return false; }; APP.currentUser = { id: 'u2', nom: 'Agent', role: 'user' };
    var y = await fcChangerStatutEtape(id, 'urb_depot_guf', 'en_cours', { derogation_phase: true, motif: 'urgence' }); out.derogNonAdmin = [y.ok, y.erreur];
    window.hasRole = function (r) { return r === 'admin'; }; APP.currentUser = { id: 'u1', nom: 'Resp', role: 'admin' };
    var z = await fcChangerStatutEtape(id, 'urb_depot_guf', 'en_cours', { derogation_phase: true }); out.derogSansMotif = z.ok;
    // terminer toute la phase 1 (justificatifs fournis, prérequis respectés par l'ordre des étapes)
    await fcChangerStatutEtape(id, 'creation_dossier', 'termine');
    var guard = 0;
    while (fcUrbainPhase1Manquantes(d).length && guard++ < 60) {
      var e = d.etapes.filter(function (s) { return s.phase === 'U1' && ['termine', 'annule'].indexOf(s.statut) === -1 && !fcPrerequisManquants(d, s.code).length; })[0];
      if (!e) break;
      if (e.justificatif_requis) await fcAjouterJustificatif(id, e.code, { reference: 'Pièce ' + e.code, source: 'promoteur' });
      var t = await fcChangerStatutEtape(id, e.code, 'termine'); if (!t.ok) { out.echec = e.code + ' : ' + t.erreur; break; }
    }
    out.manquantes = fcUrbainPhase1Manquantes(d).length;
    var w = await fcChangerStatutEtape(id, 'urb_depot_guf', 'en_cours'); out.apres = [w.ok, w.erreur];
    return out;
  }, a.id);
  assert.deepEqual(r.bloque, [false, true, true]); assert.equal(r.derogNonAdmin[0], false); assert.match(r.derogNonAdmin[1], /administrateur|motif/);
  assert.equal(r.derogSansMotif, false); assert.equal(r.echec, undefined, r.echec); assert.equal(r.manquantes, 0); assert.equal(r.apres[0], true, r.apres[1]);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('voie ACD ou approbation : choix obligatoire, autre voie écartée, changement refusé une fois engagée', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page);
  const r = await page.evaluate(async (id) => {
    var out = {}, d = fcDossier(id);
    d.etapes.forEach(function (e) { if (e.phase === 'U1') { e.statut = 'termine'; } });   // phase 1 réputée terminée pour ce scénario
    var x = await fcChangerStatutEtape(id, 'urb_convention_tripartite', 'en_cours'); out.sansVoie = [x.ok, /voie/i.test(x.erreur || '')];
    var v = await fcDefinirVoie(id, 'inconnue'); out.voieInvalide = v.ok;
    var c = await fcDefinirVoie(id, 'acd'); out.choix = c.ok;
    out.autre = d.etapes.filter(function (e) { return e.phase === 'U4'; }).every(function (e) { return e.statut === 'annule' && /Voie non retenue/.test(e.motif); });
    out.acdOk = d.etapes.filter(function (e) { return e.phase === 'U3'; }).every(function (e) { return e.statut !== 'annule'; });
    var ch = await fcDefinirVoie(id, 'approbation'); out.changement = ch.ok;       // aucune étape engagée : permis
    out.retourAcd = d.etapes.filter(function (e) { return e.phase === 'U3'; }).every(function (e) { return e.statut === 'annule'; });
    out.apprOk = d.etapes.filter(function (e) { return e.phase === 'U4'; }).every(function (e) { return e.statut === 'a_venir' || e.statut === 'a_preparer'; });
    d.etapes.forEach(function (e) { if (e.phase === 'U2') e.statut = 'termine'; });
    var s = await fcChangerStatutEtape(id, 'urb_dossier_domaine_urbain', 'termine'); out.engage = s.ok;
    var ch2 = await fcDefinirVoie(id, 'acd'); out.changementApres = [ch2.ok, ch2.erreur];
    out.evenement = (DATA.evenements_fonciers || []).some(function (e) { return e.type === 'choix_voie'; });
    return out;
  }, a.id);
  assert.deepEqual(r.sansVoie, [false, true]); assert.equal(r.voieInvalide, false); assert.equal(r.choix, true); assert.ok(r.autre); assert.ok(r.acdOk);
  assert.equal(r.changement, true); assert.ok(r.retourAcd); assert.ok(r.apprOk); assert.equal(r.engage, true);
  assert.equal(r.changementApres[0], false); assert.match(r.changementApres[1], /engagées/); assert.ok(r.evenement);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('étapes déclarées facultatives (réforme) : ne bloquent plus la phase administrative', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page);
  const r = await page.evaluate(async (id) => {
    var out = {}, d = fcDossier(id);
    d.etapes.forEach(function (e) { if (e.phase === 'U1') e.statut = 'termine'; });
    fcEtape(d, 'urb_dotation').statut = 'a_venir'; fcEtape(d, 'urb_commodo').statut = 'a_venir';
    var x = await fcChangerStatutEtape(id, 'urb_depot_guf', 'en_cours'); out.avant = x.ok;
    DATA.params.fc_urbain_facultatives = { urb_dotation: true };
    var y = await fcChangerStatutEtape(id, 'urb_depot_guf', 'en_cours'); out.apres = y.ok;
    out.manq = fcUrbainPhase1Manquantes(d).length;
    // une étape facultative ne bloque pas non plus l'ordre des étapes
    out.prerequis = fcPrerequisManquants(d, 'urb_prepa_depot').map(function (e) { return e.code; });
    return out;
  }, a.id);
  assert.equal(r.avant, false); assert.equal(r.apres, true); assert.equal(r.manq, 0); assert.deepEqual(r.prerequis, []);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('souscripteur : seules les grandes étapes sont visibles, avec leur phase', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page);
  const r = await page.evaluate((id) => {
    var d = fcDossier(id), p = fcProgressionSouscripteur(d), vis = d.etapes.filter(function (e) { return e.visibilite === 'souscripteur'; }).map(function (e) { return e.code; });
    return { phases: Object.keys(p.par_phase), vis: vis, total: d.etapes.length, libU1: p.par_phase.U1 && p.par_phase.U1.libelle };
  }, a.id);
  assert.ok(r.phases.indexOf('U1') !== -1 && r.phases.indexOf('U2') !== -1); assert.ok(r.vis.indexOf('urb_depot_guf') !== -1 && r.vis.indexOf('urb_pv_famille') === -1);
  assert.match(r.libU1, /coutumière et technique/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('interface : panneau de la procédure, formulaire d\'ouverture, colonne Obligatoire des modèles', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page);
  const r = await page.evaluate((id) => {
    var out = {}, d = fcDossier(id); out.panneau = fcPanneauUrbain(d);
    document.body.insertAdjacentHTML('beforeend', '<div id="fm-root"></div>'); APP._fmType = 'immatriculation_urbaine'; DATA.params.fc_modeles = {}; fcRenderModeles();
    out.cases = document.querySelectorAll('#fm-root input[id^="fm-o-"]').length; out.entete = /Obligatoire/.test(document.getElementById('fm-root').innerHTML);
    out.phaseLib = /Phase 1 — Procédure coutumière et technique/.test(document.getElementById('fm-root').innerHTML);
    out.autreType = (function () { APP._fmType = 'acd'; fcRenderModeles(); return document.querySelectorAll('#fm-root input[id^="fm-o-"]').length; })();
    return out;
  }, a.id);
  assert.match(r.panneau, /Phase 1/); assert.match(r.panneau, /fcVoieUI/); assert.ok(r.cases >= 40); assert.ok(r.entete); assert.ok(r.phaseLib); assert.equal(r.autreType, 0);
  assert.deepEqual(app.etat.erreursPage, []);
});
