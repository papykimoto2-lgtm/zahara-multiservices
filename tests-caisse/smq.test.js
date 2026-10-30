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
