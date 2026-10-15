/* Foncier Connect — protection contre les modifications simultanées et contrôle de complétude à la clôture. */
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

test('concurrence : un enregistrement plus récent dans le cloud refuse la modification, sans rien écraser', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, async () => {
    var o = {}, id = window.__g; window.__pulls = [];
    window.syncPullStore = async function (s) { window.__pulls.push(s); };
    var base = fcDossier(id)._v || 0;
    window.sbFetch = async function () { return [{ id: id, data: { id: id, _v: base + 50, _modifie_par: 'Awa Koné' } }]; };
    var r1 = await fcChangerStatutEtape(id, 'creation_dossier', 'termine', {});
    o.conflit = [r1.ok, r1.conflit, /Awa Koné/.test(r1.erreur), /Rien n'a été écrasé/.test(r1.erreur)]; o.statut = fcEtape(fcDossier(id), 'creation_dossier').statut; o.pulls = window.__pulls.slice();
    window.sbFetch = async function () { return [{ id: id, data: { id: id, _v: 0 } }]; };
    var r2 = await fcChangerStatutEtape(id, 'creation_dossier', 'termine', {}); var d = fcDossier(id);
    o.ok = r2.ok; o.version = d._v > base; o.par = d._modifie_par;
    return o;
  });
  assert.deepEqual(r.conflit, [false, true, true, true]); assert.equal(r.statut, 'a_preparer'); assert.deepEqual(r.pulls, ['dossiers_fonciers']); assert.equal(r.ok, true); assert.equal(r.version, true); assert.equal(r.par, 'Resp Foncier');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('concurrence : jamais bloquant hors ligne, cloud muet ou en erreur ; désactivable ; pièces couvertes', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, async () => {
    var o = {}, id = window.__g; var plus = { id: id, data: { id: id, _v: 9999, _modifie_par: 'X' } };
    var essai = async function (code) { return (await fcChangerStatutEtape(id, code, 'en_cours', { derogation_ordre: true, motif: 'test' })).ok; };
    window.sbFetch = async function () { throw new Error('réseau'); }; o.erreur = await essai('completude_documents');
    window.sbFetch = async function () { return null; }; o.nul = await essai('identification_procedure');
    window.sbFetch = async function () { return [plus]; }; Object.defineProperty(navigator, 'onLine', { get: function () { return false; }, configurable: true }); o.horsLigne = await essai('verification_references'); delete navigator.onLine;
    DATA.params.fc_controle_concurrence = false; o.desactive = await essai('anomalies'); DATA.params.fc_controle_concurrence = undefined;
    o.defaut = fcControleConcurrenceActif();
    DATA.pieces_foncieres.push({ id: 'pc9', dossier_id: id, etape_code: 'creation_dossier', nom: 'a.pdf', statut: 'a_verifier', depose_par: { role: 'souscripteur', nom: 'J' }, depose_le: fcAuj() + 'T08:00:00Z', visibilite: 'interne' });
    var dp = await fcDecisionPiece('pc9', 'acceptee', ''); o.piece = [dp.ok, dp.conflit];
    return o;
  });
  assert.deepEqual([r.erreur, r.nul, r.horsLigne, r.desactive, r.defaut], [true, true, true, true, true]); assert.deepEqual(r.piece, [false, true]);
});

async function dossierPret(app) {
  await preparer(app.page);
  return run(app.page, () => {
    var d = fcDossier(window.__g); d.responsable_id = 'u1';
    d.etapes.forEach(function (e) { if (e.code !== 'cloture') { e.statut = 'termine'; e.justificatifs = e.justificatif_requis ? [{ id: 'j', reference: 'R', source: 'promoteur' }] : []; } });
    DATA.params.fc_controle_cloture = true;
    return d.id;
  });
}

test('clôture : points bloquants listés ; dérogation motivée du responsable, journalisée', async () => {
  const app = await ouvrirApp(); const id = await dossierPret(app);
  const r = await run(app.page, async (id) => {
    var o = {}, d = fcDossier(id);
    o.propre = fcControleCompletude(d).length;
    DATA.pieces_foncieres.push({ id: 'p1', dossier_id: id, statut: 'a_verifier', nom: 'a', depose_par: { role: 'souscripteur' } });
    DATA.missions_foncieres = [{ id: 'm1', dossier_id: id, statut: 'en_cours' }, { id: 'm2', dossier_id: id, statut: 'validee' }];
    DATA.demandes_fonciers = [{ id: 'x1', dossier_id: id, statut: 'nouvelle' }];
    d.controles = [{ code: 'c1', libelle: 'Concordance', statut: 'anomalie' }];
    o.codes = fcControleCompletude(d).map(function (x) { return x.code; });
    var a = await fcChangerStatutEtape(id, 'cloture', 'termine', {}); o.refus = [a.ok, a.completude, a.points.length, /Pièces à contrôler/.test(a.erreur)];
    o.sansMotif = (await fcChangerStatutEtape(id, 'cloture', 'termine', { derogation_completude: true })).erreur;
    APP.currentUser = { id: 'u2', nom: 'Compta', role: 'comptable' }; o.autre = (await fcChangerStatutEtape(id, 'cloture', 'termine', { derogation_completude: true, motif: 'urgent' })).erreur; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    o.panneau = /4 point\(s\) à traiter/.test(fcPanneauCompletude(fcDossier(id)));
    var ok = await fcChangerStatutEtape(id, 'cloture', 'termine', { derogation_completude: true, motif: 'Régularisé hors ERP' }); o.derog = [ok.ok, ok.derogation, fcDossier(id).statut];
    var ev = DATA.evenements_fonciers.filter(function (e) { return e.type === 'derogation'; }); o.ev = [ev.length, /contrôle de clôture/.test(ev[0].description), ev[0].motif];
    return o;
  }, id);
  assert.equal(r.propre, 0); assert.deepEqual(r.codes, ['pieces', 'missions', 'demandes', 'controles']); assert.deepEqual(r.refus, [false, true, 4, true]); assert.match(r.sansMotif, /exige un motif/); assert.match(r.autre, /responsable du dossier/);
  assert.equal(r.panneau, true); assert.deepEqual(r.derog, [true, true, 'cloture']); assert.deepEqual(r.ev, [1, true, 'Régularisé hors ERP']);
});

test('clôture : dossier propre se clôture sans dérogation ; réglage désactivable ; frais et notes du titre pour un titre individuel', async () => {
  const app = await ouvrirApp(); const id = await dossierPret(app);
  const r = await run(app.page, async (id) => {
    var o = {}, d = fcDossier(id);
    d.etapes.find(function (e) { return e.justificatif_requis; }).justificatifs = [];
    o.info = fcControleCompletude(d).map(function (x) { return x.code + ':' + x.bloquant; });
    var c = await fcChangerStatutEtape(id, 'cloture', 'termine', {}); o.propre = [c.ok, c.derogation, fcDossier(id).statut];
    var i = (await fcOuvrirDossierIndividuel({ lot_id: 'l1', client_id: 'c1' })).dossier; i.frais_titre = [{ id: 'f1', statut: 'saisi', nature: 'frais_actes', montant_ht: 1, tva: 0 }]; i.notes_debours = [{ id: 'n1', numero: 'NDF-1', statut: 'emise' }, { id: 'n2', numero: 'NDF-2', statut: 'annulee' }];
    o.indiv = fcControleCompletude(i).filter(function (x) { return x.bloquant; }).map(function (x) { return x.code + ':' + x.detail; });
    i.etapes.forEach(function (e) { if (e.code !== 'cloture') e.statut = 'termine'; });
    DATA.params.fc_controle_cloture = false; var l = await fcChangerStatutEtape(i.id, 'cloture', 'termine', {}); o.libre = [l.ok, i.statut]; DATA.params.fc_controle_cloture = undefined; o.defaut = fcControleClotureActif();
    return o;
  }, id);
  assert.deepEqual(r.info, ['justificatifs:false']); assert.deepEqual(r.propre, [true, false, 'cloture']); assert.equal(r.indiv.length, 2); assert.match(r.indiv[0], /^frais:1 frais/); assert.match(r.indiv[1], /^notes:NDF-1$/); assert.deepEqual(r.libre, [true, 'cloture']); assert.equal(r.defaut, true);
});

test('interface : réglages et statut de clôture depuis la liste déroulante (dérogation proposée)', async () => {
  const app = await ouvrirApp(); const id = await dossierPret(app);
  const r = await run(app.page, async (id) => {
    var o = {}; window.confirm = function () { return true; }; var rep = ['Motif UI']; window.prompt = function () { return rep.shift() || ''; };
    DATA.missions_foncieres = [{ id: 'm1', dossier_id: id, statut: 'en_cours' }];
    var h = document.getElementById('fm-root'); APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'admin' }; fcRenderModeles(); o.cases = /Contrôler la complétude à la clôture/.test(h.innerHTML) && /modifications simultanées/.test(h.innerHTML);
    await fcBasculerReglageUI('fc_controle_concurrence', false, 'Protection'); o.off = DATA.params.fc_controle_concurrence === false; await fcBasculerReglageUI('fc_controle_concurrence', true, 'Protection'); o.on = DATA.params.fc_controle_concurrence === true;
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    await fcStatutUI(id, 'cloture', { value: 'termine' }); o.cloture = fcDossier(id).statut; o.motif = DATA.evenements_fonciers.some(function (e) { return e.type === 'derogation' && e.motif === 'Motif UI'; });
    return o;
  }, id);
  assert.deepEqual(r, { cases: true, off: true, on: true, cloture: 'cloture', motif: true });
  assert.deepEqual(app.etat.erreursPage, []);
});
