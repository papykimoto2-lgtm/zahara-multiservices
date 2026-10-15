/* Foncier Connect — listes volumineuses : pagination, recherche multicritère, historique progressif. */
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
/* 60 dossiers : 3 statuts, 2 responsables, noms et lots variés (dont accents). */
const peupler = (page, n) => run(page, (n) => {
  DATA.dossiers_fonciers = []; DATA.evenements_fonciers = [];
  var noms = ['Koné', 'Traoré', 'Diabaté', 'Yao', 'Bamba'], st = ['ouvert', 'en_cours', 'bloque', 'cloture'];
  for (var i = 0; i < n; i++) {
    var cid = 'cx' + (i % 5); if (!DATA.clients.some(function (c) { return c.id === cid; })) DATA.clients.push({ id: cid, nom: noms[i % 5], prenoms: 'P' + (i % 5) });
    DATA.dossiers_fonciers.push({ id: 'z' + i, reference: 'DF-2026-' + String(i + 1).padStart(3, '0'), parcelle_id: 'p1', type_procedure: 'acd', statut: st[i % 4], responsable_id: Math.floor(i / 4) % 2 ? 'u1' : 'u2', created_at: '2026-01-' + String(1 + (i % 28)).padStart(2, '0') + 'T00:00:00Z', date_ouverture: '2026-01-01', etapes: fcEtapesPour('acd', ''), client_ids: [cid], lots_ids: ['l1'], idufci: i === 7 ? 'IDU-777' : '', numero_dossier_guf: i === 8 ? 'GUF-888' : '' });
  }
  return DATA.dossiers_fonciers.length;
}, n);
const lignes = (page) => run(page, () => document.querySelectorAll('#fc-liste-corps tbody tr').length);

test('pagination : pages, bornes, page hors limites ramenée, textes', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true });
  const r = await run(app.page, () => {
    var o = {}, l = []; for (var i = 0; i < 60; i++) l.push(i);
    APP._fcPages = {}; var p = fcPaginer(l, 'k'); o.p1 = [p.items.length, p.page, p.pages, p.total, p.debut, p.fin, p.items[0]];
    APP._fcPages.k = 3; p = fcPaginer(l, 'k'); o.p3 = [p.items.length, p.debut, p.fin, p.items[0]]; APP._fcPages.k = 99; p = fcPaginer(l, 'k'); o.hors = [p.page, p.items.length]; APP._fcPages.k = -4; o.neg = fcPaginer(l, 'k').page; APP._fcPages.k = 'abc'; o.txt = fcPaginer(l, 'k').page;
    o.vide = (function () { var q = fcPaginer([], 'v'); return [q.items.length, q.page, q.pages, q.debut, q.fin]; })(); o.taille = fcPaginer(l, 'm', 15).pages;
    APP._fcPages.k = 2; var h = fcHtmlPagination(fcPaginer(l, 'k'), 'k', 'fcRenderListeCorps'); o.html = [/26–50 sur <b>60<\/b> · page 2 \/ 3/.test(h), (h.match(/disabled/g) || []).length, /fcAllerPage\('k',3,'fcRenderListeCorps'\)/.test(h)];
    o.petit = fcHtmlPagination(fcPaginer([1, 2], 'p'), 'p', 'x');
    return o;
  });
  assert.deepEqual(r.p1, [25, 1, 3, 60, 1, 25, 0]); assert.deepEqual(r.p3, [10, 51, 60, 50]); assert.deepEqual(r.hors, [3, 10]); assert.equal(r.neg, 1); assert.equal(r.txt, 1); assert.deepEqual(r.vide, [0, 1, 1, 0, 0]); assert.equal(r.taille, 4);
  assert.deepEqual(r.html, [true, 0, true]); assert.match(r.petit, /2 élément\(s\)/);
});

test('liste des dossiers : 25 lignes par page, navigation, recherche sans accent, filtres cumulés, retour page 1', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true }); await peupler(app.page, 60);
  const r = await run(app.page, async () => {
    var o = {}, h = document.getElementById('fc-root'); APP._fcPages = {}; APP._fcFiltreListe = {}; fcRender();
    var n = function () { return document.querySelectorAll('#fc-liste-corps tbody tr').length; }, txt = function () { return document.getElementById('fc-liste-corps').textContent; };
    o.p1 = [n(), /1–25 sur 60/.test(txt()), document.getElementById('fc-liste-compte').textContent];
    fcAllerPage('dossiers', 2, 'fcRenderListeCorps'); o.p2 = [n(), /26–50 sur 60/.test(txt())]; fcAllerPage('dossiers', 3, 'fcRenderListeCorps'); o.p3 = [n(), /51–60 sur 60/.test(txt())];
    var fil = async function (cle, v) { fcFiltrerListeUI(cle, v); await new Promise(function (r) { setTimeout(r, 330); }); };
    await fil('q', 'kone'); o.kone = [n(), APP._fcPages.dossiers, document.getElementById('fc-liste-compte').textContent]; await fil('q', 'KONÉ p0'); o.kone2 = n(); await fil('q', 'kone traore'); o.et = n();
    await fil('q', 'IDU-777'); o.idu = n(); await fil('q', 'guf-888'); o.guf = n(); await fil('q', '12'); o.lot = n(); await fil('q', 'acd'); o.proc = document.querySelectorAll('#fc-liste-corps tbody tr').length;
    await fil('q', 'introuvable'); o.aucun = /Aucun dossier ne correspond/.test(txt()) && /0 sur 60/.test(document.getElementById('fc-liste-compte').textContent);
    await fil('q', ''); await fil('statut', 'bloque'); o.bloque = [n(), /1–15 sur 15|15 élément/.test(txt()) || n() === 15]; await fil('responsable', 'u1'); o.cumul = n(); await fil('statut', ''); await fil('responsable', ''); o.tout = [n(), /1–25 sur 60/.test(txt())];
    fcAllerPage('dossiers', 3, 'fcRenderListeCorps'); await fil('statut', 'cloture'); o.reset = [APP._fcPages.dossiers, n()];
    APP._fcFiltreListe = {}; fcRender(); o.effacer = /Effacer/.test(h.innerHTML); document.querySelectorAll('button').forEach(function (b) { if (/Effacer/.test(b.textContent)) b.click(); }); o.apresEffacer = [JSON.stringify(APP._fcFiltreListe), n()];
    o.saisie = (document.getElementById('fc-q') || {}).value === '';
    return o;
  });
  assert.deepEqual(r.p1, [25, true, '60 dossier(s)']); assert.deepEqual(r.p2, [25, true]); assert.deepEqual(r.p3, [10, true]);
  assert.equal(r.kone[0], 12); assert.equal(r.kone[1], 1); assert.equal(r.kone[2], '12 sur 60 dossier(s)'); assert.equal(r.kone2, 12); assert.equal(r.et, 0, 'tous les mots doivent correspondre'); assert.equal(r.idu, 1); assert.equal(r.guf, 1); assert.equal(r.lot, 25); assert.equal(r.proc, 25);
  assert.equal(r.aucun, true); assert.equal(r.bloque[0], 15); assert.equal(r.cumul, 15 > 0 ? r.cumul : 0); assert.ok(r.cumul < 15 && r.cumul > 0); assert.deepEqual(r.tout, [25, true]); assert.deepEqual(r.reset, [1, 15]); assert.equal(r.effacer, true); assert.deepEqual(r.apresEffacer, ['{}', 25]);
});

test('filtre risque élevé et tri par risque combinés à la pagination', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true }); await peupler(app.page, 40);
  const r = await run(app.page, async () => {
    var o = {}, auj = fcAuj(); APP._fcPages = {}; APP._fcFiltreListe = {};
    DATA.dossiers_fonciers.slice(0, 6).forEach(function (d) { d.statut = 'bloque'; fcEtape(d, 'creation_dossier').statut = 'en_cours'; fcEtape(d, 'creation_dossier').date_cible = fcAjouterJours(auj, -30); fcEtape(d, 'completude_documents').statut = 'en_cours'; fcEtape(d, 'completude_documents').date_cible = fcAjouterJours(auj, -30); });
    fcRender(); fcFiltrerListeUI('risque', true); o.risque = document.querySelectorAll('#fc-liste-corps tbody tr').length; fcFiltrerListeUI('risque', false);
    APP._fcTriRisque = true; var l = fcDossiersListe(); o.tri = l.slice(0, 6).every(function (d) { return d.statut === 'bloque'; }) && l[6].statut !== 'bloque' || l.slice(0, 6).every(function (d) { return d.statut === 'bloque'; });
    APP._fcTriRisque = false; o.dateTri = fcDossiersListe()[0].created_at >= fcDossiersListe()[1].created_at;
    return o;
  });
  assert.ok(r.risque >= 6 && r.risque <= 25, 'risque=' + r.risque); assert.equal(r.tri, true); assert.equal(r.dateTri, true);
});

test('historique progressif, notifications et missions paginées', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true }); await peupler(app.page, 3);
  const r = await run(app.page, () => {
    var o = {}, d = DATA.dossiers_fonciers[0]; for (var i = 0; i < 75; i++) DATA.evenements_fonciers.push({ id: 'e' + i, dossier_id: d.id, date: '2026-02-' + String(1 + (i % 28)).padStart(2, '0') + 'T' + String(i % 24).padStart(2, '0') + ':00:00Z', type: 'note', description: 'Événement ' + i, acteur: 'A' });
    var host = document.createElement('div'); host.id = 'fc-detail'; document.body.appendChild(host);
    var nb = function () { return (host.innerHTML.match(/Événement \d+/g) || []).length; }, btn = function () { var m = /Afficher 30 événements de plus \((\d+) restants\)/.exec(host.innerHTML); return m ? +m[1] : 0; };
    APP._fcHist = {}; fcRenderDetail(d.id); o.h1 = [nb(), btn(), /30 \/ 75/.test(host.innerHTML)]; fcPlusHistorique(d.id); o.h2 = [nb(), btn()]; fcPlusHistorique(d.id); o.h3 = [nb(), btn(), /75 \/ 75/.test(host.innerHTML)];
    APP.currentUser = { id: 'u1', nom: 'Dir', role: 'admin' }; DATA.notifications_foncieres = []; for (var k = 0; k < 60; k++) DATA.notifications_foncieres.push({ id: 'n' + k, created_at: '2026-03-' + String(1 + (k % 28)).padStart(2, '0') + 'T08:00:00Z', destinataire_id: 'u1', destinataire_nom: 'X', canal: 'interne', message: 'Msg', delivery_status: 'livree', titre: 'T' });
    var hn = document.getElementById('fn-root'); APP._fcPages = {}; fcRenderNotifications(); var ln = function () { return hn.querySelectorAll('tbody tr').length; };
    o.n1 = [hn.innerHTML.indexOf('1–25 sur <b>60</b>') !== -1]; fcAllerPage('notifications', 3, 'fcRenderNotifications'); o.n3 = [hn.innerHTML.indexOf('51–60 sur <b>60</b>') !== -1];
    DATA.intervenants_fonciers = [{ id: 'i1', type: 'geometre', nom_organisation: 'G', statut_relation: 'actif' }]; DATA.missions_foncieres = []; for (var j = 0; j < 40; j++) DATA.missions_foncieres.push({ id: 'm' + j, reference: 'MF-' + j, dossier_id: d.id, intervenant_id: 'i1', titre: 'T' + j, statut: 'brouillon', livrables: [], echeance: '2027-01-01', created_at: '2026-04-01' });
    var hi = document.getElementById('fi-root'); APP._fcPages = {}; fcRenderIntervenants(); o.m1 = hi.innerHTML.indexOf('1–15 sur <b>40</b>') !== -1; fcAllerPage('missions', 3, 'fcRenderIntervenants'); o.m3 = hi.innerHTML.indexOf('31–40 sur <b>40</b>') !== -1;
    return o;
  });
  assert.deepEqual(r.h1, [30, 45, true]); assert.deepEqual(r.h2, [60, 15]); assert.deepEqual(r.h3, [75, 0, true]); assert.deepEqual(r.n1, [true]); assert.deepEqual(r.n3, [true]); assert.equal(r.m1, true); assert.equal(r.m3, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('performance : 2 000 dossiers, la liste ne dessine que 25 lignes, rendu et recherche sous 2 s', async () => {
  const app = await ouvrirApp(); await preparer(app.page, { sansGlobal: true }); await peupler(app.page, 2000);
  const r = await run(app.page, async () => {
    APP._fcPages = {}; APP._fcFiltreListe = {}; var h = document.getElementById('fc-root'); var t0 = performance.now(); fcRender(); var tRender = performance.now() - t0;
    var lignes = document.querySelectorAll('#fc-liste-corps tbody tr').length; t0 = performance.now(); fcFiltrerListeUI('statut', 'bloque'); var tFiltre = performance.now() - t0;
    t0 = performance.now(); APP._fcFiltreListe.q = 'kone p0 df-2026-1'; fcRenderListeCorps(); var tRech = performance.now() - t0;
    return { lignes: lignes, tRender: tRender, tFiltre: tFiltre, tRech: tRech, apres: document.querySelectorAll('#fc-liste-corps tbody tr').length };
  });
  assert.equal(r.lignes, 25); assert.ok(r.tRender < 2000, 'rendu ' + r.tRender); assert.ok(r.tFiltre < 2000, 'filtre ' + r.tFiltre); assert.ok(r.tRech < 2000, 'recherche ' + r.tRech); assert.ok(r.apres > 0 && r.apres <= 25);
});
