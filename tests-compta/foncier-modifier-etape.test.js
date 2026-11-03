/* Modification des informations d'une étape (libellé, responsable, échéance, observations), tracée au journal. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async () => {
    window.toast = m => { (window.__t = window.__t || []).push(m); }; window.confirm = () => true; window.syncToSupabase = () => {};
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.params.fc_validation_fonctions = false;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = [{ id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }, { id: 's1', nom: 'Foncier 1', login: 's1', role: 'service_foncier' }, { id: 's2', nom: 'Foncier 2', login: 's2', role: 'comptable' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    window.hasRole = r => !!APP.currentUser && APP.currentUser.role === r;   /* le harness compta force hasRole() à « vrai » : on le rend fidèle pour tester les droits */
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers', 'validations', 'audit_log'].forEach(s => { DATA[s] = []; });
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 's1' })).dossier;
    return { id: d.id, code: d.etapes[0].code, code2: d.etapes[2].code };
  });
}

test('modifier une étape : libellé, responsable, échéance, observations ; tout est tracé (avant → après) ; libellé d\'origine conservé', async () => {
  const app = await ouvrirApp(); const { id, code } = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async ({ id, code }) => {
      const avant = fcEtape(fcDossier(id), code).libelle;
      const res = await fcModifierEtape(id, code, { libelle: '  Création   du dossier — révisée ', responsable_id: 's2', date_cible: '2026-12-15', observations: 'Voir le géomètre' }, '');
      const e = fcEtape(fcDossier(id), code);
      const ev = DATA.evenements_fonciers.filter(x => x.type === 'modification_etape');
      const res2 = await fcModifierEtape(id, code, { libelle: e.libelle }, '');     /* rien ne change */
      return { ok: res.ok, n: res.modifications, avant, libelle: e.libelle, origine: e.libelle_origine, resp: e.responsable_id, ech: e.date_cible, obs: e.observations,
        evenements: ev.length, champs: ev.map(x => x.champ || (x.meta && x.meta.champ) || '').sort(), aucun: res2.modifications, nbEvtApres: DATA.evenements_fonciers.filter(x => x.type === 'modification_etape').length,
        ancienResp: (ev.find(x => (x.champ || (x.meta && x.meta.champ)) === 'responsable_id') || {}) };
    }, { id, code });
    assert.equal(r.ok, true); assert.equal(r.n, 4);
    assert.equal(r.libelle, 'Création du dossier — révisée'); assert.equal(r.origine, r.avant);
    assert.equal(r.resp, 's2'); assert.equal(r.ech, '2026-12-15'); assert.equal(r.obs, 'Voir le géomètre');
    assert.equal(r.evenements, 4);
    assert.equal(r.aucun, 0); assert.equal(r.nbEvtApres, 4, 'pas de trace si rien ne change');
  } finally { await app.fermer(); }
});

test('modifier une étape : contrôles (libellé vide, date invalide, responsable inconnu, champ interdit, statut non modifiable)', async () => {
  const app = await ouvrirApp(); const { id, code } = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async ({ id, code }) => {
      const e = () => fcEtape(fcDossier(id), code), st = e().statut, o = {};
      o.vide = (await fcModifierEtape(id, code, { libelle: '   ' }, '')).ok;
      o.date = (await fcModifierEtape(id, code, { date_cible: '31/02/2026x' }, '')).ok;
      o.resp = (await fcModifierEtape(id, code, { responsable_id: 'inconnu' }, '')).ok;
      o.statut = (await fcModifierEtape(id, code, { statut: 'termine' }, '')).ok;
      o.long = (await fcModifierEtape(id, code, { libelle: 'x'.repeat(161) }, '')).ok;
      o.intact = e().statut === st && e().libelle_origine === undefined;
      o.inconnue = (await fcModifierEtape(id, 'zz_inconnue', { libelle: 'a' }, '')).ok;
      return o;
    }, { id, code });
    assert.deepEqual([r.vide, r.date, r.resp, r.statut, r.long, r.inconnue], [false, false, false, false, false, false]);
    assert.equal(r.intact, true);
  } finally { await app.fermer(); }
});

test('modifier une étape : motif obligatoire si l\'étape est déjà terminée ; dossier clos ou annulé = refus ; droits', async () => {
  const app = await ouvrirApp(); const { id, code } = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async ({ id, code }) => {
      const o = {}; await fcChangerStatutEtape(id, code, 'termine', {});
      o.sansMotif = (await fcModifierEtape(id, code, { observations: 'ajout' }, '')).ok;
      o.avecMotif = (await fcModifierEtape(id, code, { observations: 'ajout' }, 'Précision demandée par la direction')).ok;
      o.motifTrace = (DATA.evenements_fonciers.filter(x => x.type === 'modification_etape').pop() || {}).motif;
      /* un utilisateur qui n'est ni responsable du dossier, ni de l'étape, ni admin */
      APP.currentUser = { id: 's2', nom: 'Foncier 2', role: 'comptable' };
      o.tiers = (await fcModifierEtape(id, code, { observations: 'intrus' }, 'x')).ok;
      APP.currentUser = { id: 's1', nom: 'Foncier 1', role: 'service_foncier' };   /* responsable du dossier */
      o.resp = (await fcModifierEtape(id, code, { observations: 'par le responsable' }, 'Mise à jour')).ok;
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
      fcDossier(id).statut = 'annule'; o.annule = (await fcModifierEtape(id, code, { observations: 'z' }, 'x')).ok;
      return o;
    }, { id, code });
    assert.equal(r.sansMotif, false); assert.equal(r.avecMotif, true); assert.equal(r.motifTrace, 'Précision demandée par la direction');
    assert.equal(r.tiers, false); assert.equal(r.resp, true); assert.equal(r.annule, false);
  } finally { await app.fermer(); }
});

test('écran : bouton « Modifier » sur chaque étape, fenêtre pré-remplie, enregistrement et rafraîchissement du dossier', async () => {
  const app = await ouvrirApp(); const { id, code } = await preparer(app.page);
  try {
    const r = await app.page.evaluate(async ({ id, code }) => {
      document.body.insertAdjacentHTML('beforeend', '<div id="fc-root"></div>'); fcRender(); fcOuvrirDetail(id); fcOnglet('etapes');
      const bouton = document.querySelector('#fc-detail tr[data-fcet="' + code + '"] button[onclick^="fcModifierEtapeUI"]');
      const nbBoutons = document.querySelectorAll('#fc-detail tr[data-fcet] button[onclick^="fcModifierEtapeUI"]').length, nbEtapes = fcDossier(id).etapes.length;
      bouton.click();
      const lib = document.getElementById('fc-me-lib'), prerempli = lib && lib.value === fcEtape(fcDossier(id), code).libelle;
      lib.value = 'Libellé modifié depuis la fenêtre'; document.getElementById('fc-me-obs').value = 'Note'; document.getElementById('fc-me-ech').value = '2026-11-30';
      await fcEnregistrerEtapeUI(id, code);
      return { nbBoutons, nbEtapes, prerempli, ferme: !document.getElementById('fc-modal-etape'), libelleDonnee: fcEtape(fcDossier(id), code).libelle,
               affiche: document.querySelector('#fc-detail tr[data-fcet="' + code + '"]').textContent.includes('Libellé modifié depuis la fenêtre') };
    }, { id, code });
    assert.equal(r.nbBoutons, r.nbEtapes); assert.equal(r.prerempli, true); assert.equal(r.ferme, true);
    assert.equal(r.libelleDonnee, 'Libellé modifié depuis la fenêtre'); assert.equal(r.affiche, true);
    assert.equal(app.etat.erreursPage.length, 0, app.etat.erreursPage.join('\n'));
  } finally { await app.fermer(); }
});
