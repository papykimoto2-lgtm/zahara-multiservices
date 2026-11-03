/* Suppression d'un dossier ayant des validations : rien d'orphelin, rien de perdu sans trace. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async () => {
    window.toast = () => {}; window.confirm = () => true; window.syncToSupabase = () => {};
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.params.fc_validation_fonctions = true;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = [{ id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }, { id: 's1', nom: 'F1', login: 's1', role: 'service_foncier' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers', 'validations', 'audit_log'].forEach(s => { DATA[s] = []; });
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier;
    APP.currentUser = { id: 's1', nom: 'F1', role: 'service_foncier' };
    await fcChangerStatutEtape(d.id, 'creation_dossier', 'termine', {}); await fcChangerStatutEtape(d.id, 'completude_documents', 'termine', {});
    await fcChangerStatutEtape(d.id, 'identification_procedure', 'en_cours', {}); await fcDemanderValidationEtape(d.id, 'identification_procedure');
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    const V = () => DATA.validations.filter(v => v.type === 'etape_fonciere');
    await valDecide(V()[0].id, 'valide', '');                      /* validation DÉCIDÉE */
    /* demande EN ATTENTE sur une 2e étape à validation (ligne fabriquée si le modèle n'en propose pas d'autre) */
    DATA.validations.push({ id: 'attente1', type: 'etape_fonciere', ref_id: d.id + '|zz', libelle: d.reference + ' — autre étape', meta: { dossier_id: d.id, code: 'zz', fonction: 'direction' }, statut: 'en_attente', demandeur: 'F1', date_demande: '2026-03-01', created_at: '2026-03-01' });
    DATA.publications_foncieres.push({ id: 'pub1', dossier_id: d.id, libelle_public: 'x', publie_le: '2026-01-01T00:00:00Z' });
    DATA.demandes_fonciers.push({ id: 'dem1', dossier_id: d.id });
    DATA.notifications_foncieres.push({ id: 'n1', dossier_id: d.id });
    DATA.publications_foncieres.push({ id: 'pubAutre', dossier_id: 'autre', libelle_public: 'y', publie_le: '2026-01-01T00:00:00Z' });   /* d'un AUTRE dossier : doit rester */
    return d.id;
  });
}

test('suppression : liés supprimés, demandes en attente closes, décisions conservées, journal et validations gardés en audit', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (id) => {
      const nbEvt = DATA.evenements_fonciers.filter(x => x.dossier_id === id).length;
      const res = await fcSupprimerDossier(id, 'Doublon créé par erreur lors du test');
      const V = DATA.validations.filter(v => v.type === 'etape_fonciere');
      const a = DATA.audit_log.filter(x => x.entite === 'dossiers_fonciers' && x.action === 'delete')[0] || {};
      return { ok: res.ok, dossier: !!fcDossier(id), nbEvt,
        validations: V.map(v => v.statut + ':' + (v.motif || '') + ':' + v.valideur).sort(),
        enAttente: V.filter(v => v.statut === 'en_attente').length,
        publications: DATA.publications_foncieres.map(x => x.id), demandes: DATA.demandes_fonciers.length, notifications: DATA.notifications_foncieres.length,
        auditValidations: ((a.snapshot || {})._validations || []).map(v => v.statut).sort(), auditJournal: ((a.snapshot || {})._journal || []).length };
    }, id);
    assert.equal(r.ok, true); assert.equal(r.dossier, false);
    assert.equal(r.enAttente, 0, 'plus de demande orpheline « en attente »');
    assert.deepEqual(r.validations, ['rejete:Dossier supprimé : Doublon créé par erreur lors du test:Directeur', 'valide::Directeur']);
    assert.deepEqual(r.publications, ['pubAutre']);
    assert.equal(r.demandes, 0); assert.equal(r.notifications, 0);
    assert.deepEqual(r.auditValidations, ['en_attente', 'valide']);   /* état AVANT suppression conservé */
    assert.equal(r.auditJournal, r.nbEvt); assert.ok(r.nbEvt > 0);
  } finally { await app.fermer(); }
});

test('suppression (écran) : le message annonce les validations rendues et en attente ; une 2e confirmation est exigée', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (id) => {
      let msg = '', confirmations = [];
      window.prompt = m => { msg = m; return 'Doublon créé par erreur lors du test'; };
      window.confirm = m => { confirmations.push(m); return false; };            /* l'utilisateur refuse la 2e confirmation */
      await fcSupprimerDossierUI(id); const apresRefus = !!fcDossier(id);
      window.confirm = m => { confirmations.push(m); return true; };
      await fcSupprimerDossierUI(id);
      return { msg, nbConf: confirmations.length, apresRefus, supprime: !fcDossier(id) };
    }, id);
    assert.match(r.msg, /1 déjà rendue\(s\)/); assert.match(r.msg, /1 en attente/); assert.match(r.msg, /archivez/);
    assert.equal(r.apresRefus, true, 'refus de la confirmation = dossier conservé');
    assert.equal(r.nbConf, 2); assert.equal(r.supprime, true);
  } finally { await app.fermer(); }
});
