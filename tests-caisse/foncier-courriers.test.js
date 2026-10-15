/* Foncier Connect — courriers types : gabarits, fusion des champs, journal, impression / copie / e-mail, éditeur. */
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
  DATA.clients[0].email = 'jean@x.ci'; DATA.clients[0].tel = '0102030405';
  DATA.intervenants_fonciers = [{ id: 'n1', type: 'notaire', nom_organisation: 'Étude Koffi', statut_relation: 'actif', email: 'etude@x.ci' }, { id: 'g1', type: 'geometre', nom_organisation: 'Cabinet Géo', statut_relation: 'actif', email: '' }]; DATA.missions_foncieres = [];
  var ind = (await fcOuvrirDossierIndividuel({ lot_id: 'l1', client_id: 'c1' })).dossier;
  var m = (await fcCreerMission({ dossier_id: ind.id, intervenant_id: 'g1', titre: 'Plan de bornage', description: 'Joindre le PV', livrables: ['Plan', 'PV'], echeance: '2026-12-15' })).mission;
  var ar = fcEtape(ind, 'ind_pieces_souscripteur'); ar.statut = 'attente_document';
  ind.notes_debours = [{ id: 'nd1', numero: 'NDF-2026-0001', montant: 350000, echeance: '2026-09-01', statut: 'emise', client_id: 'c1' }, { id: 'nd2', numero: 'NDF-2026-0002', montant: 1, echeance: '2026-09-01', statut: 'encaissee', client_id: 'c1' }];
  DATA.pieces_foncieres.push({ id: 'pz1', dossier_id: ind.id, nom: 'Plan.pdf' }, { id: 'pz2', dossier_id: ind.id, nom: 'Secret.pdf', confidentialite: 'restreinte' });
  return { ind: ind.id, mission: m.id, glob: window.__g };
});

test('catalogue : codes uniques, destinataires valides, champs connus uniquement', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await run(app.page, () => {
    var o = { doublons: [], pour: [], inconnus: [] }, vus = {};
    FC_GABARITS_COURRIER.forEach(function (g) {
      if (vus[g.code]) o.doublons.push(g.code); vus[g.code] = true;
      if (['client', 'mission', 'note', 'intervenant', 'aucun'].indexOf(g.pour) === -1) o.pour.push(g.code);
      ((g.objet + ' ' + g.corps).match(/\{\{\s*[a-z_]+\s*\}\}/g) || []).forEach(function (x) { var k = x.replace(/[{}\s]/g, ''); if (FC_CHAMPS_COURRIER.indexOf(k) === -1) o.inconnus.push(g.code + ':' + k); });
    });
    o.nb = FC_GABARITS_COURRIER.length; o.libre = fcGabaritCourrier('libre').corps; o.zzz = fcGabaritCourrier('zzz');
    return o;
  });
  assert.deepEqual([r.doublons, r.pour, r.inconnus], [[], [], []]); assert.equal(r.nb, 9); assert.equal(r.libre, ''); assert.equal(r.zzz, null);
});

test('préparation : champs fusionnés, destinataire, manquants signalés, contexte contrôlé', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { ind, mission, glob } = await monter(app.page);
  const r = await run(app.page, ([ind, mission, glob]) => {
    var o = {}, a = fcPreparerCourrier(ind, 'complement_souscripteur', { client_id: 'c1' });
    o.compl = [a.ok, /Dossier foncier DF-/.test(a.objet), /Madame, Monsieur Jean BENDE/.test(a.corps), /lot 12/.test(a.corps), a.destinataire, /^- /m.test(a.corps), a.manquants.indexOf('pieces_attendues') === -1];
    o.client0 = fcPreparerCourrier(ind, 'complement_souscripteur', {}).ok;
    var n = fcPreparerCourrier(ind, 'relance_note', { note_id: 'nd1' }); o.note = [n.ok, /NDF-2026-0001/.test(n.objet), /350\s?000 FCFA/.test(n.corps), /01\/09\/2026|1 sept|2026/.test(n.corps), n.destinataire.email];
    o.noteEncaissee = fcPreparerCourrier(ind, 'relance_note', { note_id: 'nd2' }).erreur; o.noteSans = fcPreparerCourrier(ind, 'relance_note', {}).erreur;
    var m = fcPreparerCourrier(ind, 'ordre_mission', { mission_id: mission }); o.mission = [m.ok, /Plan de bornage/.test(m.objet), /Cabinet Géo/.test(m.corps), /- Plan\n- PV/.test(m.corps), /Joindre le PV/.test(m.corps), m.destinataire];
    o.missionAutre = fcPreparerCourrier(glob, 'ordre_mission', { mission_id: mission }).erreur;
    var t = fcPreparerCourrier(ind, 'transmission_notaire', { intervenant_id: 'n1' }); o.notaire = [t.ok, /Maître Étude Koffi/.test(t.corps), /- Plan\.pdf/.test(t.corps), !/Secret/.test(t.corps), t.destinataire.email]; o.notaireSans = fcPreparerCourrier(ind, 'transmission_notaire', {}).erreur;
    var s = fcPreparerCourrier(ind, 'suivi_administration', {}); o.admin = [s.ok, s.manquants.indexOf('numero_dossier') !== -1, /\[à compléter\]/.test(s.objet)]; fcDossier(ind).numero_dossier_guf = 'GUF-77'; o.guf = /GUF-77/.test(fcPreparerCourrier(ind, 'suivi_administration', {}).objet);
    var av = fcPreparerCourrier(ind, 'avancement_souscripteur', { client_id: 'c1' }); o.avancement = [/\d+ %/.test(av.corps), /Prochaine étape :/.test(av.corps)];
    o.inconnu = fcPreparerCourrier(ind, 'zzz', {}).erreur; o.dossier = fcPreparerCourrier('nope', 'libre', {}).erreur;
    o.libre = fcPreparerCourrier(ind, 'libre', {}).corps; o.fusion = fcFusionnerCourrier('A {{x}} B {{ y }} C {{date}}', { y: 'ok', date: '1' }, []) ;
    return o;
  }, [ind, mission, glob]);
  assert.deepEqual(r.compl, [true, true, true, true, { nom: 'Jean BENDE', email: 'jean@x.ci' }, true, true]); assert.equal(r.client0, true, 'un seul souscripteur : choisi automatiquement');
  assert.deepEqual(r.note, [true, true, true, true, 'jean@x.ci']); assert.match(r.noteEncaissee, /émise/); assert.match(r.noteSans, /note de débours/);
  assert.deepEqual(r.mission, [true, true, true, true, true, { nom: 'Cabinet Géo', email: '' }]); assert.match(r.missionAutre, /mission concernée/);
  assert.deepEqual(r.notaire, [true, true, true, true, 'etude@x.ci']); assert.match(r.notaireSans, /intervenant/); assert.deepEqual(r.admin, [true, true, true]); assert.equal(r.guf, true); assert.deepEqual(r.avancement, [true, true]);
  assert.match(r.inconnu, /inconnu/); assert.match(r.dossier, /introuvable/); assert.equal(r.libre, ''); assert.equal(r.fusion, 'A [à compléter] B ok C 1');
});

test('journal : référence COU-AAAA-NNNN croissante, actions contrôlées, même référence pour un même courrier', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { ind } = await monter(app.page);
  const r = await run(app.page, async (ind) => {
    var o = {}, an = new Date().getFullYear(); o.premier = fcNumeroCourrier() === 'COU-' + an + '-0001';
    var a = await fcEnregistrerCourrier(ind, { code: 'relance_note', action: 'impression', destinataire: 'Jean BENDE' }); o.a = [a.ok, a.ref === 'COU-' + an + '-0001'];
    var b = await fcEnregistrerCourrier(ind, { code: 'relance_note', action: 'copie', ref: a.ref, destinataire: 'Jean BENDE' }); o.b = b.ref === a.ref;
    var c = await fcEnregistrerCourrier(ind, { code: 'libre', action: 'email' }); o.c = c.ref === 'COU-' + an + '-0002';
    o.action = (await fcEnregistrerCourrier(ind, { code: 'libre', action: 'fax' })).erreur; o.modele = (await fcEnregistrerCourrier(ind, { code: 'zzz', action: 'copie' })).erreur;
    var ev = DATA.evenements_fonciers.filter(function (e) { return e.type === 'courrier'; }); o.ev = [ev.length, ev[0].courrier_modele, ev[0].courrier_action, /imprimé/.test(ev[0].description), /copié/.test(ev[1].description), /envoyé par e-mail/.test(ev[2].description), /Jean BENDE/.test(ev[0].description)];
    return o;
  }, ind);
  assert.equal(r.premier, true); assert.deepEqual(r.a, [true, true]); assert.equal(r.b, true); assert.equal(r.c, true); assert.match(r.action, /Action inconnue/); assert.match(r.modele, /introuvable/); assert.deepEqual(r.ev, [3, 'relance_note', 'impression', true, true, true, true]);
});

test('interface : panneau du dossier, préparation, impression, copie, e-mail dédupliqué', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { ind, mission } = await monter(app.page);
  const r = await run(app.page, async ([ind, mission]) => {
    var o = {}, g = function (id) { return document.getElementById(id); }; window.confirm = function () { return true; };
    var host = document.createElement('div'); host.id = 'fc-detail'; document.body.appendChild(host); fcRenderDetail(ind); o.panneau = /Courriers types/.test(host.innerHTML) && g('fcc-g') && g('fcc-g').options.length === 9;
    g('fcc-g').value = 'relance_note'; fcMajCourrierUI(ind); o.pourNotes = Array.prototype.map.call(g('fcc-pour').options, function (x) { return x.text; }).length === 1 && /NDF-2026-0001/.test(g('fcc-pour').options[0].text);
    g('fcc-g').value = 'ordre_mission'; fcMajCourrierUI(ind); o.pourMission = g('fcc-pour').options[0].value === mission;
    g('fcc-g').value = 'complement_souscripteur'; fcMajCourrierUI(ind); fcPreparerCourrierUI(ind); o.prepare = [!!g('fcc-corps'), /Madame, Monsieur Jean BENDE/.test(g('fcc-corps').value), /jean@x\.ci/.test(g('fcc-zone').innerHTML)];
    var imprime = null; window.openPrintPreview = function (html, titre) { imprime = { html: html, titre: titre }; };
    await fcCourrierActionUI('impression'); o.impression = [/COU-\d{4}-0001/.test(imprime.titre), imprime.html.indexOf('Objet : Dossier foncier DF-') !== -1, imprime.html.indexOf('Jean BENDE') !== -1, imprime.html.indexOf('Madame, Monsieur Jean BENDE') !== -1];
    var copie = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async function (t) { copie = t; } }, configurable: true }); g('fcc-corps').value = 'Texte modifié'; await fcCourrierActionUI('copie'); o.copie = [/Texte modifié/.test(copie), APP._fcCourrier.ref];
    DATA.notifications_foncieres = []; await fcCourrierActionUI('email'); var nb = DATA.notifications_foncieres.length; var n = DATA.notifications_foncieres[0]; o.email = [nb >= 1, n && n.titre.indexOf('Dossier foncier') === 0, n && n.message === 'Texte modifié', n && n.adresse === 'jean@x.ci' || (n && n.destinataire_nom === 'Jean BENDE')];
    await fcCourrierActionUI('email'); o.dedup = DATA.notifications_foncieres.length === nb;
    g('fcc-corps').value = ''; var avant = DATA.evenements_fonciers.length; await fcCourrierActionUI('impression'); o.vide = DATA.evenements_fonciers.length === avant;
    g('fcc-g').value = 'ordre_mission'; fcMajCourrierUI(ind); fcPreparerCourrierUI(ind); o.sansEmail = g('fcc-zone').innerHTML.indexOf('aucun e-mail connu') !== -1 && /disabled/.test(g('fcc-zone').innerHTML);
    var evs = DATA.evenements_fonciers.filter(function (e) { return e.type === 'courrier'; }); o.journal = [evs.length, evs[0].courrier_ref === evs[1].courrier_ref && evs[1].courrier_ref === evs[2].courrier_ref];
    return o;
  }, [ind, mission]);
  assert.equal(!!r.panneau, true); assert.equal(r.pourNotes, true); assert.equal(r.pourMission, true); assert.deepEqual(r.prepare, [true, true, true]); assert.deepEqual(r.impression, [true, true, true, true]); assert.equal(r.copie[0], true);
  assert.equal(r.email[0], true); assert.equal(r.email[1], true); assert.equal(r.email[2], true); assert.equal(r.dedup, true); assert.equal(r.vide, true); assert.equal(r.sansEmail, true); assert.deepEqual(r.journal, [3, true]);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('éditeur : réservé à la direction, champs vérifiés, personnalisation et rétablissement', async () => {
  const app = await ouvrirApp(); await preparer(app.page); const { ind } = await monter(app.page);
  const r = await run(app.page, async (ind) => {
    var o = {}, g = function (id) { return document.getElementById(id); }; window.dbPut = async function () { return true; }; window.confirm = function () { return true; };
    APP.currentUser = { id: 'ux', nom: 'Agent', role: 'foncier' }; fcRenderModeles(); o.cache = !/Modèles de courrier/.test(g('fm-root').innerHTML); await fcSauverGabaritUI(); o.refus = !DATA.params.fc_gabarits_courrier;
    APP.currentUser = { id: 'u1', nom: 'Dir', role: 'admin' }; APP._fgcCode = 'remise_titre'; fcRenderModeles(); o.visible = /Modèles de courrier/.test(g('fm-root').innerHTML) && /\{\{souscripteur\}\}/.test(g('fm-root').innerHTML);
    g('fgc-objet').value = ''; await fcSauverGabaritUI(); o.sansObjet = !DATA.params.fc_gabarits_courrier;
    g('fgc-objet').value = 'Titre prêt — {{dossier}}'; g('fgc-corps').value = 'Bonjour {{souscripteur}}, {{champ_inconnu}}'; await fcSauverGabaritUI(); o.inconnu = !DATA.params.fc_gabarits_courrier;
    g('fgc-corps').value = 'Bonjour {{souscripteur}}, votre titre pour {{lots}} est prêt.'; await fcSauverGabaritUI(); o.sauve = DATA.params.fc_gabarits_courrier.remise_titre.objet;
    var p = fcPreparerCourrier(ind, 'remise_titre', { client_id: 'c1' }); o.perso = [/^Titre prêt — DF-/.test(p.objet), p.corps === 'Bonjour Jean BENDE, votre titre pour lot 12 est prêt.', fcGabaritCourrier('remise_titre').personnalise];
    o.autre = fcGabaritCourrier('relance_note').personnalise === undefined; o.badge = /personnalisé/.test(g('fm-root').innerHTML);
    await fcRetablirGabaritUI(); o.retabli = [!DATA.params.fc_gabarits_courrier.remise_titre, /remise de votre titre foncier/.test(fcPreparerCourrier(ind, 'remise_titre', { client_id: 'c1' }).objet)];
    return o;
  }, ind);
  assert.equal(r.cache, true); assert.equal(r.refus, true); assert.equal(r.visible, true); assert.equal(r.sansObjet, true); assert.equal(r.inconnu, true); assert.equal(r.sauve, 'Titre prêt — {{dossier}}'); assert.deepEqual(r.perso, [true, true, true]); assert.equal(r.autre, true); assert.equal(r.badge, true); assert.deepEqual(r.retabli, [true, true]);
  assert.deepEqual(app.etat.erreursPage, []);
});
