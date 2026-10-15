/* Foncier Connect — score de risque par dossier : facteurs expliqués, niveaux, tri, pilotage, rapport, Ma journée. */
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
const jour = (n) => `fcAjouterJours(fcAuj(), ${n})`;

test('score : chaque facteur pèse son poids, expliqué ; clos et annulés à zéro ; plafond 100', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, () => {
    var o = {}, d = fcDossier(window.__g), auj = fcAuj(), pts = function (x, mot) { var m = x.motifs.find(function (y) { return y.libelle.indexOf(mot) !== -1; }); return m ? m.points : 0; };
    d.responsable_id = 'u1'; o.base = fcScoreRisque(d, auj).score;
    d.statut = 'bloque'; o.bloque = pts(fcScoreRisque(d, auj), 'bloqué');
    var e1 = fcEtape(d, 'creation_dossier'), e2 = fcEtape(d, 'completude_documents');
    e1.statut = 'en_cours'; e1.date_cible = fcAjouterJours(auj, -20); e2.statut = 'attente_administration'; e2.date_cible = fcAjouterJours(auj, -2);
    var s = fcScoreRisque(d, auj); o.retard = [pts(s, 'retard interne'), pts(s, 'plus de 14 jours'), pts(s, 'administratif')];
    d.date_cible = fcAjouterJours(auj, -1); o.echeance = pts(fcScoreRisque(d, auj), 'Échéance du dossier');
    DATA.evenements_fonciers.forEach(function (e) { e.date = fcAjouterJours(auj, -40) + 'T08:00:00Z'; }); o.inactif30 = pts(fcScoreRisque(d, auj), '30 jours');
    DATA.evenements_fonciers.forEach(function (e) { e.date = fcAjouterJours(auj, -20) + 'T08:00:00Z'; }); o.inactif14 = pts(fcScoreRisque(d, auj), '14 jours', 0) || pts(fcScoreRisque(d, auj), 'activité');
    DATA.pieces_foncieres.push({ id: 'p1', dossier_id: d.id, statut: 'a_verifier', depose_le: fcAjouterJours(auj, -10) + 'T08:00:00Z', expire_le: fcAjouterJours(auj, -1) });
    s = fcScoreRisque(d, auj); o.pieces = [pts(s, 'expiré'), pts(s, 'attente de contrôle')];
    DATA.missions_foncieres = [{ id: 'm1', dossier_id: d.id, statut: 'en_cours', echeance: fcAjouterJours(auj, -3) }]; o.mission = pts(fcScoreRisque(d, auj), 'mission');
    d.notes_debours = [{ id: 'n', numero: 'NDF-1', statut: 'emise', echeance: '2020-01-01' }]; o.note = pts(fcScoreRisque(d, auj), 'débours');
    DATA.params.fc_dependances = true; fcEtape(d, 'verification_references').statut = 'termine'; o.incoh = pts(fcScoreRisque(d, auj), 'incohérence');
    var tot = fcScoreRisque(d, auj); o.total = tot.score; o.somme = tot.motifs.reduce(function (a, m) { return a + m.points; }, 0); o.trie = tot.motifs.every(function (m, i, a) { return !i || a[i - 1].points >= m.points; }); o.niveau = tot.niveau[1];
    d.responsable_id = ''; o.sansResp = pts(fcScoreRisque(d, auj), 'responsable');
    d.statut = 'cloture'; o.clos = fcScoreRisque(d, auj).score; d.statut = 'annule'; o.annule = fcScoreRisque(d, auj).score;
    d.statut = 'bloque'; for (var i = 0; i < 8; i++) DATA.missions_foncieres.push({ id: 'mx' + i, dossier_id: d.id, statut: 'en_cours', echeance: fcAjouterJours(auj, -3) }); o.plafond = fcScoreRisque(d, auj).score;
    return o;
  });
  assert.equal(r.base, 0); assert.equal(r.bloque, 25); assert.deepEqual(r.retard, [10, 5, 3]); assert.equal(r.echeance, 10); assert.equal(r.inactif30, 15); assert.ok(r.inactif14 === 10);
  assert.deepEqual(r.pieces, [5, 5]); assert.equal(r.mission, 8); assert.equal(r.note, 10); assert.equal(r.incoh, 10);
  assert.equal(r.total, Math.min(100, r.somme)); assert.equal(r.trie, true); assert.equal(r.niveau, 'critique'); assert.equal(r.sansResp, 15); assert.equal(r.clos, 0); assert.equal(r.annule, 0); assert.equal(r.plafond, 100);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('niveaux et classement : seuils, filtre par responsable, minimum', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, async () => {
    var o = {}, auj = fcAuj();
    o.niv = [0, 19, 20, 44, 45, 69, 70, 100].map(function (s) { return fcNiveauRisque(s)[1]; });
    var g = fcDossier(window.__g); g.responsable_id = 'u1';
    var d2 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'regularisation', responsable_id: 'u2' })).dossier;
    d2.statut = 'bloque'; fcEtape(d2, 'creation_dossier').statut = 'en_cours'; fcEtape(d2, 'creation_dossier').date_cible = fcAjouterJours(auj, -30);
    var l = fcDossiersARisque(auj, { min: 1 }); o.liste = l.map(function (x) { return x.dossier.reference === d2.reference ? 'd2:' + x.risque.score : 'autre'; });
    o.u1 = fcDossiersARisque(auj, { min: 1, responsable_id: 'u1' }).length; o.u2 = fcDossiersARisque(auj, { min: 1, responsable_id: 'u2' }).length; o.min = fcDossiersARisque(auj, { min: 99 }).length;
    var ctx = fcContexteRisque(); o.coherent = fcScoreRisque(d2, auj, ctx).score === fcScoreRisque(d2, auj).score;
    return o;
  });
  assert.deepEqual(r.niv, ['faible', 'faible', 'modere', 'modere', 'eleve', 'eleve', 'critique', 'critique']); assert.deepEqual(r.liste, ['d2:40']); assert.equal(r.u1, 0); assert.equal(r.u2, 1); assert.equal(r.min, 0); assert.equal(r.coherent, true);
});

test('interface : badge et tri dans la liste, panneau du dossier, vue Pilotage, export, rapport, Ma journée', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, async () => {
    var o = {}, auj = fcAuj(); APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'admin' };
    var g = fcDossier(window.__g); g.responsable_id = 'u1';
    var d2 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'regularisation', responsable_id: 'u1' })).dossier;
    d2.statut = 'bloque'; fcEtape(d2, 'creation_dossier').statut = 'en_cours'; fcEtape(d2, 'creation_dossier').date_cible = fcAjouterJours(auj, -30); fcEtape(d2, 'completude_documents').statut = 'en_cours'; fcEtape(d2, 'completude_documents').date_cible = fcAjouterJours(auj, -30);
    var s = fcScoreRisque(d2, auj); o.score = s.score;
    fcRender(); var liste = document.getElementById('fc-root').innerHTML; o.badge = liste.indexOf(s.score + ' · ' + s.niveau[2]) !== -1; o.bouton = /Trier par risque/.test(liste);
    APP._fcTriRisque = true; fcRender(); liste = document.getElementById('fc-root').innerHTML; o.tri = liste.indexOf(d2.reference) < liste.indexOf(g.reference); o.boutonTri = /Tri par date/.test(liste); APP._fcTriRisque = false;
    o.panneau = /Risque : /.test(fcPanneauRisque(d2)) && /Dossier bloqué/.test(fcPanneauRisque(d2)); fcDossier(d2.id).statut = 'cloture'; o.panneauClos = fcPanneauRisque(fcDossier(d2.id)); fcDossier(d2.id).statut = 'bloque';
    var h = document.getElementById('fp-root'); APP._fpVue = 'risques'; fcRenderPilotage(); o.vue = /Dossiers à risque/.test(h.innerHTML) && h.innerHTML.indexOf(d2.reference) !== -1 && /ne qualifie ni un intervenant/.test(h.innerHTML);
    window.fcTelechargerTexte = function (n, t) { window.__dl = { n: n, t: t }; }; fcExporterPilotageUI('risques', 'csv'); o.csv = window.__dl.n.indexOf('foncier-risques-') === 0 && window.__dl.t.indexOf(d2.reference) !== -1 && /Facteurs/.test(window.__dl.t);
    var rap = fcRapportPeriodique('mois', 0).lignes.find(function (l) { return l[0] === 'Dossiers à risque élevé ou critique'; }); o.rapport = rap && rap[1] >= 1;
    var j = fcMaJournee('u1', auj); o.journee = j.risque.length === 1 && /Risque/.test(j.risque[0].libelle); document.getElementById('fj-root'); fcRenderJournee(); o.journeeHtml = /Dossiers à surveiller en priorité/.test(document.getElementById('fj-root').innerHTML);
    return o;
  });
  assert.ok(r.score >= 45, 'score ' + r.score); for (const k of ['badge', 'bouton', 'tri', 'boutonTri', 'panneau', 'vue', 'csv', 'rapport', 'journee', 'journeeHtml']) assert.equal(!!r[k], true, k); assert.equal(r.panneauClos, '');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('performance : 2 000 dossiers évalués en moins de 2 secondes grâce aux index', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, () => {
    var auj = fcAuj(), ds = [], ev = [];
    for (var i = 0; i < 2000; i++) { var d = { id: 'q' + i, reference: 'DF-' + i, parcelle_id: 'p1', statut: i % 7 === 0 ? 'bloque' : 'en_cours', responsable_id: 'u1', type_procedure: 'acd', created_at: auj, etapes: fcEtapesPour('acd', '') }; d.etapes[0].statut = 'en_cours'; d.etapes[0].date_cible = fcAjouterJours(auj, -(i % 40)); ds.push(d); ev.push({ id: 'e' + i, dossier_id: d.id, date: auj + 'T08:00:00Z', type: 'ouverture' }); }
    DATA.dossiers_fonciers = ds; DATA.evenements_fonciers = ev;
    var t0 = performance.now(), l = fcDossiersARisque(auj, { min: 1 }); return { n: l.length, ms: performance.now() - t0, tri: l[0].risque.score >= l[l.length - 1].risque.score };
  });
  assert.ok(r.n > 1000); assert.equal(r.tri, true); assert.ok(r.ms < 2000, r.ms + ' ms');
});
