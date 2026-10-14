/* Foncier Connect — refacturation au souscripteur : note de débours (prix coûtant), publication portail, encaissement en brouillard SYSCOHADA. */
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
async function dossierIndividuel(page) {
  return page.evaluate(async function () { var r = await fcOuvrirDossierIndividuel({ lot_id: 'l1', client_id: 'c1' }); return r.dossier.id; });
}
const run = (page, fn, arg) => page.evaluate(fn, arg || null);
async function avecFrais(app) {
  await preparer(app.page); const d = await dossierIndividuel(app.page);
  const ids = await run(app.page, async (d) => {
    var out = [];
    for (var o of [{ nature: 'honoraires_geometre', montant_ht: 300000, tva: 0, piece: 'G-1' }, { nature: 'frais_actes', montant_ht: 50000, tva: 0, piece: 'A-1' }, { nature: 'honoraires_notaire', montant_ht: 500000, tva: 90000, piece: 'N-1', charge: 'promoteur' }]) {
      var r = await fcAjouterFraisTitre(d, Object.assign({ charge: 'souscripteur', date: '2026-10-10', tiers_id: 'n1' }, o)); out.push(r.frais.id);
    }
    await fcComptabiliserFraisTitre(d, out[0]); await fcComptabiliserFraisTitre(d, out[2]);
    return out;
  }, d);
  return { d, ids };
}

test('émission : seuls frais souscripteur comptabilisés ; numéro NDF, total, document figé, frais verrouillés', async () => {
  const app = await ouvrirApp(); const { d, ids } = await avecFrais(app);
  const r = await run(app.page, async ([d, ids]) => {
    var o = {};
    o.aucun = (await fcEmettreNoteDebours(d, [])).erreur; o.nonCompta = (await fcEmettreNoteDebours(d, [ids[1]])).erreur; o.promoteur = (await fcEmettreNoteDebours(d, [ids[2]])).erreur;
    o.echPasse = (await fcEmettreNoteDebours(d, [ids[0]], { echeance: '2020-01-01' })).erreur; o.clientInvalide = (await fcEmettreNoteDebours(d, [ids[0]], { client_id: 'c2' })).erreur;
    var e = await fcEmettreNoteDebours(d, [ids[0]]); o.ok = e.ok; o.num = e.note.numero; o.montant = e.note.montant; o.statut = e.note.statut; o.pub = e.note.publie_portail;
    o.html = e.note.html.indexOf('NOTE DE DÉBOURS') > -1 && e.note.html.indexOf('prix coûtant') > -1 && e.note.html.indexOf('G-1') > -1;
    o.deja = (await fcEmettreNoteDebours(d, [ids[0]])).erreur; o.aRef = fcFraisARefacturer(fcDossier(d)).length;
    DATA.params.comptes_defaut.titre_honoraires_geometre = '6324'; await fcComptabiliserFraisTitre(d, ids[1]);
    var e2 = await fcEmettreNoteDebours(d, [ids[1]]); o.num2 = e2.note.numero; o.syn = fcSyntheseFraisTitre(fcDossier(d));
    return o;
  }, [d, ids]);
  assert.match(r.aucun, /au moins un frais/); assert.match(r.nonCompta, /Comptabilisez/); assert.match(r.promoteur, /avancés pour le souscripteur/); assert.match(r.echPasse, /Échéance invalide/); assert.match(r.clientInvalide, /destinataire invalide/);
  assert.equal(r.ok, true); assert.match(r.num, /^NDF-\d{4}-0001$/); assert.match(r.num2, /-0002$/); assert.equal(r.montant, 300000); assert.equal(r.statut, 'emise'); assert.equal(r.pub, false); assert.equal(r.html, true);
  assert.match(r.deja, /déjà/); assert.equal(r.aRef, 0); assert.equal(r.syn.refacture, 350000); assert.equal(r.syn.a_refacturer, 0);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('annulation : motif requis, libère les frais ; interdite après encaissement ; droit de gestion requis', async () => {
  const app = await ouvrirApp(); const { d, ids } = await avecFrais(app);
  const r = await run(app.page, async ([d, ids]) => {
    var o = {}, n = (await fcEmettreNoteDebours(d, [ids[0]])).note;
    o.sansMotif = (await fcAnnulerNoteDebours(d, n.id, ' ')).erreur;
    APP.currentUser = { id: 'u2', nom: 'Compta', role: 'comptable' }; o.droit = (await fcAnnulerNoteDebours(d, n.id, 'x')).erreur; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    o.ok = (await fcAnnulerNoteDebours(d, n.id, 'erreur de saisie')).ok; o.libre = fcFraisARefacturer(fcDossier(d)).length; o.deux = (await fcAnnulerNoteDebours(d, n.id, 'x')).erreur;
    var n2 = (await fcEmettreNoteDebours(d, [ids[0]])).note; await fcEncaisserNoteDebours(d, n2.id, { mode: 'virement', date: fcAuj() }); o.encaissee = (await fcAnnulerNoteDebours(d, n2.id, 'x')).erreur;
    return o;
  }, [d, ids]);
  assert.match(r.sansMotif, /motif/); assert.match(r.droit, /responsable/); assert.equal(r.ok, true); assert.equal(r.libre, 1); assert.match(r.deux, /déjà annulée/); assert.match(r.encaissee, /encaissée/);
});

test('publication portail : notification externe dédupliquée, retrait possible, note annulée non publiable', async () => {
  const app = await ouvrirApp(); const { d, ids } = await avecFrais(app);
  const r = await run(app.page, async ([d, ids]) => {
    var o = {}, n = (await fcEmettreNoteDebours(d, [ids[0]])).note; DATA.notifications_foncieres = []; DATA.clients[0].email = 'j@x.ci';
    var p1 = await fcPublierNoteDebours(d, n.id, true); o.p1 = p1.ok; o.prevenu1 = p1.prevenu; o.pub = fcNoteDebours(fcDossier(d), n.id).publie_portail;
    var p2 = await fcPublierNoteDebours(d, n.id, true); o.prevenu2 = p2.prevenu;
    o.notifs = DATA.notifications_foncieres.filter(function (x) { return String(x.dedup || '').indexOf('debours:' + n.id) === 0; }).length;
    await fcPublierNoteDebours(d, n.id, false); o.retire = fcNoteDebours(fcDossier(d), n.id).publie_portail;
    await fcAnnulerNoteDebours(d, n.id, 'x'); o.annulee = (await fcPublierNoteDebours(d, n.id, true)).erreur;
    return o;
  }, [d, ids]);
  assert.equal(r.p1, true); assert.equal(r.prevenu1, true); assert.equal(r.pub, true); assert.equal(r.prevenu2, false); assert.equal(r.notifs, 1); assert.equal(r.retire, false); assert.match(r.annulee, /annulée/);
});

test('encaissement : D trésorerie / C 4111 en brouillard, équilibré, idempotent ; comptes et droits requis', async () => {
  const app = await ouvrirApp(); const { d, ids } = await avecFrais(app);
  const r = await run(app.page, async ([d, ids]) => {
    var o = {}, n = (await fcEmettreNoteDebours(d, [ids[0]])).note;
    o.mode = (await fcEncaisserNoteDebours(d, n.id, { mode: 'troc', date: fcAuj() })).erreur; o.date = (await fcEncaisserNoteDebours(d, n.id, { mode: 'especes', date: '2000-01-01' })).erreur;
    var cd = DATA.params.comptes_defaut.titre_avances_souscripteur; DATA.params.comptes_defaut.titre_avances_souscripteur = ''; o.sansCompte = (await fcEncaisserNoteDebours(d, n.id, { mode: 'virement', date: fcAuj() })).erreur; DATA.params.comptes_defaut.titre_avances_souscripteur = cd;
    var nb = DATA.ecritures.length;
    window.userPeutSurStore = function () { return false; }; o.droit = (await fcEncaisserNoteDebours(d, n.id, { mode: 'virement', date: fcAuj() })).erreur; window.userPeutSurStore = function () { return true; };
    var e = await fcEncaisserNoteDebours(d, n.id, { mode: 'virement', date: fcAuj() }); o.ok = e.ok; o.lignes = e.ecriture.lignes.map(function (l) { return [l.compte, l.sens, l.montant]; }); o.valide = !!e.ecriture.valide_le; o.type = e.ecriture.type;
    o.statut = fcNoteDebours(fcDossier(d), n.id).statut; o.deux = (await fcEncaisserNoteDebours(d, n.id, { mode: 'virement', date: fcAuj() })).erreur; o.nb = DATA.ecritures.length - nb; o.syn = fcSyntheseFraisTitre(fcDossier(d));
    return o;
  }, [d, ids]);
  assert.match(r.mode, /Mode de règlement/); assert.match(r.date, /Date d'encaissement/); assert.match(r.sansCompte, /non paramétré/); assert.match(r.droit, /droit de comptabiliser/);
  assert.equal(r.ok, true); assert.deepEqual(r.lignes, [['521', 'D', 300000], ['4111', 'C', 300000]]); assert.equal(r.valide, false); assert.equal(r.type, 'actif'); assert.equal(r.statut, 'encaissee');
  assert.match(r.deux, /Déjà encaissée/); assert.equal(r.nb, 1); assert.equal(r.syn.encaisse, 300000);
});

test('ERP : panneau de refacturation et actions visibles', async () => {
  const app = await ouvrirApp(); const { d, ids } = await avecFrais(app);
  const h = await run(app.page, async ([d, ids]) => {
    var a = fcPanneauFrais(fcDossier(d)); await fcEmettreNoteDebours(d, [ids[0]]); var b = fcPanneauFrais(fcDossier(d));
    return { avant: /Refacturation au souscripteur/.test(a) && /ff-rf/.test(a), apres: /NDF-\d{4}-0001/.test(b), fns: ['fcEmettreNoteUI', 'fcVoirNoteUI', 'fcPublierNoteUI', 'fcEncaisserNoteUI', 'fcAnnulerNoteUI'].every(function (f) { return typeof window[f] === 'function'; }) };
  }, [d, ids]);
  assert.equal(h.avant, true); assert.equal(h.apres, true); assert.equal(h.fns, true); assert.deepEqual(app.etat.erreursPage, []);
});
