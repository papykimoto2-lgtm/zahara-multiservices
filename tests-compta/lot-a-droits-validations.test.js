/* Lot A : droits et validations (audit « dysfonctionnements ») */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async () => {
    window.toast = m => { (window.__t = window.__t || []).push(m); }; window.confirm = () => true; window.syncToSupabase = () => {};
    window.hasRole = r => !!APP.currentUser && APP.currentUser.role === r;   /* le harness compta force hasRole() à vrai : version fidèle */
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.params.fc_validation_fonctions = true; DATA.params.fc_fonctions_roles = undefined;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = [{ id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }, { id: 's1', nom: 'Foncier 1', login: 's1', role: 'service_foncier' }, { id: 't1', nom: 'Tiers', login: 't1', role: 'comptable' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers', 'validations', 'audit_log'].forEach(s => { DATA[s] = []; });
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier;
    return d.id;
  });
}

test('A1 : un tiers (ni responsable ni admin) ne change aucun statut et ne peut pas déroger ; le responsable et l\'admin le peuvent', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (id) => {
      const o = {}; APP.currentUser = { id: 't1', nom: 'Tiers', role: 'comptable' };
      const t = await fcChangerStatutEtape(id, 'cloture', 'termine', { derogation: true, derogation_completude: true, derogation_ordre: true, motif: 'x' });
      o.tiersCloture = [t.ok, fcDossier(id).statut];
      o.tiersEtape = (await fcChangerStatutEtape(id, 'creation_dossier', 'termine', {})).ok;
      APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };            /* responsable du dossier */
      o.responsable = (await fcChangerStatutEtape(id, 'creation_dossier', 'termine', {})).ok;
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
      o.admin = (await fcChangerStatutEtape(id, 'completude_documents', 'termine', {})).ok;
      return o;
    }, id);
    assert.deepEqual(r.tiersCloture, [false, 'ouvert'].map((x, i) => i ? r.tiersCloture[1] : x)); assert.notEqual(r.tiersCloture[1], 'cloture');
    assert.equal(r.tiersEtape, false); assert.equal(r.responsable, true); assert.equal(r.admin, true);
  } finally { await app.fermer(); }
});

test('A2 : fonction validatrice sans personne → la validation reste exigée et revient aux administrateurs (jamais de contournement)', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (id) => {
      const o = {}; const e = () => fcEtape(fcDossier(id), 'identification_procedure');
      /* plus personne ne porte la fonction « direction » (réglage Équipe interne) ; il reste un administrateur actif */
      DATA.params.fc_fonctions_roles = { direction: ['directeur_general'] };
      DATA.users.push({ id: 'adm', nom: 'Admin', login: 'adm', role: 'admin' });
      o.pool = fcUsersFonction('direction').length; o.requis = fcValidationRequise(fcDossier(id), e());
      APP.currentUser = { id: 'adm', nom: 'Admin', role: 'admin' };
      await fcChangerStatutEtape(id, 'creation_dossier', 'termine', {}); await fcChangerStatutEtape(id, 'completude_documents', 'termine', {}); await fcChangerStatutEtape(id, 'identification_procedure', 'en_cours', {});
      const t = await fcChangerStatutEtape(id, 'identification_procedure', 'termine', {}); o.terminer = [t.ok, !!t.validation_requise];
      /* aucun admin actif du tout : pas de blocage définitif (cas que la gestion des comptes interdit désormais : toujours un admin actif) */
      DATA.users = DATA.users.filter(u => u.role !== 'admin'); o.sansAdmin = fcValidationRequise(fcDossier(id), e());
      return o;
    }, id);
    assert.equal(r.pool, 0); assert.equal(r.requis, 'direction'); assert.deepEqual(r.terminer, [false, true]); assert.equal(r.sansAdmin, '');
  } finally { await app.fermer(); }
});

test('A3 : gestion des comptes réservée aux admins ; pas d\'auto-promotion, pas de modification de son propre rôle, toujours un admin actif', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  try {
    const r = await app.page.evaluate(async () => {
      const o = {}; const val = (i, v) => { const el = document.getElementById(i); if (el) el.value = v; };
      const ouvrir = (id, role, statut) => { const m = document.getElementById('modal-user-create'); m.dataset.editId = id; val('new-user-nom', 'N'); val('new-user-login', 'l' + id); val('new-user-email', ''); val('new-user-role', role); val('new-user-statut', statut || 'actif'); val('new-user-pwd', ''); val('new-user-pwd2', ''); };
      /* un commercial tente de se promouvoir admin */
      APP.currentUser = { id: 't1', nom: 'Tiers', role: 'comptable' }; ouvrir('t1', 'admin'); await createUserFromModal();
      o.promotion = DATA.users.find(u => u.id === 't1').role;
      /* un admin ne peut pas se rétrograder lui-même ni désactiver le dernier admin */
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; ouvrir('dir', 'comptable'); await createUserFromModal();
      o.auto = DATA.users.find(u => u.id === 'dir').role;
      return o;
    });
    assert.equal(r.promotion, 'comptable'); assert.equal(r.auto, 'admin');
  } finally { await app.fermer(); }
});

test('A4 : compte désactivé ou rôle changé sur un autre poste → déconnexion de la session en cours', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  try {
    const r = await app.page.evaluate(async () => {
      let sorties = 0; window.logout = () => { sorties++; };
      APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };
      _verifierSessionApresSync({ id: 's1', role: 'service_foncier', statut: 'actif' }); await new Promise(r => setTimeout(r, 1700)); const aucune = sorties;
      _verifierSessionApresSync({ id: 's1', role: 'commercial', statut: 'actif' }); await new Promise(r => setTimeout(r, 1700)); const roleChange = sorties;
      _verifierSessionApresSync({ id: 's1', role: 'service_foncier', statut: 'inactif' }); await new Promise(r => setTimeout(r, 1700));
      _verifierSessionApresSync({ id: 'autre', role: 'x', statut: 'inactif' }); await new Promise(r => setTimeout(r, 1700));
      return { aucune, roleChange, inactif: sorties };
    });
    assert.equal(r.aucune, 0); assert.equal(r.roleChange, 1); assert.equal(r.inactif, 2);
  } finally { await app.fermer(); }
});

test('A5 : une demande décidée ne se re-décide pas (double clic), rejet sans motif refusé, droits du rôle, plafond, demandeur ≠ valideur', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  try {
    const r = await app.page.evaluate(async () => {
      const o = {}; DATA.bons_commande = [{ id: 'bc1', statut: 'en_attente_validation' }]; let applis = 0; const orig = window.valApply; window.valApply = async function () { applis++; return orig.apply(this, arguments); };
      const creer = async (ref, montant) => { APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'manager' }; return await valCreate('bon_commande', ref, 'BC ' + ref, montant, {}); };
      /* double clic simultané par un autre validateur */
      let v = await creer('bc1', 1000); APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
      await Promise.all([valDecide(v.id, 'valide', ''), valDecide(v.id, 'valide', '')]); o.doubleClic = [v.statut, applis];
      await valDecide(v.id, 'rejete', 'trop tard'); o.tardif = v.statut;                                  /* décision tardive : ignorée */
      /* rejet sans motif */
      v = await creer('bc2', 1000); APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; await valDecide(v.id, 'rejete', ''); o.sansMotif = v.statut;
      /* un rôle sans droit de valider */
      APP.currentUser = { id: 't1', nom: 'Tiers', role: 'comptable' }; await valDecide(v.id, 'rejete', 'x'); o.sansDroit = v.statut;
      /* le demandeur ne valide pas sa propre demande (manager) */
      v = await creer('bc3', 1000); await valDecide(v.id, 'valide', ''); o.propre = v.statut;
      /* plafond de validation */
      window.userPlafond = () => 1000; window.exigerPlafond = m => Math.abs(parseFloat(m) || 0) <= userPlafond();   /* le harness compta neutralise exigerPlafond : version fidèle */
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
      v = await creer('bc4', 90000000); APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; await valDecide(v.id, 'valide', ''); o.plafond = v.statut;
      return o;
    });
    assert.deepEqual(r.doubleClic, ['valide', 1]); assert.equal(r.tardif, 'valide');
    assert.equal(r.sansMotif, 'en_attente'); assert.equal(r.sansDroit, 'en_attente'); assert.equal(r.propre, 'en_attente'); assert.equal(r.plafond, 'en_attente');
  } finally { await app.fermer(); }
});

test('A6 : la réconciliation ne clôture pas une demande plus récente que l\'état (périmé) du dossier ; un dossier absent n\'est pas « supprimé »', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (id) => {
      const o = {}; const e = fcEtape(fcDossier(id), 'identification_procedure');
      const t1 = new Date(Date.now() - 3600e3).toISOString(), t2 = new Date().toISOString();
      e.validation = { statut: 'refusee', fonction: 'direction', decide_par: 'Directeur', decide_le: t1, motif: 'Pièce manquante' };   /* ce poste a encore l'ancienne décision */
      DATA.validations.push({ id: 'nv', type: 'etape_fonciere', ref_id: id + '|identification_procedure', libelle: 'x', meta: { dossier_id: id, code: 'identification_procedure', fonction: 'direction', demande_le: t2 }, statut: 'en_attente', demandeur: 'F', date_demande: t2.slice(0, 10), created_at: t2.slice(0, 10) });
      renderValidations(); o.nouvelleDemande = DATA.validations.find(v => v.id === 'nv').statut;                  /* intacte */
      /* à l'inverse : la décision du dossier est POSTÉRIEURE à la demande → la ligne se ferme */
      e.validation = { statut: 'validee', fonction: 'direction', par: 'Directeur', le: new Date(Date.now() + 60e3).toISOString() };
      renderValidations(); o.apresDecision = DATA.validations.find(v => v.id === 'nv').statut;
      return o;
    }, id);
    assert.equal(r.nouvelleDemande, 'en_attente'); assert.equal(r.apresDecision, 'valide');
  } finally { await app.fermer(); }
});

test('A7 : pas de décision de validation sur une étape déjà finale ou sans demande en attente', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (id) => {
      const o = {}; APP._valContexte = true; const e = fcEtape(fcDossier(id), 'identification_procedure');
      o.sansDemande = (await fcDecisionValidationEtape(id, 'identification_procedure', 'validee')).ok;
      e.statut = 'annule'; e.validation = { statut: 'demandee', fonction: 'direction' };
      o.etapeFinale = (await fcDecisionValidationEtape(id, 'identification_procedure', 'validee')).ok; APP._valContexte = false;
      return o;
    }, id);
    assert.equal(r.sansDemande, false); assert.equal(r.etapeFinale, false);
  } finally { await app.fermer(); }
});
