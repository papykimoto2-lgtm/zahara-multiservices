/* Foncier Connect — échéances estimées d'après la durée habituelle observée (P75), modèle prioritaire, réglable, marquées « estimées ». */
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

/* Historique : 3 dossiers « acd » terminés avec des durées connues par étape (en jours) : depot 10/11/12, recepisse 2/4/6, reponse seulement 2 observations. */
function historique() {
  DATA.dossiers_fonciers = []; DATA.evenements_fonciers = [];
  var duree = { depot: [10, 11, 12], recepisse: [2, 4, 6], reponse: [3, 5] }, n = 0;
  [0, 1, 2].forEach(function (i) {
    var id = 'h' + i; DATA.dossiers_fonciers.push({ id: id, reference: 'DF-H' + i, type_procedure: 'acd', parcelle_id: 'p1', etapes: [], statut: 'cloture' });
    Object.keys(duree).forEach(function (code) {
      if (duree[code][i] == null) return;
      DATA.evenements_fonciers.push({ id: 'a' + (n++), dossier_id: id, etape_code: code, type: 'changement_statut', nouveau: 'en_cours', date: '2026-01-01T08:00:00Z' },
        { id: 'a' + (n++), dossier_id: id, etape_code: code, type: 'changement_statut', nouveau: 'termine', date: new Date(Date.UTC(2026, 0, 1 + duree[code][i], 8)).toISOString() });
    });
  });
}

test('statistiques : P75 arrondi au jour supérieur, moyenne et médiane, seuil de 3 observations', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, (h) => { eval('(' + h + ')')(); var s = fcDureesSuggerees('acd'); return { depot: s.depot, recepisse: s.recepisse, reponse: s.reponse || null, autre: fcDureesSuggerees('mutation'), p: [fcPercentile([1, 2, 3, 4], 0.75), fcPercentile([5], 0.5), fcPercentile([], 0.5)] }; }, historique.toString());
  assert.deepEqual(r.depot, { jours: 12, moyenne: 11, mediane: 11, n: 3 }); assert.deepEqual(r.recepisse, { jours: 6, moyenne: 4, mediane: 4, n: 3 }); assert.equal(r.reponse, null); assert.deepEqual(r.autre, {}); assert.deepEqual(r.p, [3, 5, 0]);
});

test('ouverture : échéances cumulées sur les durées habituelles, marquées estimées ; le modèle reste prioritaire', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, async (h) => {
    eval('(' + h + ')')(); var o = {}, auj = fcAuj();
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var dep = fcEtape(d, 'depot'), rec = fcEtape(d, 'recepisse'), rep = fcEtape(d, 'reponse');
    o.auto = [dep.date_cible === fcAjouterJours(auj, 12), dep.date_cible_auto, rec.date_cible === fcAjouterJours(auj, 18), rec.date_cible_auto, rep.date_cible, !!rep.date_cible_auto];
    o.final = d.date_cible === fcAjouterJours(auj, 18); o.ev = DATA.evenements_fonciers.filter(function (e) { return e.type === 'modele'; }).map(function (e) { return /dont 2 échéance\(s\) estimée\(s\)/.test(e.description); });
    DATA.params.fc_modeles = { acd: { actif: true, etapes: { depot: { jours: 5 } } } };
    var d2 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', forcer: true })).dossier;
    o.modele = [fcEtape(d2, 'depot').date_cible === fcAjouterJours(auj, 5), !!fcEtape(d2, 'depot').date_cible_auto, fcEtape(d2, 'recepisse').date_cible === fcAjouterJours(auj, 11), fcEtape(d2, 'recepisse').date_cible_auto];
    DATA.params.fc_modeles.acd.actif = false; var d3 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', forcer: true })).dossier; o.modeleInactif = [fcEtape(d3, 'depot').date_cible === fcAjouterJours(auj, 12), fcEtape(d3, 'depot').date_cible_auto];
    DATA.params.fc_delais_auto = false; var d4 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', forcer: true })).dossier; o.desactive = [fcEtape(d4, 'depot').date_cible, fcEtape(d4, 'recepisse').date_cible, d4.date_cible];
    DATA.params.fc_delais_auto = undefined; var d5 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', forcer: true, sans_modele: true })).dossier; o.sansModele = fcEtape(d5, 'depot').date_cible;
    var d6 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'mutation', responsable_id: 'u1' })).dossier; o.autreType = fcEtape(d6, 'depot') ? fcEtape(d6, 'depot').date_cible : '';
    return o;
  }, historique.toString());
  assert.deepEqual(r.auto, [true, true, true, true, '', false]); assert.equal(r.final, true); assert.deepEqual(r.ev, [true]);
  assert.deepEqual(r.modele, [true, false, true, true]); assert.deepEqual(r.modeleInactif, [true, true]); assert.deepEqual(r.desactive, ['', '', '']); assert.equal(r.sansModele, ''); assert.equal(r.autreType, '');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('saisie manuelle : suggestion proposée, échéance modifiée = plus « estimée » ; correction idem', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, async (h) => {
    eval('(' + h + ')')(); var o = {}, auj = fcAuj();
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier; var dep = function () { return fcEtape(fcDossier(d.id), 'depot'); };
    o.html = (function () { var host = document.createElement('div'); host.id = 'fc-detail'; document.body.appendChild(host); fcRenderDetail(d.id); return /📈 estimée/.test(host.innerHTML); })();
    var invites = []; window.prompt = function (msg, def) { invites.push([msg, def]); return def === undefined ? null : '2031-05-05'; };
    await fcEcheanceUI(d.id, 'depot'); o.invite = [/Suggestion : /.test(invites[0][0]), /durée habituelle 12 j sur 3 dossiers/.test(invites[0][0]), invites[0][1] === fcAjouterJours(auj, 12)];
    o.manuel = [dep().date_cible, !!dep().date_cible_auto];
    var rec = fcEtape(fcDossier(d.id), 'recepisse'); o.avant = !!rec.date_cible_auto; await fcCorrigerEtape(d.id, 'recepisse', { date_cible: '2031-06-06' }, 'ajustement'); o.apres = [fcEtape(fcDossier(d.id), 'recepisse').date_cible, !!fcEtape(fcDossier(d.id), 'recepisse').date_cible_auto];
    var sans = fcEtape(fcDossier(d.id), 'reponse'); invites.length = 0; await fcEcheanceUI(d.id, 'reponse'); o.sansHistorique = [!/Suggestion/.test(invites[0][0]), invites[0][1]];
    return o;
  }, historique.toString());
  assert.equal(r.html, true); assert.deepEqual(r.invite, [true, true, true]); assert.deepEqual(r.manuel, ['2031-05-05', false]); assert.equal(r.avant, true); assert.deepEqual(r.apres, ['2031-06-06', false]); assert.deepEqual(r.sansHistorique, [true, '']);
});

test('écran Modèles : durée observée toujours visible, réglage des échéances estimées', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, async (h) => {
    eval('(' + h + ')')(); var o = {}; APP.currentUser = { id: 'u1', nom: 'Dir', role: 'admin' }; APP._fmType = 'acd';
    var host = document.getElementById('fm-root'); fcRenderModeles(); o.observe = /12 j \(P75, 3 dossiers\)/.test(host.innerHTML) && /moyenne 11 j, médiane 11 j/.test(host.innerHTML); o.case = /Estimer les échéances d'après vos dossiers/.test(host.innerHTML);
    await fcBasculerReglageUI('fc_delais_auto', false, 'Échéances estimées'); o.off = DATA.params.fc_delais_auto === false; await fcBasculerReglageUI('fc_delais_auto', true, 'Échéances estimées'); o.on = fcDelaisAutoActif();
    fcProposerDureesUI(); o.propose = document.getElementById('fm-j-depot').value;
    return o;
  }, historique.toString());
  assert.deepEqual(r, { observe: true, case: true, off: true, on: true, propose: '12' });
});
