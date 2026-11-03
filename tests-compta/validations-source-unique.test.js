/* La hiérarchie (module Validations) est la SEULE source de validation ; ce qui est décidé sort de « En attente ». */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const USERS = [
  { id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }, { id: 's1', nom: 'Foncier 1', login: 's1', role: 'service_foncier' }
];
async function preparer(page) {
  await page.evaluate(async (users) => {
    window.toast = m => { (window.__t = window.__t || []).push(m); };
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.params.fc_validation_fonctions = true; DATA.params.fc_fonctions_roles = undefined;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = users; window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers', 'validations'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {}; window.confirm = () => true;
  }, USERS);
}
/* dossier avec « identification_procedure » en attente de validation de la direction */
const DEMANDE = async () => {
  const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier;
  APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };
  await fcChangerStatutEtape(d.id, 'creation_dossier', 'termine', {}); await fcChangerStatutEtape(d.id, 'completude_documents', 'termine', {});
  await fcChangerStatutEtape(d.id, 'identification_procedure', 'en_cours', {});
  await fcDemanderValidationEtape(d.id, 'identification_procedure');
  APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
  return d;
};

test('la décision ne se prend que dans Validations : ni appel direct, ni « Terminer » d\'un validateur', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (demande) => {
      const d = await eval('(' + demande + ')')(); const o = {};
      o.direct = (await fcDecisionValidationEtape(d.id, 'identification_procedure', 'validee')).ok;
      const t = await fcChangerStatutEtape(d.id, 'identification_procedure', 'termine', {});
      o.terminer = [t.ok, !!t.validation_requise];
      o.etape = fcEtape(fcDossier(d.id), 'identification_procedure').statut;
      o.boutons = (() => { const h = fcValidationHtml(fcDossier(d.id), fcEtape(fcDossier(d.id), 'identification_procedure')); return { valider: /fcValiderEtapeUI\([^)]*true/.test(h), refuser: /fcValiderEtapeUI\([^)]*false/.test(h), lien: /Ouvrir Validations/.test(h) }; })();
      return o;
    }, DEMANDE.toString());
    assert.equal(r.direct, false);
    assert.deepEqual(r.terminer, [false, true]);
    assert.equal(r.etape, 'en_cours');
    assert.deepEqual(r.boutons, { valider: false, refuser: false, lien: true });
  } finally { await app.fermer(); }
});

test('une étape validée dans Validations sort de « En attente » (doublons compris) et passe à l\'Historique', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (demande) => {
      const d = await eval('(' + demande + ')')(); const o = {};
      const V = () => DATA.validations.filter(v => v.type === 'etape_fonciere');
      /* doublon : une 2e ligne identique (cas constaté : DF-2026-010 en double) */
      const copie = JSON.parse(JSON.stringify(V()[0])); copie.id = 'doublon'; DATA.validations.push(copie);
      o.avant = V().filter(v => v.statut === 'en_attente').length;
      await valDecide(V()[0].id, 'valide', '');
      o.apres = V().filter(v => v.statut === 'en_attente').length;
      o.statuts = V().map(v => v.statut).sort();
      o.etape = fcEtape(fcDossier(d.id), 'identification_procedure').statut;
      o.stampe = V().every(v => !!v._modifie);
      return o;
    }, DEMANDE.toString());
    assert.equal(r.avant, 2); assert.equal(r.apres, 0); assert.deepEqual(r.statuts, ['valide', 'valide']); assert.equal(r.etape, 'termine'); assert.equal(r.stampe, true);
  } finally { await app.fermer(); }
});

test('réconciliation : lignes restées « en attente » alors que l\'étape est décidée ailleurs ou le dossier clos', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (demande) => {
      const d = await eval('(' + demande + ')')(); const o = {};
      const V = () => DATA.validations.filter(v => v.type === 'etape_fonciere');
      const base = JSON.parse(JSON.stringify(V()[0]));
      /* A : décidée sur un autre poste (le dossier, qui se synchronise, dit « validée » ; la ligne locale est restée en attente) */
      const e = fcEtape(fcDossier(d.id), 'identification_procedure'); e.validation = { statut: 'validee', fonction: 'direction', par: 'Directeur', le: new Date().toISOString() }; e.statut = 'termine';
      /* B : ligne dont l'étape n'existe plus ; C : doublon plus ancien */
      const orpheline = Object.assign({}, base, { id: 'orph', ref_id: 'inconnu|x', meta: { dossier_id: 'inconnu', code: 'x' } });
      DATA.validations.push(orpheline);
      renderValidations();
      o.enAttente = V().filter(v => v.statut === 'en_attente').length;
      o.statuts = V().map(v => v.id === 'orph' ? 'orph:' + v.statut : v.statut).sort();
      return o;
    }, DEMANDE.toString());
    assert.equal(r.enAttente, 0);
    assert.deepEqual(r.statuts, ['orph:rejete', 'valide']);
  } finally { await app.fermer(); }
});

test('réconciliation : une étape refusée ou un dossier annulé ne reste pas en attente ; une demande valide reste', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  try {
    const r = await app.page.evaluate(async (demande) => {
      const d = await eval('(' + demande + ')')(); const o = {};
      const V = () => DATA.validations.filter(v => v.type === 'etape_fonciere');
      renderValidations(); o.demandeValideReste = V()[0].statut;           /* demande légitime : intacte */
      fcDossier(d.id).statut = 'annule'; renderValidations(); o.dossierAnnule = V()[0].statut + ':' + V()[0].motif;
      return o;
    }, DEMANDE.toString());
    assert.equal(r.demandeValideReste, 'en_attente');
    assert.match(r.dossierAnnule, /^rejete:Sans objet : dossier annule$/);
  } finally { await app.fermer(); }
});
