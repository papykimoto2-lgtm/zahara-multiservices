/* Foncier Connect — coordination : ordre des étapes, modèles de dossier, « Ma journée ». */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, opts) {
  return page.evaluate(async function (opts) {
    opts = opts || {};
    window.syncToSupabase = function () {}; window.toast = function (m) { (window.__toasts = window.__toasts || []).push(m); };
    window.userPeutSurStore = function () { return true; }; window.hasRole = function () { return false; };
    DATA.params = Object.assign(DATA.params || {}, { comptes_defaut: Object.assign({ treso_banque: '521', treso_mobile: '5712', client_lots: '4111', tva_deductible: '4452' }, opts.sansComptes ? {} : {
      titre_honoraires_notaire: '6324', titre_honoraires_geometre: '6324', titre_droits_enregistrement: '646', titre_frais_actes: '6325', titre_fournisseurs: '401', titre_avances_souscripteur: '4111' }) }, { fc_ouverture_auto_solde: undefined });
    DATA.programmes = [{ id: 'g1', nom: 'Résidence', division_id: 'dv1' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', programme_id: 'g1', statut: 'tf_definitif' }];
    DATA.lots = [{ id: 'l1', parcelle_id: 'p1', numero: '12' }, { id: 'l2', parcelle_id: 'p1', numero: '13' }, { id: 'lx', numero: 'App' }];
    DATA.clients = [{ id: 'c1', nom: 'BENDE', prenoms: 'Jean', lot_id: 'l1', programme_id: 'g1', montant_total: 27000000 }, { id: 'c2', nom: 'KONE', lot_id: 'lx', montant_total: 1000 }];
    DATA.versements = []; DATA.ecritures = [];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf', role: 'service_foncier' }, { id: 'u2', nom: 'Compta', login: 'cp', role: 'comptable' }];
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    DATA.intervenants_fonciers = [{ id: 'n1', type: 'notaire', nom_organisation: 'Étude Koffi', statut_relation: 'actif' }];
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres'].forEach(function (s) { DATA[s] = []; });
    /* le harnais remplace requireCompteDefaut par un stub : on rétablit le comportement réel (compte absent = refus) */
    window.requireCompteDefaut = function (cle) { var cd = (DATA.params && DATA.params.comptes_defaut) || {}; if (!cd[cle]) throw new Error('COMPTE_DEFAUT_MANQUANT:' + cle); return cd[cle]; };
    window.dbPut = async function () { return true; }; window.attLierJuridique = async function () { return null; };
    if (!opts.sansGlobal) { var g = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier; window.__g = g.id; }
    return true;
  }, opts || null);
}

const run = (page, fn, arg) => page.evaluate(fn, arg || null);
const ordre = (page, actif) => page.evaluate((a) => { DATA.params.fc_dependances = a; return true; }, actif);

test('ordre des étapes : refus tant que le préalable n\'est pas terminé ; dérogation motivée du responsable, journalisée', async () => {
  const app = await ouvrirApp(); await preparer(app.page); await ordre(app.page, true);
  const r = await run(app.page, async () => {
    var o = {}, d = window.__g;
    var a = await fcChangerStatutEtape(d, 'completude_documents', 'en_cours', {}); o.refus = [a.ok, a.dependance, a.erreur];
    o.hint = /Attend : Création du dossier/.test(fcHintDependance(fcDossier(d), fcEtape(fcDossier(d), 'completude_documents')));
    o.creation = (await fcChangerStatutEtape(d, 'creation_dossier', 'termine', {})).ok;
    o.suite = (await fcChangerStatutEtape(d, 'completude_documents', 'en_cours', {})).ok; o.hintApres = fcHintDependance(fcDossier(d), fcEtape(fcDossier(d), 'completude_documents'));
    o.sansMotif = (await fcChangerStatutEtape(d, 'verification_references', 'en_cours', { derogation_ordre: true })).erreur;
    APP.currentUser = { id: 'u2', nom: 'Compta', role: 'comptable' }; o.autre = (await fcChangerStatutEtape(d, 'verification_references', 'en_cours', { derogation_ordre: true, motif: 'urgence' })).erreur; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    var ok = await fcChangerStatutEtape(d, 'verification_references', 'en_cours', { derogation_ordre: true, motif: 'urgence client' }); o.derog = [ok.ok, ok.derogation];
    var ev = DATA.evenements_fonciers.filter(function (e) { return e.type === 'derogation'; }); o.ev = [ev.length, /ordre des étapes/.test(ev[0].description), ev[0].motif];
    o.annule = (await fcChangerStatutEtape(d, 'completude_documents', 'annule', { motif: 'inutile' })).ok;
    o.identif = (await fcChangerStatutEtape(d, 'identification_procedure', 'en_cours', {})).ok;
    o.bloque = (await fcChangerStatutEtape(d, 'anomalies', 'bloque', { motif: 'attente' })).ok;
    return o;
  });
  assert.deepEqual(r.refus.slice(0, 2), [false, true]); assert.match(r.refus[2], /Création du dossier/); assert.equal(r.hint, true); assert.equal(r.creation, true); assert.equal(r.suite, true); assert.equal(r.hintApres, '');
  assert.match(r.sansMotif, /exige un motif/); assert.match(r.autre, /responsable du dossier/); assert.deepEqual(r.derog, [true, true]); assert.deepEqual(r.ev, [1, true, 'urgence client']);
  assert.equal(r.annule, true); assert.equal(r.identif, true, 'une étape annulée satisfait le préalable'); assert.equal(r.bloque, true, 'on peut toujours signaler un blocage');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('ordre des étapes : réglage désactivable ; incohérences de séquence détectées', async () => {
  const app = await ouvrirApp(); await preparer(app.page); await ordre(app.page, false);
  const r = await run(app.page, async () => {
    var o = {}, d = window.__g;
    var rl = await fcChangerStatutEtape(d, 'completude_documents', 'termine', {}); o.libre = rl.ok || rl.erreur; o.hint = fcHintDependance(fcDossier(d), fcEtape(fcDossier(d), 'identification_procedure'));
    o.incoh = fcIncoherences(fcDossier(d)).map(function (x) { return x.code; }); DATA.params.fc_dependances = true; o.incohActive = fcIncoherences(fcDossier(d)).length;
    var x = fcDossier(d); fcEtape(x, 'cloture').statut = 'termine'; o.cloture = fcIncoherences(x).some(function (i) { return i.code === 'cloture'; });
    DATA.params.fc_dependances = undefined; o.defaut = fcDependancesActives();
    return o;
  });
  assert.equal(r.libre, true); assert.equal(r.hint, ''); assert.deepEqual(r.incoh, ['completude_documents']); assert.equal(r.incohActive, 1); assert.equal(r.cloture, true); assert.equal(r.defaut, true);
});

test('modèle : échéances cumulées, responsables par défaut, échéance finale ; options respectées', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, async () => {
    var o = {}, auj = fcAuj();
    DATA.params.fc_modeles = { acd: { actif: true, etapes: { creation_dossier: { jours: 2, responsable_id: 'u2' }, completude_documents: { jours: 5 }, identification_procedure: { jours: 0, responsable_id: 'inconnu' } } } };
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    o.dates = [fcEtape(d, 'creation_dossier').date_cible === fcAjouterJours(auj, 2), fcEtape(d, 'completude_documents').date_cible === fcAjouterJours(auj, 7), fcEtape(d, 'identification_procedure').date_cible];
    o.resp = [fcEtape(d, 'creation_dossier').responsable_id, fcEtape(d, 'completude_documents').responsable_id, fcEtape(d, 'identification_procedure').responsable_id];
    o.final = d.date_cible === fcAjouterJours(auj, 7); o.ev = DATA.evenements_fonciers.filter(function (e) { return e.type === 'modele'; }).length;
    var d2 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', date_cible: '2099-01-01', forcer: true })).dossier; o.cibleSaisie = d2.date_cible;
    var d3 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', sans_modele: true, forcer: true })).dossier; o.sans = [fcEtape(d3, 'creation_dossier').date_cible, d3.date_cible];
    DATA.params.fc_modeles.acd.actif = false; var d4 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', forcer: true })).dossier; o.inactif = fcEtape(d4, 'creation_dossier').date_cible;
    DATA.params.fc_modeles = { titre_individuel: { actif: true, etapes: { ind_remise_titre: { jours: 30 } } } };
    var di = (await fcOuvrirDossierIndividuel({ lot_id: 'l1', client_id: 'c1' })); o.indiv = di.ok && fcEtape(di.dossier, 'ind_remise_titre').date_cible === fcAjouterJours(auj, 30);
    o.suggest = fcDureesSuggerees('acd');
    return o;
  });
  assert.deepEqual(r.dates, [true, true, '']); assert.deepEqual(r.resp, ['u2', 'u1', 'u1']); assert.equal(r.final, true); assert.equal(r.ev, 1); assert.equal(r.cibleSaisie, '2099-01-01'); assert.deepEqual(r.sans, ['', '']); assert.equal(r.inactif, ''); assert.equal(r.indiv, true); assert.deepEqual(r.suggest, {});
});

test('modèle : durées observées proposées à partir de dossiers terminés', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, () => {
    DATA.dossiers_fonciers = []; DATA.evenements_fonciers = [];
    for (var i = 0; i < 3; i++) {
      var id = 'x' + i; DATA.dossiers_fonciers.push({ id: id, reference: 'DF-' + i, type_procedure: 'acd', parcelle_id: 'p1', etapes: [], statut: 'ouvert' });
      DATA.evenements_fonciers.push({ id: 'a' + i, dossier_id: id, etape_code: 'depot', type: 'changement_statut', nouveau: 'en_cours', date: '2026-01-01T08:00:00Z' }, { id: 'b' + i, dossier_id: id, etape_code: 'depot', type: 'changement_statut', nouveau: 'termine', date: '2026-01-' + (11 + i) + 'T08:00:00Z' });
    }
    return fcDureesSuggerees('acd');
  });
  assert.equal(r.depot.n, 3); assert.equal(r.depot.jours, 11);
});

test('modèle : écran d\'administration (droit requis, validation, enregistrement)', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, async () => {
    var o = {}; window.dbPut = async function (s, v) { (window.__puts = window.__puts || []).push(s); return true; };
    var h = document.getElementById('fm-root'); APP._fmType = 'acd'; APP.currentUser = { id: 'ux', nom: 'Agent', role: 'foncier' }; fcRenderModeles(); o.lecture = /disabled/.test(h.innerHTML);
    await fcSauverModeleUI(); o.refus = !DATA.params.fc_modeles;
    APP.currentUser = { id: 'u1', nom: 'Dir', role: 'admin' }; fcRenderModeles(); o.liste = /Création du dossier/.test(h.innerHTML) && /Délai total estimé/.test(h.innerHTML);
    document.getElementById('fm-j-creation_dossier').value = '3'; document.getElementById('fm-j-depot').value = '10'; document.getElementById('fm-r-depot').value = 'u2';
    await fcSauverModeleUI(); var m = DATA.params.fc_modeles.acd; o.saved = [m.actif, m.etapes.creation_dossier.jours, m.etapes.depot.jours, m.etapes.depot.responsable_id, Object.keys(m.etapes).length]; o.puts = window.__puts.indexOf('params') !== -1;
    fcRenderModeles(); o.total = /13 jours/.test(h.innerHTML);
    document.getElementById('fm-j-depot').value = '-4'; await fcSauverModeleUI(); o.invalide = DATA.params.fc_modeles.acd.etapes.depot.jours;
    await fcBasculerDependancesUI(false); o.deps = DATA.params.fc_dependances;
    return o;
  });
  assert.equal(r.lecture, true); assert.equal(r.refus, true); assert.equal(r.liste, true); assert.deepEqual(r.saved, [true, 3, 10, 'u2', 2]); assert.equal(r.puts, true); assert.equal(r.total, true); assert.equal(r.invalide, 10); assert.equal(r.deps, false);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('Ma journée : sections, actions en un clic, report journalisé, décision sur pièce, lecture seule pour un autre', async () => {
  const app = await ouvrirApp(); await preparer(app.page); await ordre(app.page, true);
  const r = await run(app.page, async () => {
    var o = {}, auj = fcAuj(), d = fcDossier(window.__g); d.responsable_id = 'u1';
    fcEtape(d, 'creation_dossier').date_cible = fcAjouterJours(auj, -3); fcEtape(d, 'completude_documents').date_cible = auj; fcEtape(d, 'identification_procedure').date_cible = fcAjouterJours(auj, 4);
    DATA.pieces_foncieres.push({ id: 'pc1', dossier_id: d.id, etape_code: 'creation_dossier', nom: 'cni.pdf', statut: 'a_verifier', depose_par: { role: 'souscripteur', nom: 'Jean' }, depose_le: auj + 'T08:00:00Z', visibilite: 'interne' });
    d.notes_debours = [{ id: 'n1', numero: 'NDF-1', montant: 1000, echeance: '2020-01-01', statut: 'emise', client_id: 'c1' }];
    var j = fcMaJournee('u1', auj);
    o.sections = { retard: j.retard.map(function (i) { return i.code; }), jour: j.jour.map(function (i) { return i.code + ':' + i.pret; }), proch: j.prochaines.length, pieces: j.pieces.length, notes: j.notes.length, demarrer: j.a_demarrer.map(function (i) { return i.code; }) };
    o.autre = fcCompteJournee(fcMaJournee('u2', auj));
    var h = document.getElementById('fj-root'); fcRenderJournee(); o.html = ['Démarrer', '+7 j', 'Accepter', 'Refuser', 'cni.pdf', 'NDF-1'].map(function (k) { return h.innerHTML.indexOf(k) !== -1; }); o.nb = fcCompteJournee(j); o.badge = document.getElementById('fj-badge') ? document.getElementById('fj-badge').textContent : 'absent';
    await fcJourEtapeUI(d.id, 'creation_dossier', 'termine'); o.creation = fcEtape(fcDossier(d.id), 'creation_dossier').statut;
    await fcJourEtapeUI(d.id, 'completude_documents', 'en_cours'); o.demarre = fcEtape(fcDossier(d.id), 'completude_documents').statut;
    var avant = fcEtape(fcDossier(d.id), 'identification_procedure').date_cible; await fcJourReporterUI(d.id, 'identification_procedure', 7); var apres = fcEtape(fcDossier(d.id), 'identification_procedure').date_cible; o.report = [avant, apres, DATA.evenements_fonciers.some(function (e) { return e.type === 'correction' && /Report de 7 jours/.test(e.motif); })];
    await fcJourPieceUI('pc1', 'acceptee'); o.piece = DATA.pieces_foncieres[0].statut; o.restant = fcMaJournee('u1', auj).pieces.length;
    APP._fjUser = 'u2'; APP.currentUser = { id: 'u1', nom: 'Dir', role: 'admin' }; fcRenderJournee(); o.lecture = h.innerHTML.indexOf('Terminer') === -1 && h.innerHTML.indexOf('Accepter') === -1;
    return o;
  });
  assert.deepEqual(r.sections.retard, ['creation_dossier']); assert.deepEqual(r.sections.jour, ['completude_documents:false']); assert.equal(r.sections.proch, 1); assert.equal(r.sections.pieces, 1); assert.equal(r.sections.notes, 1);
  assert.equal(r.autre, 0); assert.deepEqual(r.html, [true, true, true, true, true, true], JSON.stringify(r.sections)); assert.deepEqual(r.sections.demarrer, []); assert.equal(String(r.badge), String(r.nb));
  assert.equal(r.creation, 'termine'); assert.equal(r.demarre, 'en_cours'); assert.notEqual(r.report[0], r.report[1]); assert.equal(r.report[2], true); assert.equal(r.piece, 'acceptee'); assert.equal(r.restant, 0); assert.equal(r.lecture, true);
  assert.deepEqual(app.etat.erreursPage, []);
});
