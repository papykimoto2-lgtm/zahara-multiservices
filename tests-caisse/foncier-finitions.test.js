/* Foncier Connect — finitions : archivage, actions groupées, Kanban, calendrier + ICS, budget du titre, décharge de remise, recherche globale. */
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
  DATA.clients[0].email = 'jean@x.ci';
  DATA.intervenants_fonciers = [{ id: 'g1', type: 'geometre', nom_organisation: 'Cabinet Géo', statut_relation: 'actif', email: 'g@x.ci' }]; DATA.missions_foncieres = [];
  var ind = (await fcOuvrirDossierIndividuel({ lot_id: 'l1', client_id: 'c1' })).dossier; ind.responsable_id = 'u1';
  return { glob: window.__g, ind: ind.id };
});
const mois = (n) => `(function(){ var d = new Date(); d.setUTCMonth(d.getUTCMonth() - ${n}); return d.toISOString().slice(0, 10); })()`;

test('archivage : dossiers archivables, règles, liste masquée, archivage en lot, sortie des archives', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob, ind } = await monter(app.page);
  const r = await run(app.page, async ([glob, ind]) => {
    var o = {}, vieux = new Date(); vieux.setUTCMonth(vieux.getUTCMonth() - 30); var recent = new Date(); recent.setUTCMonth(recent.getUTCMonth() - 10);
    var g = fcDossier(glob), i = fcDossier(ind); g.statut = 'cloture'; g.date_cloture = vieux.toISOString().slice(0, 10); i.statut = 'cloture'; i.date_cloture = recent.toISOString().slice(0, 10);
    var autre = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'regularisation', responsable_id: 'u1' })).dossier; autre.statut = 'annule'; autre.date_ouverture = vieux.toISOString().slice(0, 10);
    var ouvert = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'mutation', responsable_id: 'u1' })).dossier; ouvert.date_ouverture = vieux.toISOString().slice(0, 10);
    o.arch = fcDossiersArchivables().map(function (d) { return d.reference; }).sort().join() === [g.reference, autre.reference].sort().join(); o.mois = [fcArchivageMois(), (DATA.params.fc_archivage_mois = 12, fcArchivageMois()), (DATA.params.fc_archivage_mois = undefined, fcArchivageMois())]; o.ouvertRefuse = (await fcArchiverDossier(ouvert.id, true)).erreur;
    APP.currentUser = { id: 'u2', nom: 'Autre', role: 'comptable' }; o.droit = (await fcArchiverDossier(g.id, true)).erreur; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    var a = await fcArchiverDossier(g.id, true); o.a = [a.ok, g.archive, !!g.archive_le, DATA.evenements_fonciers.some(function (e) { return e.type === 'archivage' && /archivé/.test(e.description); })]; o.idem = (await fcArchiverDossier(g.id, true)).inchange;
    APP._fcFiltreListe = {}; APP._fcPages = {}; fcRender(); var lignes = function () { return Array.prototype.map.call(document.querySelectorAll('#fc-liste-corps tbody tr strong'), function (x) { return x.textContent; }); };
    o.masque = lignes().indexOf(g.reference) === -1; fcFiltrerListeUI('archives', true); o.inclus = lignes().indexOf(g.reference) !== -1 && /archivé/.test(document.getElementById('fc-liste-corps').innerHTML); fcFiltrerListeUI('archives', false);
    o.bouton = /Archiver les dossiers clos depuis plus de 24 mois \(1\)/.test(document.getElementById('fc-root').innerHTML);
    window.confirm = function () { return true; }; await fcArchiverAnciensUI(); o.lot = [autre.archive, !!i.archive];
    var host = document.getElementById('fc-detail'); fcRenderDetail(g.id); o.panneau = /Dossier <b>archivé<\/b>/.test(host.innerHTML);
    await fcArchiverUI(g.id, false); o.sortie = [g.archive, /Archiver ce dossier/.test(host.innerHTML)];
    return o;
  }, [glob, ind]);
  assert.equal(r.arch, true); assert.deepEqual(r.mois, [24, 12, 24]); assert.match(r.ouvertRefuse, /clôturé ou annulé/); assert.match(r.droit, /responsable du dossier/); assert.deepEqual(r.a, [true, true, true, true]); assert.equal(r.idem, true);
  assert.equal(r.masque, true); assert.equal(r.inclus, true); assert.equal(r.bouton, true); assert.deepEqual(r.lot, [true, false]); assert.equal(r.panneau, true); assert.deepEqual(r.sortie, [false, true]);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('actions groupées : sélection, réaffectation, priorité, échéance, refus par dossier rapportés', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob, ind } = await monter(app.page);
  const r = await run(app.page, async ([glob, ind]) => {
    var o = {}, auj = fcAuj(); var d3 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'mutation', responsable_id: 'u1' })).dossier; d3.statut = 'cloture';
    o.vide = (await fcActionGroupeDossiers([], { priorite: 'haute' })).erreur;
    var a = await fcActionGroupeDossiers([glob, ind, d3.id, 'inconnu', glob], { priorite: 'haute' }); o.prio = [a.reussis, a.echecs.length, fcDossier(glob).priorite, fcDossier(ind).priorite, a.echecs.map(function (e) { return e.reference; }).sort().join() === [d3.reference, 'inconnu'].sort().join()];
    var b = await fcActionGroupeDossiers([glob, ind], { priorite: 'haute' }); o.inchange = [b.reussis, b.inchanges];
    o.respInconnu = (await fcActionGroupeDossiers([glob], { responsable_id: 'zzz' })).echecs[0].erreur; o.date = (await fcActionGroupeDossiers([glob], { date_cible: '31/12/2026' })).echecs[0].erreur; var dd = await fcActionGroupeDossiers([glob, ind], { date_cible: '2031-01-15' }); o.dateOk = [dd.reussis, fcDossier(ind).date_cible];
    var c = await fcActionGroupeDossiers([glob, ind], { responsable_id: 'u2' }); o.resp = [c.reussis, fcDossier(glob).responsable_id, fcDossier(ind).responsable_id];
    fcDossier(glob).responsable_id = 'u1'; fcDossier(ind).responsable_id = 'u1';
    APP.currentUser = { id: 'u9', nom: 'X', role: 'comptable' }; o.droit = (await fcActionGroupeDossiers([glob], { priorite: 'basse' })).echecs[0].erreur; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'admin' };
    // interface
    APP._fcFiltreListe = {}; APP._fcPages = {}; APP._fcSelect = {}; fcRender(); var zone = document.getElementById('fc-barre-groupee'); o.sansSel = zone.innerHTML === '';
    document.querySelector('input.fc-ck-d[value="' + glob + '"]').click(); document.querySelector('input.fc-ck-d[value="' + ind + '"]').click(); o.barre = [/2 dossier\(s\) sélectionné\(s\)/.test(zone.innerHTML), document.querySelectorAll('#fc-liste-corps input.fc-ck-d:checked').length >= 2];
    document.getElementById('fc-g-prio').value = 'basse'; await fcGroupeUI('priorite', 'fc-g-prio'); o.ui = [fcDossier(glob).priorite, fcDossier(ind).priorite];
    document.getElementById('fc-g-resp').value = ''; await fcGroupeUI('responsable_id', 'fc-g-resp'); o.sansValeur = true;
    fcCocherPageUI(false); o.page = fcSelectionListe().length; fcCocherPageUI(true); o.page2 = fcSelectionListe().length; APP._fcSelect = {}; fcMajBarreGroupee(); o.efface = document.getElementById('fc-barre-groupee').innerHTML === '';
    return o;
  }, [glob, ind]);
  assert.match(r.vide, /au moins un dossier/); assert.deepEqual(r.prio, [2, 2, 'haute', 'haute', true]); assert.deepEqual(r.inchange, [0, 2]); assert.deepEqual(r.resp, [2, 'u2', 'u2']); assert.match(r.respInconnu, /Responsable inconnu/); assert.match(r.date, /invalide/); assert.deepEqual(r.dateOk, [2, '2031-01-15']);
  assert.match(r.droit, /responsable du dossier/); assert.equal(r.sansSel, true); assert.deepEqual(r.barre, [true, true]); assert.deepEqual(r.ui, ['basse', 'basse']); assert.equal(r.page, 0); assert.ok(r.page2 >= 3); assert.equal(r.efface, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('Kanban : colonnes par statut, filtre responsable, déplacement avec les règles de l’étape', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob, ind } = await monter(app.page);
  const r = await run(app.page, async ([glob, ind]) => {
    var o = {}, g = fcDossier(glob), i = fcDossier(ind); DATA.params.fc_dependances = false;
    var cols = fcCartesKanban(); o.initial = [cols.a_preparer.length, cols.en_cours.length]; 
    fcEtape(g, 'creation_dossier').statut = 'en_cours'; fcEtape(i, 'creation_dossier').statut = 'attente_document'; i.responsable_id = 'u2'; fcEtape(i, 'creation_dossier').responsable_id = 'u2';
    cols = fcCartesKanban(); o.cols = [cols.en_cours.map(function (x) { return x.dossier.id; }).indexOf(glob) !== -1, cols.attente_document.length, cols.bloque.length];
    o.moi = fcCartesKanban({ responsable: 'u1' }).en_cours.length + fcCartesKanban({ responsable: 'u1' }).attente_document.length; o.autre = fcCartesKanban({ responsable: 'u2' }).attente_document.length;
    var arch = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'mutation', responsable_id: 'u1' })).dossier; var avant = Object.keys(fcCartesKanban()).reduce(function (s, k) { return s + fcCartesKanban()[k].length; }, 0); arch.archive = true; var apres = Object.keys(fcCartesKanban()).reduce(function (s, k) { return s + fcCartesKanban()[k].length; }, 0); o.archive = avant - apres;
    var h = document.getElementById('fk-root'); APP._fkFiltre = ''; fcRenderKanban(); o.rendu = [h.querySelectorAll('.fk-col').length, h.querySelectorAll('.fk-carte').length >= 2, /Déplacer vers/.test(h.innerHTML), /draggable="true"/.test(h.innerHTML)];
    window.confirm = function () { return true; }; var rep = []; window.prompt = function () { return rep.shift() || ''; };
    await fcDeplacerCarteUI(glob, 'creation_dossier', 'attente_intervenant'); o.deplace = fcEtape(fcDossier(glob), 'creation_dossier').statut;
    rep = ['Bloqué par un tiers']; await fcDeplacerCarteUI(glob, 'creation_dossier', 'bloque'); o.bloque = [fcEtape(fcDossier(glob), 'creation_dossier').statut, fcEtape(fcDossier(glob), 'creation_dossier').motif];
    var ev = { preventDefault: function () {}, dataTransfer: { getData: function () { return glob + '|creation_dossier'; } } }; fcDossier(glob).etapes[0].statut = 'en_cours'; await fcDeposerCarteUI(ev, 'attente_administration'); o.drop = fcEtape(fcDossier(glob), 'creation_dossier').statut;
    var ev2 = { preventDefault: function () {}, dataTransfer: { getData: function () { return 'mauvais'; } } }; await fcDeposerCarteUI(ev2, 'en_cours'); o.dropInvalide = true;
    return o;
  }, [glob, ind]);
  assert.deepEqual(r.initial, [2, 0]); assert.deepEqual(r.cols, [true, 1, 0]); assert.equal(r.moi, 1); assert.equal(r.autre, 1); assert.equal(r.archive, 1); assert.deepEqual(r.rendu, [7, true, true, true]);
  assert.equal(r.deplace, 'attente_intervenant'); assert.deepEqual(r.bloque, ['bloque', 'Bloqué par un tiers']); assert.equal(r.drop, 'attente_administration'); assert.equal(r.dropInvalide, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('calendrier : échéances du mois par type, filtre, grille, navigation, export ICS valide', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob, ind } = await monter(app.page);
  const r = await run(app.page, async ([glob, ind]) => {
    var o = {}, auj = fcAuj(), m = auj.slice(0, 7), jour = function (n) { return m + '-' + ('0' + n).slice(-2); }, g = fcDossier(glob), i = fcDossier(ind);
    fcEtape(g, 'creation_dossier').date_cible = jour(5); g.date_cible = jour(20); fcEtape(i, 'creation_dossier').date_cible = jour(5); i.responsable_id = 'u2'; fcEtape(i, 'creation_dossier').responsable_id = 'u2';
    var mi = (await fcCreerMission({ dossier_id: ind, intervenant_id: 'g1', titre: 'Bornage, plan; final', livrables: ['Plan'], echeance: jour(12) })).mission; await fcChangerStatutMission(mi.id, 'envoyee', {});
    i.notes_debours = [{ id: 'nd', numero: 'NDF-1', montant: 10, echeance: jour(25), statut: 'emise', client_id: 'c1' }];
    var ev = fcEvenementsCalendrier(m + '-01', m + '-31'); o.types = ev.map(function (e) { return e.type; }).sort().join();
    o.u1 = fcEvenementsCalendrier(m + '-01', m + '-31', { responsable: 'u1' }).length; o.u2 = fcEvenementsCalendrier(m + '-01', m + '-31', { responsable: 'u2' }).length; o.horsMois = fcEvenementsCalendrier('2000-01-01', '2000-01-31').length;
    i.statut = 'cloture'; o.clos = fcEvenementsCalendrier(m + '-01', m + '-31').every(function (e) { return e.dossier_id !== ind; }); i.statut = 'en_cours';
    var h = document.getElementById('fcal-root'); APP._fkMois = ''; APP._fcalFiltre = ''; fcRenderCalendrier(); o.grille = [h.querySelectorAll('[onclick^="APP._fcalJour"]').length >= 28, /échéance\(s\) ce mois/.test(h.innerHTML), /Exporter \(\.ics\)/.test(h.innerHTML)];
    APP._fcalJour = jour(5); fcRenderCalendrier(); o.jour = (h.innerHTML.match(/Ouvrir<\/button>/g) || []).length >= 2;
    fcMoisCalUI(1); var suiv = APP._fkMois; fcMoisCalUI(-2); o.nav = [suiv > m, APP._fkMois < m]; APP._fkMois = '';
    var ics = fcGenererIcs(ev, 'Test'); var lignes = ics.split('\r\n'); o.ics = [lignes[0], lignes[lignes.length - 2], (ics.match(/BEGIN:VEVENT/g) || []).length === ev.length, /DTSTART;VALUE=DATE:\d{8}/.test(ics), /Bornage\\, plan\\; final/.test(ics), lignes.every(function (l) { return l.length <= 75; }), new Set(ics.match(/UID:[^\r]+/g)).size === ev.length, ics.endsWith('\r\n')];
    var long = fcGenererIcs([{ id: 'x', date: '2026-02-28', type: 'etape', libelle: 'A'.repeat(200), responsable_id: 'u1' }]); o.plie = long.split('\r\n').every(function (l) { return l.length <= 75; }) && /\r\n A+/.test(long); o.finMois = /DTEND;VALUE=DATE:20260301/.test(long);
    var dl = null; window.fcTelechargerTexte = function (n, t, ty) { dl = { n: n, t: t, ty: ty }; }; fcExporterIcsUI(); o.export = [/^echeances-foncier-.*\.ics$/.test(dl.n), dl.ty, dl.t.indexOf('BEGIN:VCALENDAR') === 0];
    return o;
  }, [glob, ind]);
  assert.equal(r.types, 'dossier,etape,etape,mission,note'); assert.equal(r.u1, 2); assert.equal(r.u2, 3); assert.equal(r.horsMois, 0); assert.equal(r.clos, true); assert.deepEqual(r.grille, [true, true, true]); assert.equal(r.jour, true); assert.deepEqual(r.nav, [true, true]);
  assert.deepEqual(r.ics, ['BEGIN:VCALENDAR', 'END:VCALENDAR', true, true, true, true, true, true]); assert.equal(r.plie, true); assert.equal(r.finMois, true); assert.deepEqual(r.export, [true, 'text/calendar;charset=utf-8', true]);
});

test('budget du titre : saisie contrôlée, écarts, dépassements, panneau, indicateurs de coûts', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob, ind } = await monter(app.page);
  const r = await run(app.page, async ([glob, ind]) => {
    var o = {}; o.global = (await fcDefinirBudgetTitre(glob, { frais_actes: 1 })).erreur; o.nature = (await fcDefinirBudgetTitre(ind, { cadeau: 5 })).erreur; o.neg = (await fcDefinirBudgetTitre(ind, { frais_actes: -5 })).erreur; o.txt = (await fcDefinirBudgetTitre(ind, { frais_actes: 'abc' })).erreur;
    APP.currentUser = { id: 'u2', nom: 'Autre', role: 'comptable' }; o.droit = (await fcDefinirBudgetTitre(ind, { frais_actes: 1 })).erreur; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    o.vide = fcBudgetTitre(fcDossier(ind)).defini;
    var ok = await fcDefinirBudgetTitre(ind, { honoraires_notaire: '500000', frais_actes: 100000, droits_enregistrement: '', honoraires_geometre: 0 }); o.ok = [ok.ok, JSON.stringify(ok.budget)];
    await fcAjouterFraisTitre(ind, { nature: 'honoraires_notaire', montant_ht: 600000, tva: 108000, date: '2026-10-10', piece: 'N-1', charge: 'promoteur', tiers_id: 'g1' });
    await fcAjouterFraisTitre(ind, { nature: 'frais_actes', montant_ht: 50000, tva: 0, date: '2026-10-10', piece: 'A-1', charge: 'promoteur', tiers_id: 'g1' });
    await fcAjouterFraisTitre(ind, { nature: 'droits_enregistrement', montant_ht: 200000, tva: 0, date: '2026-10-10', piece: 'D-1', charge: 'promoteur', tiers_id: 'g1' });
    var b = fcBudgetTitre(fcDossier(ind)), L = {}; b.lignes.forEach(function (x) { L[x.nature] = x; });
    o.calc = [b.prevu, b.reel, b.ecart, L.honoraires_notaire.depasse, L.honoraires_notaire.ecart, L.frais_actes.depasse, L.frais_actes.ecart, L.droits_enregistrement.sans_budget, b.depassements.length];
    var host = document.createElement('div'); host.id = 'fc-detail'; document.body.appendChild(host); fcRenderDetail(ind); o.panneau = [/Budget prévisionnel du titre/.test(host.innerHTML), /dépassé de/.test(host.innerHTML), /Sans budget/.test(host.innerHTML), /id="fb-frais_actes"/.test(host.innerHTML)];
    document.getElementById('fb-frais_actes').value = '70000'; document.getElementById('fb-honoraires_notaire').value = '800000'; await fcSauverBudgetUI(ind); o.saisie = [fcDossier(ind).budget_titre.frais_actes, fcDossier(ind).budget_titre.honoraires_notaire, fcBudgetTitre(fcDossier(ind)).depassements.length];
    DATA.params.fc_budget_defaut = { honoraires_notaire: 1, frais_actes: 2 }; fcRenderDetail(ind); o.type = /Appliquer le budget type/.test(host.innerHTML); await fcBudgetTypeUI(ind); o.typeAppli = JSON.stringify(fcDossier(ind).budget_titre);
    await fcDefinirBudgetTitre(ind, { honoraires_notaire: 100000 }); var c = fcIndicateursCouts(fcAuj()); o.couts = [c.budget.dossiers_budgetes, c.budget.prevu, c.budget.depassements[0].dossier === fcDossier(ind).reference, c.budget.depassements[0].depassement > 0];
    o.carte = /Budgets prévisionnels/.test(fcHtmlCouts(fcAuj())) && /dépassement de/.test(fcHtmlCouts(fcAuj())); o.lignes = fcLignesCouts(fcAuj()).some(function (l) { return /Dépassement de budget/.test(l[0]); });
    fcDossier(ind).statut = 'cloture'; o.fige = (await fcDefinirBudgetTitre(ind, { frais_actes: 1 })).erreur; fcDossier(ind).statut = 'en_cours';
    return o;
  }, [glob, ind]);
  assert.match(r.global, /introuvable/); assert.match(r.nature, /inconnue/); assert.match(r.neg, /invalide/); assert.match(r.txt, /invalide/); assert.match(r.droit, /responsable du dossier/); assert.equal(r.vide, false);
  assert.deepEqual(r.ok, [true, '{"honoraires_notaire":500000,"frais_actes":100000}']); assert.deepEqual(r.calc, [600000, 958000, -358000, true, -208000, false, 50000, true, 2]); assert.deepEqual(r.panneau, [true, true, true, true]);
  assert.deepEqual(r.saisie, [70000, 800000, 1]); assert.equal(r.type, true); assert.equal(r.typeAppli, '{"honoraires_notaire":1,"frais_actes":2}'); assert.deepEqual(r.couts, [1, 100000, true, true]); assert.equal(r.carte, true); assert.equal(r.lignes, true); assert.match(r.fige, /figé/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('décharge de remise : contrôles, référence DEC, justificatif de l’étape, impression, enregistrement unique', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob, ind } = await monter(app.page);
  const r = await run(app.page, async ([glob, ind]) => {
    var o = {}, auj = fcAuj(), an = new Date().getFullYear(), d = fcDossier(ind), base = { date: auj, remis_a: 'Jean BENDE', piece_identite: 'CNI n° 123456', observations: 'Titre original' };
    o.global = (await fcEnregistrerRemiseTitre(glob, base)).erreur; o.futur = (await fcEnregistrerRemiseTitre(ind, Object.assign({}, base, { date: '2999-01-01' }))).erreur; o.avant = (await fcEnregistrerRemiseTitre(ind, Object.assign({}, base, { date: '1999-01-01' }))).erreur;
    o.nom = (await fcEnregistrerRemiseTitre(ind, Object.assign({}, base, { remis_a: ' ' }))).erreur; o.piece = (await fcEnregistrerRemiseTitre(ind, Object.assign({}, base, { piece_identite: '' }))).erreur;
    APP.currentUser = { id: 'u2', nom: 'Autre', role: 'comptable' }; o.droit = (await fcEnregistrerRemiseTitre(ind, base)).erreur; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    var host = document.createElement('div'); host.id = 'fc-detail'; document.body.appendChild(host); fcRenderDetail(ind); o.form = [/Remise du titre — décharge/.test(host.innerHTML), /id="fr-nom" value="Jean BENDE"/.test(host.innerHTML)];
    var imprime = null; window.openPrintPreview = function (html, titre) { imprime = { html: html, titre: titre }; };
    document.getElementById('fr-piece').value = 'CNI n° 123456'; fcImprimerDechargeUI(ind); o.apercu = [/DÉCHARGE DE REMISE DE TITRE FONCIER/.test(imprime.html), /Jean BENDE/.test(imprime.html), /CNI n° 123456/.test(imprime.html), /à attribuer/.test(imprime.html), /Le réceptionnaire/.test(imprime.html)];
    var e = await fcEnregistrerRemiseTitre(ind, base); o.ok = [e.ok, e.remise.ref === 'DEC-' + an + '-0001', d.remise_titre.remis_a]; var j = fcEtape(d, 'ind_remise_titre').justificatifs; o.just = [j.length, j[0].reference, j[0].source, /Décharge de remise signée par Jean BENDE/.test(j[0].note)];
    o.ev = DATA.evenements_fonciers.some(function (x) { return x.type === 'remise_titre' && /DEC-/.test(x.description) && x.etape_code === 'ind_remise_titre'; }); o.deux = (await fcEnregistrerRemiseTitre(ind, base)).erreur;
    fcRenderDetail(ind); o.apres = [/Titre remis le/.test(host.innerHTML), /DEC-\d{4}-0001/.test(host.innerHTML), !/Enregistrer la remise/.test(host.innerHTML)]; fcImprimerDechargeUI(ind); o.reimp = [/DEC-\d{4}-0001/.test(imprime.html), !/à attribuer/.test(imprime.html)];
    o.suivante = fcReferenceDecharge() === 'DEC-' + an + '-0002'; o.xss = /&lt;b&gt;/.test(fcHtmlDecharge(d, { remis_a: '<b>x</b>', piece_identite: 'p', date: auj }, 'R'));
    return o;
  }, [glob, ind]);
  assert.match(r.global, /introuvable/); assert.match(r.futur, /Date de remise invalide/); assert.match(r.avant, /Date de remise invalide/); assert.match(r.nom, /à qui/); assert.match(r.piece, /pièce d’identité/); assert.match(r.droit, /responsable du dossier/);
  assert.deepEqual(r.form, [true, true]); assert.deepEqual(r.apercu, [true, true, true, true, true]); assert.deepEqual(r.ok, [true, true, 'Jean BENDE']); assert.deepEqual(r.just, [1, r.just[1], 'promoteur', true]); assert.match(r.just[1], /^DEC-/); assert.equal(r.ev, true); assert.match(r.deux, /déjà enregistrée/);
  assert.deepEqual(r.apres, [true, true, true]); assert.deepEqual(r.reimp, [true, true]); assert.equal(r.suivante, true); assert.equal(r.xss, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('recherche globale : tous les types, accents ignorés, pièces restreintes exclues, longueur minimale', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { glob, ind } = await monter(app.page);
  const r = await run(app.page, async ([glob, ind]) => {
    var o = {}, d = fcDossier(ind); DATA.clients[0].nom = 'Koné'; DATA.clients[0].tel = '0707070707';
    var mi = (await fcCreerMission({ dossier_id: ind, intervenant_id: 'g1', titre: 'Plan de bornage', livrables: ['Plan'], echeance: '2030-01-01', contrat_reference: 'CTR-555' })).mission;
    DATA.pieces_foncieres.push({ id: 'pa', dossier_id: ind, nom: 'Plan cadastral.pdf' }, { id: 'pb', dossier_id: ind, nom: 'Secret cadastral.pdf', confidentialite: 'restreinte' }, { id: 'pc', dossier_id: ind, nom: 'Vieux cadastral.pdf', retire: true });
    d.notes_debours = [{ id: 'nd', numero: 'NDF-2026-0042', montant: 123000, statut: 'emise', client_id: 'c1' }]; await fcEnregistrerCourrier(ind, { code: 'libre', action: 'copie', destinataire: 'X' }); await fcEnregistrerRemiseTitre(ind, { date: fcAuj(), remis_a: 'Awa Traoré', piece_identite: 'CNI 1' });
    var q = function (t) { var x = fcRechercheGlobale(t); return { d: x.dossiers.length, s: x.souscripteurs.length, i: x.intervenants.length, m: x.missions.length, p: x.pieces.map(function (y) { return y.nom; }), doc: x.documents.map(function (y) { return y.description; }) }; };
    o.court = JSON.stringify(q('a')) === JSON.stringify(q('')); o.dossier = q(d.reference).d; o.souscripteur = [q('kone').s, q('0707070707').s, q('jean kone').s]; o.interv = [q('cabinet geo').i, q('géomètre').i]; o.mission = [q('CTR-555').m, q('bornage').m]; o.pieces = q('cadastral').p;
    o.docs = [q('NDF-2026-0042').doc.length, q('COU-').doc.length, q('DEC-').doc.length, q('awa traore').doc.length]; o.aucun = Object.keys(fcRechercheGlobale('zzzzqqq')).every(function (k) { return fcRechercheGlobale('zzzzqqq')[k].length === 0; });
    var h = document.getElementById('fr-root'); APP._frQ = ''; fcRenderRecherche(); o.vide = document.getElementById('fr-res').innerHTML === ''; APP._frQ = 'cadastral'; fcRenderResultatsRecherche(); o.rendu = [/Pièces/.test(h.innerHTML), /Plan cadastral/.test(h.innerHTML), !/Secret/.test(h.innerHTML)];
    APP._frQ = 'zzzzqqq'; fcRenderResultatsRecherche(); o.rienTrouve = /Aucun résultat/.test(h.innerHTML); APP._frQ = '<img src=x>'; fcRenderResultatsRecherche(); o.xss = !/<img src=x>/.test(h.innerHTML);
    return o;
  }, [glob, ind]);
  assert.equal(r.court, true); assert.equal(r.dossier, 1); assert.deepEqual(r.souscripteur, [1, 1, 1]); assert.deepEqual(r.interv, [1, 1]); assert.deepEqual(r.mission, [1, 1]); assert.deepEqual(r.pieces, ['Plan cadastral.pdf']);
  assert.deepEqual(r.docs, [1, 1, 1, 1]); assert.equal(r.aucun, true); assert.equal(r.vide, true); assert.deepEqual(r.rendu, [true, true, true]); assert.equal(r.rienTrouve, true); assert.equal(r.xss, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('réglages : durée d’archivage et budget type (direction), validation', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { ind } = await monter(app.page);
  const r = await run(app.page, async (ind) => {
    var o = {}, g = function (id) { return document.getElementById(id); }; window.dbPut = async function () { return true; };
    APP.currentUser = { id: 'ux', nom: 'Agent', role: 'foncier' }; fcRenderModeles(); o.cache = !/Archivage et budget type/.test(g('fm-root').innerHTML); await fcSauverReglagesFinUI(); o.refus = DATA.params.fc_archivage_mois === undefined;
    APP.currentUser = { id: 'u1', nom: 'Dir', role: 'admin' }; fcRenderModeles(); o.visible = /Archivage et budget type/.test(g('fm-root').innerHTML) && g('frg-arch').value === '24';
    g('frg-arch').value = '0'; await fcSauverReglagesFinUI(); o.moisInvalide = DATA.params.fc_archivage_mois === undefined; g('frg-arch').value = '18'; g('frg-b-frais_actes').value = '-5'; await fcSauverReglagesFinUI(); o.montantInvalide = DATA.params.fc_archivage_mois === undefined;
    g('frg-b-frais_actes').value = '75000'; g('frg-b-honoraires_notaire').value = '400000'; await fcSauverReglagesFinUI(); o.sauve = [DATA.params.fc_archivage_mois, JSON.stringify(DATA.params.fc_budget_defaut), fcArchivageMois()];
    var r2 = await fcDefinirBudgetTitre(ind, DATA.params.fc_budget_defaut); o.applique = JSON.stringify(r2.budget);
    return o;
  }, ind);
  assert.equal(r.cache, true); assert.equal(r.refus, true); assert.equal(r.visible, true); assert.equal(r.moisInvalide, true); assert.equal(r.montantInvalide, true); assert.deepEqual(r.sauve, [18, '{"honoraires_notaire":400000,"frais_actes":75000}', 18]); assert.equal(r.applique, '{"honoraires_notaire":400000,"frais_actes":75000}');
});
