/* Foncier Connect — pilotage : filtres, coûts du titre, rapport périodique (envoi direction, déduplication, automatisme). */
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

async function monter(app) {
  await preparer(app.page); const d = await dossierIndividuel(app.page);
  return run(app.page, async (d) => {
    DATA.programmes.push({ id: 'g2', nom: 'Autre programme' });
    DATA.parcelles.push({ id: 'p2', ref: 'PARC-2', programme_id: 'g2', statut: 'tf_definitif' });
    DATA.lots.push({ id: 'l9', parcelle_id: 'p2', numero: '1' });
    DATA.clients.push({ id: 'c9', nom: 'DIABATE', lot_id: 'l9', programme_id: 'g2', montant_total: 1000 });
    var g2 = (await fcOuvrirDossier({ parcelle_id: 'p2', type: 'acd', responsable_id: 'u1' })).dossier;
    var ri = await fcOuvrirDossierIndividuel({ lot_id: 'l9', client_id: 'c9' }); if (!ri.dossier) throw new Error('indiv: ' + ri.erreur); var i2 = ri.dossier;
    var ids = [];
    for (var o of [{ nature: 'honoraires_geometre', montant_ht: 300000, tva: 0, piece: 'G-1', charge: 'souscripteur' }, { nature: 'honoraires_notaire', montant_ht: 500000, tva: 90000, piece: 'N-1', charge: 'promoteur' }]) {
      var r = await fcAjouterFraisTitre(d, Object.assign({ date: '2026-09-10', tiers_id: 'n1' }, o)); if (!r.frais) throw new Error('frais: ' + r.erreur); ids.push(r.frais.id); await fcComptabiliserFraisTitre(d, r.frais.id);
    }
    var r2 = await fcAjouterFraisTitre(i2.id, { tiers_id: 'n1', nature: 'frais_actes', montant_ht: 40000, tva: 0, date: '2026-10-05', piece: 'X', charge: 'promoteur' }); if (!r2.frais) throw new Error('frais2: ' + r2.erreur); await fcComptabiliserFraisTitre(i2.id, r2.frais.id);
    fcDossier(g2.id).responsable_id = 'u2'; fcDossier(i2.id).responsable_id = 'u2';
    var n = (await fcEmettreNoteDebours(d, [ids[0]], { echeance: fcAuj() })).note;
    fcDossier(d).notes_debours[0].echeance = '2020-01-01';
    DATA.users.push({ id: 'u3', nom: 'Directeur', login: 'dg', role: 'dg', email: 'dg@x.ci' });
    return { d: d, i2: i2.id, note: n.id, g2: g2.id };
  }, d);
}

test('filtres : le périmètre restreint tous les calculs, puis les données sont restaurées', async () => {
  const app = await ouvrirApp(); await monter(app);
  const r = await run(app.page, () => {
    var o = {}, avant = DATA.dossiers_fonciers.length, ref = DATA.dossiers_fonciers;
    o.tout = fcAvecFiltre({}, function () { return fcSynthese(fcAuj()).total; });
    o.parcelle = fcAvecFiltre({ parcelle_id: 'p2' }, function () { return fcSynthese(fcAuj()).total + '/' + DATA.parcelles.length + '/' + DATA.missions_foncieres.length; });
    o.programme = fcAvecFiltre({ programme_id: 'g1' }, function () { return fcIndicateursCouts(fcAuj()).dossiers + '/' + fcIndicateursCouts(fcAuj()).total; });
    o.individuel = fcAvecFiltre({ niveau: 'individuel' }, function () { return fcDossiersActifs().length; });
    o.resp = fcAvecFiltre({ responsable_id: 'u2' }, function () { return fcDossiersActifs().map(function (d) { return d.responsable_id; }).join(','); });
    o.vide = fcAvecFiltre({ type_procedure: 'inconnue' }, function () { return fcSynthese(fcAuj()).total; });
    o.periode = fcAvecFiltre({ du: '2999-01-01' }, function () { return fcDossiersActifs().length; });
    try { fcAvecFiltre({ parcelle_id: 'p1' }, function () { throw new Error('boom'); }); } catch (e) { o.err = e.message; }
    o.restaure = DATA.dossiers_fonciers === ref && DATA.dossiers_fonciers.length === avant && DATA.parcelles.length === 2 && DATA.missions_foncieres === undefined || Array.isArray(DATA.missions_foncieres);
    o.libelle = fcLibelleFiltre({ programme_id: 'g1', niveau: 'individuel', du: '2026-01-01' });
    return o;
  });
  assert.equal(r.tout, 4); assert.match(r.parcelle, /^2\/1\//); assert.equal(r.programme, '1/' + (300000 + 590000)); assert.equal(r.individuel, 2); assert.equal(r.resp, 'u2,u2'); assert.equal(r.vide, 0); assert.equal(r.periode, 0);
  assert.equal(r.err, 'boom'); assert.equal(r.restaure, true); assert.match(r.libelle, /Programme : Résidence · Titres individuels · Ouverts du 2026-01-01/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('coûts : totaux, répartition promoteur/souscripteur, notes en retard, coût moyen indicatif', async () => {
  const app = await ouvrirApp(); await monter(app);
  const c = await run(app.page, () => { var x = fcIndicateursCouts(fcAuj()); return { dossiers: x.dossiers, total: x.total, prom: x.promoteur, sous: x.souscripteur, aref: x.a_refacturer, ret: x.en_retard, nat: x.par_nature, ops: Object.keys(x.par_operation).length, cout: x.cout_titre_remis, lignes: fcLignesCouts(fcAuj()).length, html: fcHtmlCouts(fcAuj()).length > 100 }; });
  assert.equal(c.dossiers, 2); assert.equal(c.total, 300000 + 590000 + 40000); assert.equal(c.prom, 630000); assert.equal(c.sous, 300000); assert.equal(c.aref, 0);
  assert.equal(c.ret.n, 1); assert.equal(c.ret.montant, 300000); assert.equal(c.ret.liste[0].client, 'Jean BENDE'); assert.ok(c.ret.liste[0].jours > 1000);
  assert.equal(c.nat['Frais d\'actes'] || c.nat[Object.keys(c.nat).find(k => /actes/i.test(k))], 40000); assert.equal(c.ops, 2); assert.equal(c.cout.n, 0); assert.ok(c.lignes > 10); assert.equal(c.html, true);
});

test('périodes : semaine, mois, trimestre, passage d\'année, décalages', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const p = await run(app.page, () => ({ m: fcPeriode('mois', -1, '2026-10-14'), m0: fcPeriode('mois', 0, '2026-10-14'), jan: fcPeriode('mois', -1, '2026-01-10'), s: fcPeriode('semaine', -1, '2026-10-14'), s0: fcPeriode('semaine', 0, '2026-10-18'), t: fcPeriode('trimestre', -1, '2026-10-14'), t1: fcPeriode('trimestre', -1, '2026-02-01'), def: fcPeriode('x', 0, '2026-02-10').type }));
  assert.deepEqual([p.m.du, p.m.au, p.m.cle, p.m.libelle], ['2026-09-01', '2026-09-30', 'mois:2026-09', 'Septembre 2026']); assert.deepEqual([p.m0.du, p.m0.au], ['2026-10-01', '2026-10-31']);
  assert.deepEqual([p.jan.du, p.jan.au], ['2025-12-01', '2025-12-31']); assert.deepEqual([p.s.du, p.s.au], ['2026-10-05', '2026-10-11']); assert.deepEqual([p.s0.du, p.s0.au], ['2026-10-12', '2026-10-18']);
  assert.deepEqual([p.t.du, p.t.au, p.t.cle], ['2026-07-01', '2026-09-30', 'trimestre:2026-T3']); assert.deepEqual([p.t1.du, p.t1.au, p.t1.cle], ['2025-10-01', '2025-12-31', 'trimestre:2025-T4']); assert.equal(p.def, 'mois');
});

test('rapport : activité de la période comparée à la précédente, situation, filtre appliqué', async () => {
  const app = await ouvrirApp(); await monter(app);
  const r = await run(app.page, () => {
    var o = {}, today = fcAuj(); DATA.dossiers_fonciers.forEach(function (d) { d.date_ouverture = today; });
    var cur = fcRapportPeriodique('mois', 0, today), pre = fcRapportPeriodique('mois', -1, today); var v = function (rap, lib) { var l = rap.lignes.find(function (x) { return x[0] === lib; }); return l ? [l[1], l[2]] : null; };
    o.ouverts = v(cur, 'Dossiers ouverts'); o.ouvertsPre = v(pre, 'Dossiers ouverts'); o.notesRetard = v(cur, 'Notes de débours en retard'); o.titre = cur.lignes[0][1] === cur.periode.libelle; o.resume = cur.resume;
    APP._fpFiltre = { parcelle_id: 'p2' }; var f = fcRapportPeriodique('mois', 0, today); o.filtre = f.lignes[1][1]; o.ouvertsFiltre = v(f, 'Dossiers ouverts')[0]; o.retardFiltre = v(f, 'Notes de débours en retard')[0]; APP._fpFiltre = {};
    return o;
  });
  assert.equal(r.ouverts[0], 4); assert.equal(r.ouvertsPre[0], 0); assert.equal(r.notesRetard[0], 1); assert.equal(r.titre, true); assert.match(r.resume, /notes en retard 1/);
  assert.match(r.filtre, /Parcelle : PARC-2/); assert.equal(r.ouvertsFiltre, 2); assert.equal(r.retardFiltre, 0);
});

test('envoi à la direction : destinataires direction seulement, une seule fois par période ; envoi automatique selon réglage', async () => {
  const app = await ouvrirApp(); await monter(app);
  const r = await run(app.page, async () => {
    var o = {}; DATA.notifications_foncieres = []; DATA.users.push({ id: 'u4', nom: 'Ancien DG', role: 'dg', statut: 'inactif' });
    o.dest = fcDestinatairesDirection().map(function (u) { return u.id; });
    var a = await fcEnvoyerRapportDirection('mois', -1); o.a = [a.ok, a.destinataires, a.creees]; var b = await fcEnvoyerRapportDirection('mois', -1); o.b = b.creees;
    o.msg = DATA.notifications_foncieres[0] && DATA.notifications_foncieres[0].message;
    o.sans = await fcRapportAuto(); DATA.params.fc_rapport_auto = 'mensuel'; DATA.notifications_foncieres = []; var au = await fcRapportAuto(); o.auto = au && au.creees; o.auto2 = (await fcRapportAuto()).creees;
    DATA.params.fc_rapport_auto = 'hebdo'; var hb = await fcRapportAuto(); o.hebdo = hb.periode.cle.indexOf('semaine:') === 0;
    DATA.params.fc_rapport_auto = 'n_importe_quoi'; o.invalide = await fcRapportAuto();
    return o;
  });
  assert.deepEqual(r.dest, ['u3']); assert.deepEqual(r.a, [true, 1, 1]); assert.equal(r.b, 0); assert.match(r.msg, /Rapport de pilotage foncier/); assert.equal(r.sans, null); assert.equal(r.auto, 1); assert.equal(r.auto2, 0); assert.equal(r.hebdo, true); assert.equal(r.invalide, null);
});

test('interface : onglets Coûts et Rapport réservés à la direction, filtres, réglage, exports', async () => {
  const app = await ouvrirApp(); await monter(app);
  const r = await run(app.page, () => {
    var o = {}; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'admin' }; var h = document.getElementById('fp-root');
    window.fcMsg = function (x) { window.__msg = x; }; window.fcTelechargerTexte = function (n, t) { window.__dl = { n: n, t: t }; };
    APP._fpVue = 'couts'; fcRenderPilotage(); o.couts = /Frais engagés/.test(h.innerHTML) && /Programme/.test(h.innerHTML);
    APP._fpVue = 'rapport'; fcRenderPilotage(); o.rapport = /Envoyer à la direction/.test(h.innerHTML) && /Envoi automatique/.test(h.innerHTML);
    fcMajFiltre('programme_id', 'g2'); o.filtre = APP._fpFiltre.programme_id === 'g2' && /Vue filtrée/.test(h.innerHTML);
    fcMajFiltre('parcelle_id', 'p1'); fcMajFiltre('programme_id', 'g2'); o.coherence = APP._fpFiltre.parcelle_id === ''; fcMajFiltre('inconnu', 'x'); o.inconnu = !('inconnu' in APP._fpFiltre);
    APP._fpFiltre = {}; APP._fpVue = 'couts'; fcExporterPilotageUI('couts', 'csv'); o.csv = window.__dl && /Frais engagés/.test(window.__dl.t) && window.__dl.n.indexOf('foncier-couts-') === 0;
    var role = 'admin'; APP.currentUser = { id: 'ux', nom: 'Agent', role: 'foncier' }; window.__dl = null; fcExporterPilotageUI('couts', 'csv'); o.refus = !window.__dl; APP._fpVue = 'couts'; fcRenderPilotage(); o.repli = APP._fpVue === 'promoteur'; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: role };
    var cfg = document.createElement('div'); cfg.innerHTML = ''; o.reglage = typeof fcSauverRelancesUI === 'function';
    return o;
  });
  for (const k of Object.keys(r)) assert.equal(r[k], true, k);
  assert.deepEqual(app.etat.erreursPage, []);
});
