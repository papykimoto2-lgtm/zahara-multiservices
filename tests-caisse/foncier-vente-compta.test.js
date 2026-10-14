/* Foncier Connect — lien vente ↔ titre ↔ comptabilité : ouverture automatique du dossier de titre individuel au solde,
   frais du titre (honoraires, droits) comptabilisés en brouillard SYSCOHADA. */
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
const solder = (page, id) => page.evaluate(async (id) => { DATA.versements = [{ id: 'v1', client_id: id, montant: 27000000, date: '2026-10-14', type: 'apport', statut: 'valide' }]; return await fcApresSolde(id); }, id);

test('souscripteur soldé + titre mère disponible : dossier individuel ouvert automatiquement, une seule fois', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await solder(app.page, 'c1');
  assert.equal(r.ok, true); assert.match(r.dossier.reference, /DF-/);
  const d = await run(app.page, () => { var i = DATA.dossiers_fonciers.filter(function (d) { return fcEstIndividuel(d); }); return { n: i.length, lots: i[0].lots_ids, cl: i[0].client_ids, ev: DATA.evenements_fonciers.filter(function (e) { return e.type === 'ouverture_auto'; }).length }; });
  assert.equal(d.n, 1); assert.deepEqual(d.lots, ['l1']); assert.deepEqual(d.cl, ['c1']); assert.equal(d.ev, 1);
  const r2 = await solder(app.page, 'c1'); assert.equal(r2.ok, false); assert.equal(r2.raison, 'dossier existant');
  assert.equal(await run(app.page, () => DATA.dossiers_fonciers.filter(function (d) { return fcEstIndividuel(d); }).length), 1);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('non soldé, sans parcelle, souscripteur résilié ou fonction désactivée : rien n\'est ouvert', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, async () => {
    var o = {}; DATA.versements = [{ id: 'v1', client_id: 'c1', montant: 1000, date: '2026-10-14', type: 'apport', statut: 'valide' }];
    o.nonSolde = (await fcApresSolde('c1')).raison;
    DATA.versements = [{ id: 'v2', client_id: 'c2', montant: 1000, date: '2026-10-14', type: 'apport', statut: 'valide' }]; o.sansParcelle = (await fcApresSolde('c2')).raison;
    DATA.versements = [{ id: 'v3', client_id: 'c1', montant: 27000000, date: '2026-10-14', type: 'apport', statut: 'valide' }];
    DATA.clients[0].statut = 'resilie'; o.resilie = (await fcApresSolde('c1')).raison; DATA.clients[0].statut = '';
    DATA.params.fc_ouverture_auto_solde = false; o.desactive = (await fcApresSolde('c1')).raison; DATA.params.fc_ouverture_auto_solde = undefined;
    o.dossiers = DATA.dossiers_fonciers.filter(function (d) { return fcEstIndividuel(d); }).length;
    return o;
  });
  assert.equal(r.nonSolde, 'non soldé'); assert.equal(r.sansParcelle, 'aucun lot rattaché à une parcelle'); assert.equal(r.resilie, 'souscripteur'); assert.equal(r.desactive, 'désactivé'); assert.equal(r.dossiers, 0);
});

test('titre mère indisponible (ou droits insuffisants) : pas d\'ouverture, le service Foncier est prévenu une seule fois', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, async () => {
    DATA.parcelles[0].statut = 'negociation'; DATA.versements = [{ id: 'v1', client_id: 'c1', montant: 27000000, date: '2026-10-14', type: 'apport', statut: 'valide' }];
    var a = await fcApresSolde('c1'), b = await fcApresSolde('c1');
    var n = DATA.notifications_foncieres.filter(function (x) { return x.template_code === 'solde_titre' && x.canal === 'interne'; });
    return { a: a, b: b.ok, dossiers: DATA.dossiers_fonciers.filter(function (d) { return fcEstIndividuel(d); }).length, notifs: n.length, dest: n.map(function (x) { return x.destinataire_id; }), msg: n[0] && n[0].message };
  });
  assert.equal(r.a.ok, false); assert.match(r.a.raison, /titre de l'opération n'est pas disponible/); assert.equal(r.dossiers, 0);
  assert.ok(r.notifs >= 1); assert.ok(r.dest.indexOf('u1') !== -1); assert.match(r.msg, /BENDE a soldé le prix initial/);
  const apres = await run(app.page, async () => { var avant = DATA.notifications_foncieres.length; await fcApresSolde('c1'); return DATA.notifications_foncieres.length - avant; });
  assert.equal(apres, 0, 'pas de nouvelle notification au 2e passage');
});

async function dossierIndividuel(page) {
  return page.evaluate(async function () {
    var r = await fcOuvrirDossierIndividuel({ lot_id: 'l1', client_id: 'c1' }); return r.dossier.id;
  });
}
const frais = (page, d, o) => page.evaluate(async ([d, o]) => (await fcAjouterFraisTitre(d, Object.assign({ nature: 'honoraires_notaire', montant_ht: 500000, tva: 90000, date: '2026-10-10', piece: 'FAC-001', charge: 'promoteur', tiers_id: 'n1' }, o || {}))), [d, o || {}]);

test('saisie des frais : pièce obligatoire, montants, TVA interdite sur les droits, dossier individuel seulement, droits', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const d = await dossierIndividuel(app.page);
  const r = {};
  r.ok = (await frais(app.page, d)).ok;
  r.sansPiece = (await frais(app.page, d, { piece: ' ' })).erreur; r.zero = (await frais(app.page, d, { montant_ht: 0 })).erreur; r.nature = (await frais(app.page, d, { nature: 'cadeau' })).erreur;
  r.tvaDroits = (await frais(app.page, d, { nature: 'droits_enregistrement', tva: 100 })).erreur; r.droitsOk = (await frais(app.page, d, { nature: 'droits_enregistrement', tva: 0, montant_ht: 1350000, piece: 'QUIT-9' })).ok;
  r.date = (await frais(app.page, d, { date: '10/10/2026' })).erreur; r.global = (await app.page.evaluate(async () => (await fcAjouterFraisTitre(window.__g, { nature: 'frais_actes', montant_ht: 1, date: '2026-10-10', piece: 'x' })).erreur));
  r.droit = await app.page.evaluate(async (d) => { APP.currentUser = { id: 'u2', nom: 'Compta', role: 'comptable' }; var x = await fcAjouterFraisTitre(d, { nature: 'frais_actes', montant_ht: 1000, date: '2026-10-10', piece: 'y' }); APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' }; return x.erreur; }, d);
  const syn = await run(app.page, (d) => fcSyntheseFraisTitre(fcDossier(d)), d);
  assert.equal(r.ok, true); assert.match(r.sansPiece, /pièce justificative/); assert.match(r.zero, /supérieur à 0/); assert.match(r.nature, /inconnue/); assert.match(r.tvaDroits, /ne portent pas de TVA/); assert.equal(r.droitsOk, true);
  assert.match(r.date, /Date de la pièce invalide/); assert.match(r.global, /titre individuel/); assert.match(r.droit, /responsable/);
  assert.equal(syn.promoteur, 590000 + 1350000); assert.equal(syn.a_regler, 1940000);
});

test('comptabilisation : D charge HT + D 4452 TVA / C 401 (brouillard) ; règlement D 401 / C trésorerie ; idempotent ; équilibré', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const d = await dossierIndividuel(app.page);
  const f = (await frais(app.page, d)).frais;
  const r = await run(app.page, async ([d, f]) => {
    var o = {}; var c1 = await fcComptabiliserFraisTitre(d, f); o.c1 = c1.ok; var e = c1.ecriture; o.ecr = { id: e.id, lignes: e.lignes.map(function (l) { return [l.compte, l.sens, l.montant]; }), type: e.type, valide: !!e.valide_le, division: e.division, piece: e.piece, tiers: e.tiers_id, montant: e.montant };
    o.d = e.lignes.filter(function (l) { return l.sens === 'D'; }).reduce(function (s, l) { return s + l.montant; }, 0); o.c = e.lignes.filter(function (l) { return l.sens === 'C'; }).reduce(function (s, l) { return s + l.montant; }, 0);
    o.deux = (await fcComptabiliserFraisTitre(d, f)).erreur; o.nb = DATA.ecritures.length;
    o.regSans = (await fcReglerFraisTitre(d, f, { mode: 'cheque_inconnu', date: '2026-10-20' })).erreur; o.regAvant = (await fcReglerFraisTitre(d, f, { mode: 'virement', date: '2026-10-01' })).erreur;
    var rg = await fcReglerFraisTitre(d, f, { mode: 'virement', date: '2026-10-20' }); o.reg = rg.ok; o.regLignes = rg.ecriture.lignes.map(function (l) { return [l.compte, l.sens, l.montant]; });
    o.statut = fcFrais(fcDossier(d), f).statut; o.deuxReg = (await fcReglerFraisTitre(d, f, { mode: 'virement', date: '2026-10-20' })).erreur; o.annul = (await fcAnnulerFraisTitre(d, f, 'x')).erreur; o.nbFinal = DATA.ecritures.length;
    return o;
  }, [d, f.id]);
  assert.equal(r.c1, true); assert.deepEqual(r.ecr.lignes, [['6324', 'D', 500000], ['4452', 'D', 90000], ['401', 'C', 590000]]); assert.equal(r.ecr.type, 'charge'); assert.equal(r.ecr.valide, false);
  assert.equal(r.ecr.division, 'dv1'); assert.equal(r.ecr.piece, 'FAC-001'); assert.equal(r.ecr.tiers, 'n1'); assert.equal(r.ecr.montant, 590000); assert.equal(r.d, r.c);
  assert.match(r.deux, /Déjà comptabilisé/); assert.equal(r.nb, 1); assert.match(r.regSans, /Mode de règlement inconnu/); assert.match(r.regAvant, /Date de règlement invalide/);
  assert.equal(r.reg, true); assert.deepEqual(r.regLignes, [['401', 'D', 590000], ['521', 'C', 590000]]); assert.equal(r.statut, 'paye'); assert.match(r.deuxReg, /Déjà réglé/); assert.match(r.annul, /contre-passation/); assert.equal(r.nbFinal, 2);
});

test('frais avancés pour le souscripteur : D 4111 / C 401 (à refacturer) ; droits d\'enregistrement en 646 sans TVA', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const d = await dossierIndividuel(app.page);
  const a = (await frais(app.page, d, { charge: 'souscripteur', nature: 'honoraires_geometre', tva: 0, montant_ht: 300000, piece: 'G-1' })).frais;
  const b = (await frais(app.page, d, { nature: 'droits_enregistrement', tva: 0, montant_ht: 1350000, piece: 'Q-1', tiers_id: '' })).frais;
  const r = await run(app.page, async ([d, a, b]) => ({ a: (await fcComptabiliserFraisTitre(d, a)).ecriture, b: (await fcComptabiliserFraisTitre(d, b)).ecriture, syn: fcSyntheseFraisTitre(fcDossier(d)) }), [d, a.id, b.id]);
  assert.deepEqual(r.a.lignes.map(function (l) { return [l.compte, l.sens, l.montant]; }), [['4111', 'D', 300000], ['401', 'C', 300000]]); assert.equal(r.a.type, 'actif');
  assert.deepEqual(r.b.lignes.map(function (l) { return [l.compte, l.sens, l.montant]; }), [['646', 'D', 1350000], ['401', 'C', 1350000]]);
  assert.equal(r.syn.souscripteur, 300000); assert.equal(r.syn.promoteur, 1350000);
});

test('comptes non paramétrés : refus clair, aucune écriture ; droit Comptabilité requis ; annulation avant comptabilisation', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansComptes: true }); const d = await dossierIndividuel(app.page);
  const f = (await frais(app.page, d)).frais;
  const r = await run(app.page, async ([d, f]) => {
    var o = {}; o.sansCompte = await fcComptabiliserFraisTitre(d, f); o.nb = DATA.ecritures.length;
    window.userPeutSurStore = function (s) { return s !== 'ecritures'; }; o.sansDroit = (await fcComptabiliserFraisTitre(d, f)).erreur; window.userPeutSurStore = function () { return true; };
    o.motif = (await fcAnnulerFraisTitre(d, f, ' ')).erreur; o.annule = (await fcAnnulerFraisTitre(d, f, 'Doublon')).ok; o.statut = fcFrais(fcDossier(d), f).statut;
    o.syn = fcSyntheseFraisTitre(fcDossier(d)); o.panneau = fcPanneauFrais(fcDossier(d)); return o;
  }, [d, f.id]);
  assert.equal(r.sansCompte.ok, false); assert.match(r.sansCompte.erreur, /Compte non paramétré/); assert.equal(r.nb, 0); assert.match(r.sansDroit, /Comptabilité/); assert.match(r.motif, /motif/);
  assert.equal(r.annule, true); assert.equal(r.statut, 'annule'); assert.equal(r.syn.promoteur, 0); assert.match(r.panneau, /Frais du titre/); assert.match(r.panneau, /line-through/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('branchement : l\'enregistrement du dernier versement (attSoldeAuto) déclenche l\'ouverture du dossier de titre', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, async () => {
    window.attSoldeRafraichirUI = function () {}; window.renderLivAFaire = function () {};
    DATA.versements = [{ id: 'v1', client_id: 'c1', montant: 20000000, date: '2026-10-01', type: 'apport', statut: 'valide' }];
    attSoldeAuto('c1'); await new Promise(function (r) { setTimeout(r, 100); });
    var avant = DATA.dossiers_fonciers.filter(function (d) { return fcEstIndividuel(d); }).length;
    DATA.versements.push({ id: 'v2', client_id: 'c1', montant: 7000000, date: '2026-10-14', type: 'mensualite', statut: 'valide' });
    attSoldeAuto('c1'); await new Promise(function (r) { setTimeout(r, 300); });
    return { avant: avant, apres: DATA.dossiers_fonciers.filter(function (d) { return fcEstIndividuel(d); }).length, attestation: !!(DATA.clients[0].attestation_solde) };
  });
  assert.equal(r.avant, 0, 'pas encore soldé'); assert.equal(r.apres, 1, 'soldé : dossier ouvert'); assert.equal(r.attestation, true, 'l\'attestation de solde est aussi préparée');
  assert.deepEqual(app.etat.erreursPage, []);
});
