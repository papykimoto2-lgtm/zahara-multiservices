/* SMQ : maîtrise documentaire, non-conformités, réclamations, satisfaction. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function ouvrir(editer) {
  const app = await ouvrirApp();
  await app.page.evaluate(function (ed) {
    window.toast = function (m) { (window.__t = window.__t || []).push(m); };
    window.smqPeutEditer = function () { return ed; };
    DATA.smq_nc = []; DATA.smq_reclamations = []; DATA.smq_satisfaction = []; DATA.smq_documents = [];
    switchTab('params', 'smq');
  }, editer);
  return app;
}

test('une non-conformité ne se clôture qu\'après cause, action, réalisation et vérification efficace', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    smqOnglet('nc'); smqNouveau('nc');
    document.getElementById('smqf-description').value = 'Facture émise sans client';
    document.getElementById('smqf-processus').value = 'Encaissements et recouvrement';
    await smqEnregistrer();
    var nc = DATA.smq_nc[0], out = { ref: nc.ref, statut0: nc.statut, an: new Date().getFullYear() };
    await smqTransition('nc', nc.id, 'en_traitement'); out.sansCause = nc.statut;
    nc.cause = 'Saisie sans contrôle'; nc.action_corrective = 'Champ client obligatoire'; nc.responsable = 'Facturier'; nc.echeance = '2000-01-01';
    await smqTransition('nc', nc.id, 'en_traitement'); out.traitement = nc.statut; out.retard = _smqRetard(nc);
    await smqTransition('nc', nc.id, 'a_verifier'); out.sansDate = nc.statut;
    nc.date_realisation = today(); await smqTransition('nc', nc.id, 'a_verifier'); out.averifier = nc.statut; out.retardApres = _smqRetard(nc);
    nc.date_verification = today(); nc.verification_resultat = 'Non efficace'; await smqTransition('nc', nc.id, 'cloturee'); out.nonEfficace = nc.statut;
    await smqTransition('nc', nc.id, 'en_traitement'); out.rouverte = nc.statut + ':' + nc.reouvertures;
    nc.date_realisation = today(); await smqTransition('nc', nc.id, 'a_verifier'); nc.date_verification = today(); nc.verification_resultat = 'Efficace';
    await smqTransition('nc', nc.id, 'cloturee'); out.fin = nc.statut; out.cloture = !!nc.cloture_le;
    return out;
  });
  assert.equal(r.ref, 'NC-' + r.an + '-0001');
  assert.equal(r.statut0, 'ouverte');
  assert.equal(r.sansCause, 'ouverte');
  assert.equal(r.traitement, 'en_traitement'); assert.ok(r.retard);
  assert.equal(r.sansDate, 'en_traitement');
  assert.equal(r.averifier, 'a_verifier'); assert.ok(!r.retardApres);
  assert.equal(r.nonEfficace, 'a_verifier');
  assert.equal(r.rouverte, 'en_traitement:1');
  assert.equal(r.fin, 'cloturee'); assert.ok(r.cloture);
});

test('une réclamation suit son circuit et peut générer une non-conformité', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    smqOnglet('rcl'); smqNouveau('rcl');
    document.getElementById('smqf-client').value = 'M. Kouassi'; document.getElementById('smqf-objet').value = 'Reçu non remis';
    await smqEnregistrer();
    var c = DATA.smq_reclamations[0], o = { statut0: c.statut };
    await smqTransition('rcl', c.id, 'en_traitement'); o.sansResp = c.statut;
    c.responsable = 'Caisse'; await smqTransition('rcl', c.id, 'en_traitement'); o.traitement = c.statut;
    await smqTransition('rcl', c.id, 'traitee'); o.sansReponse = c.statut;
    c.reponse = 'Reçu remis'; c.date_reponse = today(); await smqTransition('rcl', c.id, 'traitee'); o.traitee = c.statut;
    await smqTransition('rcl', c.id, 'cloturee'); o.sansSatisf = c.statut;
    c.satisfaction = 'Satisfait'; await smqTransition('rcl', c.id, 'cloturee'); o.fin = c.statut;
    smqCreerNC(c.id); o.preRemplie = _smqForm.kind === 'nc' && _smqForm.rec.source === 'Réclamation client' && _smqForm.rec.description.indexOf(c.ref) !== -1;
    return o;
  });
  assert.equal(r.statut0, 'recue'); assert.equal(r.sansResp, 'recue'); assert.equal(r.traitement, 'en_traitement');
  assert.equal(r.sansReponse, 'en_traitement'); assert.equal(r.traitee, 'traitee'); assert.equal(r.sansSatisf, 'traitee'); assert.equal(r.fin, 'cloturee');
  assert.ok(r.preRemplie);
});

test('un document approuvé exige approbateur et date, et conserve l\'historique des versions', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    window.confirm = function () { return true; };
    var ref = MANUELS_CATALOGUE[0].ref, o = {};
    smqEditerDoc(ref);
    document.getElementById('smqf-version').value = '1.0'; document.getElementById('smqf-statut').value = 'approuve';
    await smqEnregistrerDoc(); o.refus = DATA.smq_documents.length;
    document.getElementById('smqf-approbateur').value = 'DG'; document.getElementById('smqf-date_approbation').value = '2026-01-10'; document.getElementById('smqf-prochaine_revue').value = '2000-01-01';
    await smqEnregistrerDoc(); o.v1 = DATA.smq_documents[0].version;
    renderSmq(); o.revue = document.getElementById('smq-contenu').textContent.indexOf('Revue dépassée') !== -1;
    smqEditerDoc(ref);
    document.getElementById('smqf-version').value = '1.1'; document.getElementById('smqf-motif').value = 'Ajout d\'une règle';
    await smqEnregistrerDoc(); var d = DATA.smq_documents[0];
    o.v2 = d.version; o.hist = d.historique.map(function (h) { return h.version; }).join(',');
    return o;
  });
  assert.equal(r.refus, 0); assert.equal(r.v1, '1.0'); assert.ok(r.revue); assert.equal(r.v2, '1.1'); assert.equal(r.hist, '1.0');
});

test('la satisfaction calcule la note moyenne et la lecture seule bloque l\'écriture', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    var o = {};
    smqOnglet('sat');
    for (var n of ['5', '4', '2']) { smqNouveau('sat'); document.getElementById('smqf-note').value = n; await smqEnregistrer(); }
    smqNouveau('sat'); document.getElementById('smqf-note').value = '9'; await smqEnregistrer();
    o.nb = DATA.smq_satisfaction.length;
    smqOnglet('sat'); var txt = document.getElementById('smq-contenu').textContent;
    o.moy = txt.indexOf('3.67 / 5') !== -1; o.satisfaits = txt.indexOf('67 %') !== -1;
    window.smqPeutEditer = function () { return false; };
    smqNouveau('sat'); document.getElementById('smqf-note').value = '5'; await smqEnregistrer();
    o.lectureSeule = DATA.smq_satisfaction.length;
    return o;
  });
  assert.equal(r.nb, 3); assert.ok(r.moy); assert.ok(r.satisfaits); assert.equal(r.lectureSeule, 3);
});

test('audit interne : programme, indépendance, constats, NC liées et clôture conditionnée', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    var o = {}, nom = MANUELS_PROCESSUS.filter(function (p) { return p.id === 'encaissement'; })[0].nom;
    smqOnglet('aud'); smqNouveau('aud'); o.statutNouveau = _smqForm.rec.statut; smqAnnuler();
    await smqProposerProgramme(); o.prog = DATA.smq_audits.length; o.nbProc = MANUELS_PROCESSUS.length;
    await smqProposerProgramme(); o.apresDoublon = DATA.smq_audits.length;
    DATA.params = DATA.params || {}; DATA.params.smq_processus = { encaissement: { pilote: 'Awa Koné', indicateurs: [], documents: [] } };
    var a = DATA.smq_audits.filter(function (x) { return x.processus === nom; })[0];
    a.auditeur = 'Awa Koné'; a.date_realisation = today();
    await smqTransition('aud', a.id, 'realise'); o.independance = a.statut;
    a.auditeur = 'Yao Traoré'; await smqTransition('aud', a.id, 'realise'); o.realise = a.statut;
    a.constats = [{ type: 'Non-conformité majeure', description: 'Reçus non remis', nc_ref: '' }, { type: 'Observation', description: 'Classement à améliorer', nc_ref: '' }];
    await smqTransition('aud', a.id, 'rapport'); o.sansConclusion = a.statut;
    a.conclusion = 'Système globalement conforme'; await smqTransition('aud', a.id, 'rapport'); o.rapport = a.statut;
    smqOuvrirFiche('aud', a.id);
    await smqCreerNCConstat(0); o.ncRef = a.constats[0].nc_ref; var nc = DATA.smq_nc[0]; o.nc = nc.source + '|' + nc.gravite + '|' + nc.statut;
    await smqCreerNCConstat(0); o.unSeulNc = DATA.smq_nc.length;
    await smqTransition('aud', a.id, 'clos'); o.closBloque = a.statut;
    nc.statut = 'cloturee'; await smqTransition('aud', a.id, 'clos'); o.clos = a.statut;
    return o;
  });
  assert.equal(r.statutNouveau, 'planifie');
  assert.equal(r.prog, r.nbProc); assert.equal(r.apresDoublon, r.nbProc);
  assert.equal(r.independance, 'planifie'); assert.equal(r.realise, 'realise');
  assert.equal(r.sansConclusion, 'realise'); assert.equal(r.rapport, 'rapport');
  assert.match(r.ncRef, /^NC-\d{4}-0001$/); assert.equal(r.nc, 'Audit interne|Majeure|ouverte'); assert.equal(r.unSeulNc, 1);
  assert.equal(r.closBloque, 'rapport'); assert.equal(r.clos, 'clos');
});

test('revue de direction : entrées calculées depuis l\'ERP, décisions, clôture conditionnée', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    var o = {}, an = new Date().getFullYear();
    DATA.smq_nc = [{ id: 'n1', ref: 'NC-1', date: today(), statut: 'ouverte' }, { id: 'n2', ref: 'NC-2', date: today(), statut: 'cloturee', cloture_le: today() }];
    DATA.smq_satisfaction = [{ id: 's1', date: today(), note: 5 }, { id: 's2', date: today(), note: 3 }];
    DATA.smq_reclamations = [{ id: 'r1', date: today(), statut: 'traitee', date_reponse: today() }];
    smqOnglet('rev'); smqNouveau('rev');
    document.getElementById('smqf-date_prevue').value = today(); await smqEnregistrer();
    var r = DATA.smq_revues[0]; o.ref = r.ref; o.an = an; o.statut0 = r.statut;
    document.getElementById('smqf-date_tenue') || smqOuvrirFiche('rev', r.id);
    document.getElementById('smqf-date_tenue').value = today(); document.getElementById('smqf-participants').value = 'DG, Qualité'; document.getElementById('smqf-conclusion').value = 'SMQ pertinent';
    smqPreremplirEntrees();
    var e = _smqForm.rec.entrees_auto; o.nc = e.nc.ouvertes + '/' + e.nc.cloturees; o.note = e.satisfaction.note_moyenne; o.rec = e.satisfaction.reclamations;
    await smqEnregistrer();
    r = DATA.smq_revues[0];
    await smqTransition('rev', r.id, 'tenue'); o.sansDecision = r.statut;
    smqOuvrirFiche('rev', r.id); smqAjouterDecision();
    document.getElementById('smq-dc-desc-0').value = 'Renforcer le contrôle des reçus'; document.getElementById('smq-dc-resp-0').value = 'Comptable'; document.getElementById('smq-dc-ech-0').value = '2000-01-01';
    await smqEnregistrer(); r = DATA.smq_revues[0]; o.nbDec = r.decisions.length;
    await smqTransition('rev', r.id, 'tenue'); o.tenue = r.statut;
    await smqTransition('rev', r.id, 'cloturee'); o.closBloque = r.statut;
    r.decisions[0].statut = 'Réalisée'; await smqTransition('rev', r.id, 'cloturee'); o.clos = r.statut;
    smqNouveau('rev'); document.getElementById('smqf-date_prevue').value = '2999-01-01'; document.getElementById('smqf-date_tenue').value = '2999-02-01';
    var prec = _smqDecisionsPrecedentes({ id: 'x', date_prevue: '2999-01-01', date_tenue: '2999-02-01' }); o.prec = prec ? prec.ref : null;
    return o;
  });
  assert.match(r.ref, /^RDD-\d{4}-0001$/); assert.equal(r.statut0, 'planifiee');
  assert.equal(r.nc, '1/1'); assert.equal(r.note, 4); assert.equal(r.rec, 1);
  assert.equal(r.sansDecision, 'planifiee'); assert.equal(r.nbDec, 1); assert.equal(r.tenue, 'tenue');
  assert.equal(r.closBloque, 'tenue'); assert.equal(r.clos, 'cloturee'); assert.equal(r.prec, r.ref);
});

test('le libellé de version est une chaîne JavaScript valide', async () => {
  const app = await ouvrirApp();
  const v = await app.page.evaluate(function () { return window.IMMOSUITE_VERSION; });
  assert.equal(typeof v, 'string');
  assert.match(v, /^v14\.\d+ · /);
});

test('politique : une seule version approuvée à la fois ; objectifs : conclusion exige la valeur actuelle', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    window.confirm = function () { return true; };
    var o = {};
    smqOnglet('pol');
    smqNouveau('pol'); document.getElementById('smqf-version').value = '1.0'; document.getElementById('smqf-texte').value = 'Satisfaire nos clients'; await smqEnregistrer();
    var p1 = DATA.smq_politiques[0]; o.statut0 = p1.statut;
    await smqTransition('pol', p1.id, 'approuvee'); o.sansApprobateur = p1.statut;
    p1.approbateur = 'DG'; p1.date_approbation = today(); await smqTransition('pol', p1.id, 'approuvee'); o.v1 = p1.statut;
    smqNouveau('pol'); document.getElementById('smqf-version').value = '2.0'; document.getElementById('smqf-texte').value = 'Satisfaire nos clients et progresser'; await smqEnregistrer();
    var p2 = DATA.smq_politiques[1]; p2.approbateur = 'DG'; p2.date_approbation = today(); await smqTransition('pol', p2.id, 'approuvee');
    o.v1apres = p1.statut; o.v2 = p2.statut;
    smqOuvrirFiche('pol', p2.id); document.getElementById('smqf-version').value = '2.1'; await smqEnregistrer(); o.modifApprouvee = p2.version;
    smqOnglet('obj'); smqNouveau('obj');
    document.getElementById('smqf-intitule').value = 'Recouvrer 90 % des échéances'; document.getElementById('smqf-cible').value = '90 %'; document.getElementById('smqf-echeance').value = '2000-01-01';
    await smqEnregistrer(); var ob = DATA.smq_objectifs[0]; o.refObj = ob.ref; o.statutObj = ob.statut; o.retard = _smqObjRetard(ob);
    smqOuvrirFiche('obj', ob.id); document.getElementById('smqf-statut').value = 'atteint'; await smqEnregistrer(); o.sansValeur = DATA.smq_objectifs[0].statut;
    smqOuvrirFiche('obj', ob.id); document.getElementById('smqf-statut').value = 'atteint'; document.getElementById('smqf-valeur_actuelle').value = '92 %'; await smqEnregistrer();
    o.atteint = DATA.smq_objectifs[0].statut; o.retardApres = _smqObjRetard(DATA.smq_objectifs[0]);
    return o;
  });
  assert.equal(r.statut0, 'brouillon'); assert.equal(r.sansApprobateur, 'brouillon'); assert.equal(r.v1, 'approuvee');
  assert.equal(r.v1apres, 'remplacee'); assert.equal(r.v2, 'approuvee'); assert.equal(r.modifApprouvee, '2.0');
  assert.match(r.refObj, /^OBJ-\d{4}-0001$/); assert.equal(r.statutObj, 'en_cours'); assert.ok(r.retard);
  assert.equal(r.sansValeur, 'en_cours'); assert.equal(r.atteint, 'atteint'); assert.ok(!r.retardApres);
});

test('risques : niveau, traitement exigé, clôture conditionnée à une criticité résiduelle plus basse', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    var o = {};
    o.niveaux = [_smqNiveau(1, 1), _smqNiveau(2, 3), _smqNiveau(3, 3), _smqNiveau(4, 4)].join(',');
    smqOnglet('rsq'); smqNouveau('rsq');
    document.getElementById('smqf-description').value = 'Perte de données de caisse'; document.getElementById('smqf-prob').value = '3'; document.getElementById('smqf-impact').value = '4';
    await smqEnregistrer(); var k = DATA.smq_risques[0]; o.ref = k.ref; o.statut0 = k.statut; o.niveau = _smqNiveau(k.prob, k.impact);
    await smqTransition('rsq', k.id, 'en_traitement'); o.sansAction = k.statut;
    k.action_traitement = 'Sauvegardes quotidiennes'; k.responsable = 'Admin'; k.echeance = '2000-01-01';
    await smqTransition('rsq', k.id, 'en_traitement'); o.traitement = k.statut; o.retard = _smqRsqRetard(k);
    await smqTransition('rsq', k.id, 'traite'); o.sansDate = k.statut;
    k.date_traitement = today(); await smqTransition('rsq', k.id, 'traite'); o.traite = k.statut; o.retardApres = _smqRsqRetard(k);
    await smqTransition('rsq', k.id, 'clos'); o.sansResiduelle = k.statut;
    k.prob_res = '4'; k.impact_res = '4'; await smqTransition('rsq', k.id, 'clos'); o.pire = k.statut;
    k.prob_res = '1'; k.impact_res = '2'; await smqTransition('rsq', k.id, 'clos'); o.clos = k.statut;
    smqOnglet('rsq'); o.matrice = document.getElementById('smq-contenu').innerHTML.indexOf('Matrice des risques') !== -1;
    smqNouveau('rsq'); document.getElementById('smqf-type').value = 'Opportunité'; document.getElementById('smqf-description').value = 'Paiement mobile'; await smqEnregistrer();
    var op = DATA.smq_risques[1]; op.action_traitement = 'Lancer'; op.responsable = 'Com'; op.echeance = '2999-01-01'; await smqTransition('rsq', op.id, 'en_traitement');
    op.date_traitement = today(); await smqTransition('rsq', op.id, 'traite'); await smqTransition('rsq', op.id, 'clos'); o.opportuniteClose = op.statut;
    var e = smqEntreesAuto('2000-01-01', '2999-12-31'); o.entrees = e.risques.ouverts + '/' + e.objectifs.total + '/' + (e.politique === null);
    return o;
  });
  assert.equal(r.niveaux, 'Faible,Moyen,Élevé,Critique');
  assert.match(r.ref, /^RSQ-\d{4}-0001$/); assert.equal(r.statut0, 'identifie'); assert.equal(r.niveau, 'Élevé');
  assert.equal(r.sansAction, 'identifie'); assert.equal(r.traitement, 'en_traitement'); assert.ok(r.retard);
  assert.equal(r.sansDate, 'en_traitement'); assert.equal(r.traite, 'traite'); assert.ok(!r.retardApres);
  assert.equal(r.sansResiduelle, 'traite'); assert.equal(r.pire, 'traite'); assert.equal(r.clos, 'clos');
  assert.ok(r.matrice); assert.equal(r.opportuniteClose, 'clos'); assert.equal(r.entrees, '0/0/true');
});

test('indicateurs automatiques : formules calculées sur les données, relevés, état vs cible, fiche et revue', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    var o = {}, auj = today(), a = '2000-01-01', b = '2999-12-31';
    var jour = function (n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    o.nb = Object.keys(SMQ_CALCULS).length;
    DATA.validations = [{ statut: 'valide', date_demande: jour(10), date_decision: jour(6) }, { statut: 'rejete', date_demande: jour(5), date_decision: jour(3) }, { statut: 'en_attente', date_demande: jour(1) }];
    var g = function (k) { var x = smqCalculer(k, a, b); return x ? x.v : null; };
    o.val = [g('val_delai'), g('val_attente'), g('val_rejet')].join('|');
    DATA.smq_nc = [{ statut: 'ouverte', echeance: '2000-01-01', date: jour(9) }, { statut: 'cloturee', date: jour(9), cloture_le: jour(5) }];
    o.nc = [g('nc_ouvertes'), g('nc_retard'), g('nc_delai')].join('|');
    DATA.smq_satisfaction = [{ date: auj, note: 5 }, { date: auj, note: 4 }, { date: auj, note: 2 }, { date: auj, note: 'x' }];
    o.sat = [g('sat_note'), g('sat_pct')].join('|');
    DATA.smq_reclamations = [{ date: jour(4), statut: 'traitee', date_reponse: jour(2) }, { date: jour(4), statut: 'recue' }];
    o.rcl = [g('rcl_delai'), g('rcl_traitees')].join('|');
    DATA.smq_documents = [{ statut: 'approuve', prochaine_revue: '2000-01-01' }]; o.doc = [g('doc_approuves'), g('doc_revue')].join('|'); o.docAttendu = Math.round(1000 / MANUELS_CATALOGUE.length) / 10 + '|1';
    DATA.smq_risques = [{ type: 'Risque', statut: 'identifie', prob: '4', impact: '3' }, { type: 'Risque', statut: 'clos', prob: '4', impact: '4' }, { type: 'Opportunité', statut: 'identifie', prob: '4', impact: '4' }]; o.rsq = g('rsq_eleves');
    DATA.factures_client = [{ statut_fne: 'erreur' }, { statut_fne: 'certifiee' }]; o.fne = g('fne_erreur');
    DATA.etapes_itineraire = [{ statut: 'realise', date: auj }, { statut: 'planifie', date: auj }, { statut: 'annule', date: auj }, { statut: 'realise', date: auj }]; o.vis = g('visites_realisees');
    DATA.bons_commande = [{ id: 'b1', date: jour(8) }]; DATA.receptions = [{ bc_id: 'b1', date: jour(2) }, { bc_id: 'zz', date: auj }]; o.bc = g('bc_delai');
    DATA.incidents = [{ date: auj, statut: 'resolu' }, { date: auj, statut: 'nouveau' }, { date: auj, statut: 'en_cours' }, { date: auj, statut: 'resolu' }]; o.inc = g('inc_resolus');
    DATA.smq_audits = []; o.vide = [smqCalculer('val_delai', '3000-01-01', '3000-12-31'), smqCalculer('inconnu', a, b)].join('|');
    o.etats = [smqEtat({ valeur: '95', cible: '90', sens: 'min' }), smqEtat({ valeur: '5', cible: '3', sens: 'max' }), smqEtat({ valeur: '5', cible: '', sens: 'max' }), smqEtat({ valeur: '4,5', cible: '4', sens: 'min' })].join('|');
    // fiche : actualisation, relevés conservés, valeur écrite
    DATA.params = DATA.params || {}; DATA.params.smq_processus = {};
    switchTab('params', 'manuels'); manuelsChangerVue('carto'); smqOuvrir('pilotage'); smqSuggerer('k');
    var iNc = _smqEdit.indicateurs.findIndex(function (k) { return k.calcul === 'nc_ouvertes'; });
    document.getElementById('smq-k-valide-' + iNc).checked = true; document.getElementById('smq-k-cible-' + iNc).value = '0';
    var iSens = document.getElementById('smq-k-sens-' + iNc).value; o.sensSuggere = iSens;
    smqActualiserFiche(); var k = _smqEdit.indicateurs[iNc]; o.valeur = k.valeur; o.releves = k.releves.length; o.etat = smqEtat(k);
    smqActualiserFiche(); o.relevesJour = _smqEdit.indicateurs[iNc].releves.length;
    var iNon = _smqEdit.indicateurs.findIndex(function (x) { return x.calcul === 'nc_retard'; }); o.nonValide = _smqEdit.indicateurs[iNon].valeur;
    await smqSauver(); var d = smqDonnees('pilotage'); o.sauve = d.indicateurs.filter(function (x) { return x.calcul === 'nc_ouvertes'; })[0].valeur;
    // actualisation globale + revue
    DATA.smq_nc.push({ statut: 'ouverte', date: auj }); await smqActualiserTout(); o.global = smqDonnees('pilotage').indicateurs.filter(function (x) { return x.calcul === 'nc_ouvertes'; })[0].valeur;
    var e = smqEntreesAuto('2000-01-01', '2999-12-31'); var ik = e.indicateurs.filter(function (x) { return x.lib === 'Non-conformités ouvertes'; })[0]; o.revue = ik.valeur + '|' + ik.auto + '|' + ik.etat;
    o.resume = smqResumeHtml('pilotage').indexOf('hors cible') !== -1;
    return o;
  });
  assert.equal(r.nb, 23);
  assert.equal(r.val, '3|1|50'); assert.equal(r.nc, '1|1|4'); assert.equal(r.sat, '3.67|66.7'); assert.equal(r.rcl, '2|50');
  assert.equal(r.doc, r.docAttendu); assert.equal(r.rsq, 1); assert.equal(r.fne, 1); assert.equal(r.vis, 66.7); assert.equal(r.bc, 6); assert.equal(r.inc, 50);
  assert.equal(r.vide, '|'); assert.equal(r.etats, 'ok|ko||ok');
  assert.equal(r.sensSuggere, 'max'); assert.equal(r.valeur, '1'); assert.equal(r.releves, 1); assert.equal(r.etat, 'ko'); assert.equal(r.relevesJour, 1);
  assert.equal(r.nonValide, ''); assert.equal(r.sauve, '1'); assert.equal(r.global, '2'); assert.equal(r.revue, '2|true|ko'); assert.ok(r.resume);
});

test('matrice des compétences : référentiel, évaluation, écarts, périmées, dépendances, plan de formation, indicateur', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    var o = {}, an = new Date().getFullYear();
    DATA.employes = [{ id: 'e1', nom: 'Kone', prenoms: 'Awa', statut: 'actif', poste: 'Caissière' }, { id: 'e2', nom: 'Diallo', prenoms: 'Ali', statut: 'actif', poste: 'Comptable' }, { id: 'e3', nom: 'Sorti', prenoms: 'X', statut: 'actif', date_depart: '2000-01-01' }];
    DATA.params = DATA.params || {}; DATA.params.smq_competences = []; DATA.smq_evaluations = []; DATA.formations_rh = [];
    await smqCmpSuggerer(); o.sug = smqCmpRef().length; await smqCmpSuggerer(); o.sug2 = smqCmpRef().length;
    var c = smqCmpRef()[0]; c.requis = 3;
    o.vide = smqCmpBilan().couverture;
    o.futur = (await smqCmpNoter('e1', c.id, 2, '2999-01-01', '')).ok; o.hors = (await smqCmpNoter('e1', c.id, 9, '', '')).ok; o.inconnu = (await smqCmpNoter('zz', c.id, 3, '', '')).ok;
    await smqCmpNoter('e1', c.id, 2, '', 'Observation'); await smqCmpNoter('e2', c.id, 4, '2000-01-01', 'Diplôme'); await smqCmpNoter('e3', c.id, 0, '', '');
    var b = smqCmpBilan(); o.evalues = b.evalues; o.ecarts = b.ecarts.length; o.ecartEmp = b.ecarts[0].emp.id; o.perimees = b.perimees; o.couv = b.couverture; o.dep = b.dependances.some(function (d) { return d.c.id === c.id && d.nb === 1; });
    await smqCmpNoter('e1', c.id, 3, '', 'Formation'); o.histo = _smqCmpEval('e1', c.id).historique.length; o.apres = smqCmpBilan().ecarts.length; o.couvApres = smqCmpBilan().couverture;
    await smqCmpNoter('e1', c.id, 1, '', ''); var p = await smqCmpPlanifierFormation(c.id); o.frm = DATA.formations_rh.length + ':' + DATA.formations_rh[0].participants.join(); var p2 = await smqCmpPlanifierFormation(c.id); o.doublon = DATA.formations_rh.length + ':' + !!p2.existe;
    o.calc = smqCalculer('comp_couverture', '2000-01-01', '2999-12-31').v;
    smqOnglet('cmp'); o.html = document.getElementById('smq-contenu').innerHTML.indexOf('Plan de formation') !== -1; smqCmpNoterOuvrir('e1', c.id); o.form = document.getElementById('smqe-niveau') ? 1 : 0;
    window.smqPeutEditer = function () { return false; }; o.ro = (await smqCmpNoter('e1', c.id, 4, '', '')).ok;
    return o;
  });
  assert.ok(r.sug >= 10); assert.equal(r.sug2, r.sug); assert.equal(r.vide, null);
  assert.equal(r.futur, false); assert.equal(r.hors, false); assert.equal(r.inconnu, false);
  assert.equal(r.evalues, 2); assert.equal(r.ecarts, 1); assert.equal(r.ecartEmp, 'e1');
  assert.equal(r.perimees, 1); assert.equal(r.couv, 50); assert.ok(r.dep);
  assert.equal(r.histo, 1); assert.equal(r.apres, 0); assert.equal(r.couvApres, 100);
  assert.equal(r.frm, '1:e1'); assert.equal(r.doublon, '1:true'); assert.equal(r.calc, 50);
  assert.ok(r.html); assert.equal(r.form, 1); assert.equal(r.ro, false);
});

test('contexte et parties intéressées : nature SWOT, suggestions sans doublon, revue, lien vers un risque, revue de direction, indicateur', async () => {
  const app = await ouvrir(true);
  const r = await app.page.evaluate(async function () {
    var o = {}, an = new Date().getFullYear();
    DATA.smq_enjeux = []; DATA.smq_parties = []; DATA.smq_risques = [];
    o.nature = [_smqNatureEnjeu({ type: 'Interne', effet: 'Positif' }), _smqNatureEnjeu({ type: 'Interne', effet: 'Négatif' }), _smqNatureEnjeu({ type: 'Externe', effet: 'Positif' }), _smqNatureEnjeu({ type: 'Externe', effet: 'Négatif' })].join('|');
    smqOnglet('ctx'); smqNouveau('ctx'); o.statut0 = _smqForm.rec.statut; o.revue0 = _smqForm.rec.prochaine_revue > today();
    await smqEnregistrer(); o.sansIntitule = DATA.smq_enjeux.length;
    document.getElementById('smqf-intitule').value = 'Litige foncier majeur'; document.getElementById('smqf-effet').value = 'Négatif'; document.getElementById('smqf-type').value = 'Externe';
    document.getElementById('smqf-prochaine_revue').value = '2000-01-01'; await smqEnregistrer(); o.revueAvant = DATA.smq_enjeux.length;
    smqNouveau('ctx'); document.getElementById('smqf-intitule').value = 'Litige foncier majeur'; document.getElementById('smqf-effet').value = 'Négatif'; document.getElementById('smqf-type').value = 'Externe'; await smqEnregistrer();
    var e = DATA.smq_enjeux[0]; o.ref = e.ref; o.an = an; o.natureEnr = _smqNatureEnjeu(e);
    smqNouveau('ppi'); await smqEnregistrer(); o.sansNom = DATA.smq_parties.length;
    document.getElementById('smqf-nom').value = 'Conservation foncière'; document.getElementById('smqf-attentes').value = 'Dossiers complets'; await smqEnregistrer(); o.ppiRef = DATA.smq_parties[0].ref;
    var s1 = await smqCtxSuggerer(); var n1 = DATA.smq_enjeux.length + ':' + DATA.smq_parties.length; var s2 = await smqCtxSuggerer(); o.sug = n1; o.sug2 = DATA.smq_enjeux.length + ':' + DATA.smq_parties.length; o.sugAjoutes = s1.enjeux + ':' + s1.parties + '/' + s2.enjeux + ':' + s2.parties;
    o.html = document.getElementById('smq-contenu').innerHTML; o.swot = o.html.indexOf('Menaces') !== -1 && o.html.indexOf('Parties intéressées pertinentes') !== -1; delete o.html;
    e.prochaine_revue = '2000-01-01'; o.depasse = _smqCtxRevueDepassee(e); var c1 = smqCalculer('ctx_revue', '2000-01-01', '2999-12-31').v;
    await smqCtxRevu('ctx', e.id); o.apresRevu = _smqCtxRevueDepassee(e); var c2 = smqCalculer('ctx_revue', '2000-01-01', '2999-12-31').v; o.calc = c1 < c2;
    smqCreerRisqueEnjeu(e.id); o.rsqType = _smqForm.rec.type; o.rsqDesc = _smqForm.rec.description.indexOf(e.ref) !== -1;
    document.getElementById('smqf-description').value = 'Litige'; await smqEnregistrer(); o.lie = e.risque_ref === DATA.smq_risques[0].ref; smqCreerRisqueEnjeu(e.id); o.deja = _smqForm == null || _smqForm.kind !== 'rsq' || !_smqForm.nouveau;
    var ent = smqEntreesAuto('2000-01-01', '2999-12-31').contexte; o.entrees = ent.enjeux > 0 && ent.parties > 0;
    await smqTransition('ctx', e.id, 'archive'); o.archive = e.statut;
    window.smqPeutEditer = function () { return false; }; o.ro = (await smqCtxSuggerer()).ok;
    return o;
  });
  assert.equal(r.nature, 'Force|Faiblesse|Opportunité|Menace'); assert.equal(r.statut0, 'actif'); assert.ok(r.revue0);
  assert.equal(r.sansIntitule, 0); assert.equal(r.revueAvant, 1);
  assert.equal(r.ref, 'ENJ-' + r.an + '-0001'); assert.equal(r.natureEnr, 'Menace'); assert.equal(r.sansNom, 0); assert.equal(r.ppiRef, 'PIN-' + r.an + '-0001');
  assert.equal(r.sug2, r.sug); assert.ok(r.swot); assert.ok(r.depasse); assert.equal(r.apresRevu, false); assert.ok(r.calc);
  assert.equal(r.rsqType, 'Risque'); assert.ok(r.rsqDesc); assert.ok(r.lie); assert.ok(r.deja); assert.ok(r.entrees); assert.equal(r.archive, 'archive'); assert.equal(r.ro, false);
});
