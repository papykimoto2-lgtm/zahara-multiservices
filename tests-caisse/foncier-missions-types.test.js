/* Foncier Connect — missions types par type d'intervenant : catalogue, préremplissage, formulaire, éditeur. */
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
const monter = (page) => run(page, async () => {
  DATA.intervenants_fonciers = [{ id: 'g1', type: 'geometre', nom_organisation: 'Cabinet Géo', statut_relation: 'actif', email: 'g@x.ci' }, { id: 'n1', type: 'notaire', nom_organisation: 'Étude Koffi', statut_relation: 'actif', email: 'n@x.ci' }, { id: 'x1', type: 'autre', nom_organisation: 'Divers', statut_relation: 'actif', email: 'x@x.ci' }];
  DATA.missions_foncieres = [];
  var ind = (await fcOuvrirDossierIndividuel({ lot_id: 'l1', client_id: 'c1' })).dossier; return { glob: window.__g, ind: ind.id };
});

test('catalogue : chaque type a des missions types complètes, étapes valides, codes uniques', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, () => {
    var o = { types: Object.keys(FC_TYPES_INTERVENANT).filter(function (t) { return !FC_MODELES_MISSION_DEFAUT[t]; }), incompletes: [], etapesInvalides: [], doublons: [] }, codes = FC_ETAPES_REF.map(function (s) { return s[0]; });
    Object.keys(FC_MODELES_MISSION_DEFAUT).forEach(function (t) {
      var vus = {}; FC_MODELES_MISSION_DEFAUT[t].forEach(function (m) {
        if (vus[m.code]) o.doublons.push(t + ':' + m.code); vus[m.code] = true;
        if (m.code !== 'libre' && (!m.libelle || !m.titre || !(m.delai > 0) || !m.livrables.length || !m.description)) o.incompletes.push(t + ':' + m.code);
        if (m.etape && codes.indexOf(m.etape) === -1) o.etapesInvalides.push(t + ':' + m.etape);
      });
    });
    o.geometre = fcModelesMission('geometre').map(function (m) { return m.code; }); o.inconnu = fcModelesMission('inexistant')[0].code;
    return o;
  });
  assert.deepEqual(r.types, []); assert.deepEqual(r.incompletes, []); assert.deepEqual(r.etapesInvalides, []); assert.deepEqual(r.doublons, []); assert.deepEqual(r.geometre, ['bornage', 'morcellement', 'leve', 'identification_lot', 'contre_bornage']); assert.equal(r.inconnu, 'libre');
});

test('préremplissage : titre avec la référence, délai, étape seulement si elle existe encore dans le dossier', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob, ind } = await monter(app.page);
  const r = await run(app.page, ([glob, ind]) => {
    var o = {}, auj = fcAuj(), ref = fcDossier(glob).reference;
    var p = fcPreRemplirMission(glob, 'g1', 'bornage', auj); o.bornage = [p.titre === 'Bornage de la parcelle et plan de bornage — ' + ref, p.echeance === fcAjouterJours(auj, 21), p.etape_code, p.livrables.length, p.description.length > 20];
    o.horsDossier = fcPreRemplirMission(glob, 'n1', 'acte_mutation', auj).etape_code; o.individuel = fcPreRemplirMission(ind, 'n1', 'acte_mutation', auj).etape_code;
    fcEtape(fcDossier(glob), 'documents_techniques').statut = 'termine'; o.termine = fcPreRemplirMission(glob, 'g1', 'bornage', auj).etape_code;
    o.inconnu = fcPreRemplirMission(glob, 'g1', 'zzz', auj); o.mauvaisType = fcPreRemplirMission(glob, 'g1', 'acte_mutation', auj); o.sansDossier = fcPreRemplirMission('nope', 'g1', 'bornage', auj);
    o.copie = (function () { var a = fcPreRemplirMission(glob, 'g1', 'bornage', auj); a.livrables.push('x'); return fcPreRemplirMission(glob, 'g1', 'bornage', auj).livrables.length; })();
    return o;
  }, [glob, ind]);
  assert.deepEqual(r.bornage, [true, true, 'documents_techniques', 3, true]); assert.equal(r.horsDossier, ''); assert.equal(r.individuel, 'ind_acte_mutation'); assert.equal(r.termine, ''); assert.equal(r.inconnu, null); assert.equal(r.mauvaisType, null); assert.equal(r.sansDossier, null); assert.equal(r.copie, 3);
});

test('formulaire : les missions types suivent l\'intervenant ; un clic préremplit ; création et envoi', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob, ind } = await monter(app.page);
  const r = await run(app.page, async ([glob, ind]) => {
    var o = {}, g = function (id) { return document.getElementById(id); }; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'admin' };
    fcRenderIntervenants(); g('fi-m-dossier').value = glob; g('fi-m-interv').value = 'g1'; fcMajFormMission();
    o.chipsGeo = Array.prototype.map.call(document.querySelectorAll('#fi-m-modeles button'), function (b) { return b.textContent; }).length; o.vide = /Choisissez une mission type/.test(g('fi-m-livrables').innerHTML);
    g('fi-m-interv').value = 'n1'; fcMajFormMission(); o.chipsNot = /Acte de mutation/.test(g('fi-m-modeles').innerHTML) && !/Bornage/.test(g('fi-m-modeles').innerHTML);
    g('fi-m-interv').value = 'g1'; fcMajFormMission(); o.etapes = g('fi-m-etape').options.length > 5;
    fcAppliquerModeleMissionUI('bornage');
    o.champs = [/Bornage de la parcelle/.test(g('fi-m-titre').value), g('fi-m-desc').value.length > 20, g('fi-m-ech').value === fcAjouterJours(fcAuj(), 21), g('fi-m-etape').value, document.querySelectorAll('#fi-m-livrables input:checked').length, /Prérempli depuis « Bornage et plan de bornage »/.test(g('fi-m-info').textContent), g('fi-mt-bornage').className.indexOf('btn-primary') !== -1];
    document.querySelectorAll('#fi-m-livrables input')[2].checked = false; g('fi-m-livr').value = 'Photos du terrain ; Rapport de visite';
    await fcMissionUI(); var m = DATA.missions_foncieres[0];
    o.mission = [m.statut, m.modele, m.livrables.map(function (l) { return l.libelle; }).join('|'), m.description.length > 20, m.etape_code, m.echeance === fcAjouterJours(fcAuj(), 21)];
    g('fi-m-interv').value = 'n1'; g('fi-m-dossier').value = ind; fcMajFormMission(); fcAppliquerModeleMissionUI('acte_mutation'); o.etapeInd = g('fi-m-etape').value;
    await fcMissionUI(true); var m2 = DATA.missions_foncieres[1]; o.envoyee = [m2.statut, m2.modele, m2.livrables.length, m2.intervenant_id];
    g('fi-m-interv').value = 'x1'; fcMajFormMission(); fcAppliquerModeleMissionUI('libre'); g('fi-m-ech').value = fcAjouterJours(fcAuj(), 5); var avant = DATA.missions_foncieres.length; await fcMissionUI(); o.sansLivrable = DATA.missions_foncieres.length === avant;
    g('fi-m-livr').value = 'Rapport'; await fcMissionUI(); o.libre = [DATA.missions_foncieres.length === avant + 1, DATA.missions_foncieres[avant].modele];
    return o;
  }, [glob, ind]);
  assert.equal(r.chipsGeo, 5); assert.equal(r.vide, true); assert.equal(r.chipsNot, true); assert.equal(r.etapes, true);
  assert.deepEqual(r.champs, [true, true, true, 'documents_techniques', 3, true, true]);
  assert.deepEqual(r.mission, ['brouillon', 'bornage', 'Plan de bornage signé et daté|Procès-verbal de bornage|Photos du terrain|Rapport de visite', true, 'documents_techniques', true]);
  assert.equal(r.etapeInd, 'ind_acte_mutation'); assert.deepEqual(r.envoyee, ['envoyee', 'acte_mutation', 3, 'n1']); assert.equal(r.sansLivrable, true); assert.deepEqual(r.libre, [true, 'libre']);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('éditeur : réservé à la direction, validation, enregistrement par type, rétablissement', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob } = await monter(app.page);
  const r = await run(app.page, async (glob) => {
    var o = {}, g = function (id) { return document.getElementById(id); }; window.dbPut = async function () { return true; }; window.confirm = function () { return true; };
    APP.currentUser = { id: 'ux', nom: 'Agent', role: 'foncier' }; fcRenderIntervenants(); o.cache = !/Modèles de mission par type/.test(g('fi-root').innerHTML);
    await fcSauverModelesMissionUI(); o.refus = !DATA.params.fc_modeles_mission;
    APP.currentUser = { id: 'u1', nom: 'Dir', role: 'admin' }; APP._fmmType = 'geometre'; fcRenderIntervenants(); o.visible = /Modèles de mission par type/.test(g('fi-root').innerHTML) && document.querySelectorAll('#fmm-corps tr.fmm-l').length === 5;
    var l1 = document.querySelector('#fmm-corps tr.fmm-l'); l1.querySelector('.f-lib').value = 'Bornage rapide'; l1.querySelector('.f-delai').value = '9'; l1.querySelector('.f-liv').value = 'Plan\n\n PV  \n';
    document.querySelector('#fmm-corps').insertAdjacentHTML('beforeend', fcLigneModeleMissionHtml({})); var nouv = document.querySelectorAll('#fmm-corps tr.fmm-l')[5]; nouv.querySelector('.f-delai').value = '5';
    await fcSauverModelesMissionUI(); o.sansNom = !DATA.params.fc_modeles_mission;
    nouv.querySelector('.f-lib').value = 'Hors délai'; nouv.querySelector('.f-delai').value = '999'; await fcSauverModelesMissionUI(); o.delaiInvalide = !DATA.params.fc_modeles_mission;
    nouv.querySelector('.f-delai').value = '12'; nouv.querySelector('.f-liv').value = 'Rapport'; await fcSauverModelesMissionUI();
    var liste = DATA.params.fc_modeles_mission.geometre; o.sauve = [liste.length, liste[0].libelle, liste[0].delai, liste[0].livrables, liste[0].code, liste[5].libelle, liste[5].titre, /^m6_/.test(liste[5].code)];
    var p = fcPreRemplirMission(glob, 'g1', 'bornage', fcAuj()); o.prefill = [p.echeance === fcAjouterJours(fcAuj(), 9), p.livrables];
    o.autreType = fcModelesMission('notaire').length === 4; o.perso = /personnalisés/.test(g('fi-root').innerHTML);
    document.querySelectorAll('#fmm-corps tr.fmm-l')[5].querySelector('button').click(); o.suppression = document.querySelectorAll('#fmm-corps tr.fmm-l').length === 5;
    await fcRetablirModelesMissionUI(); o.retabli = [!DATA.params.fc_modeles_mission.geometre, fcModelesMission('geometre').length];
    return o;
  }, glob);
  assert.equal(r.cache, true); assert.equal(r.refus, true); assert.equal(r.visible, true); assert.equal(r.sansNom, true); assert.equal(r.delaiInvalide, true);
  assert.deepEqual(r.sauve, [6, 'Bornage rapide', 9, ['Plan', 'PV'], 'bornage', 'Hors délai', 'Hors délai', true]); assert.deepEqual(r.prefill, [true, ['Plan', 'PV']]); assert.equal(r.autreType, true); assert.equal(r.perso, true); assert.equal(r.suppression, true); assert.deepEqual(r.retabli, [true, 5]);
  assert.deepEqual(app.etat.erreursPage, []);
});
