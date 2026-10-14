/* Foncier Connect — droits et échecs d'écriture : jamais « enregistré » à tort. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1' }]; DATA.users = [{ id: 'u1', nom: 'R', login: 'r' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'R', role: 'foncier' };
    DATA.dossiers_fonciers = []; DATA.evenements_fonciers = []; DATA.intervenants_fonciers = [];
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    return d.id;
  });
}

test('sans droit sur le module : refus clair, aucune donnée modifiée en mémoire', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    window.userPeutSurStore = function () { return false; };
    var avant = JSON.stringify(fcDossier(id));
    var statut = await fcChangerStatutEtape(id, 'creation_dossier', 'termine', {});
    var nouveau = await fcOuvrirDossier({ parcelle_id: 'p1', type: 'mutation', responsable_id: 'u1' });
    var interv = await fcEnregistrerIntervenant({ nom_organisation: 'X', type: 'geometre', email: 'a@b.c' });
    return { statut: statut, nouveau: nouveau, interv: interv, inchange: JSON.stringify(fcDossier(id)) === avant, nb: DATA.dossiers_fonciers.length, ni: DATA.intervenants_fonciers.length };
  }, id);
  for (const x of [r.statut, r.nouveau, r.interv]) { assert.equal(x.ok, false); assert.match(x.erreur, /profil ne permet pas/); }
  assert.equal(r.inchange, true); assert.equal(r.nb, 1); assert.equal(r.ni, 0);
});

test('avec droit : tout fonctionne comme avant', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) { window.userPeutSurStore = function () { return true; }; return fcChangerStatutEtape(id, 'creation_dossier', 'termine', {}); }, id);
  assert.equal(r.ok, true);
});

test('écriture locale refusée (dbPut renvoie false) : erreur explicite, jamais « ok »', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    window.dbPut = async function () { return false; };
    return [await fcChangerStatutEtape(id, 'creation_dossier', 'termine', {}), await fcEnregistrerIntervenant({ nom_organisation: 'Y', type: 'notaire', email: 'a@b.c' })];
  }, id);
  for (const x of r) { assert.equal(x.ok, false); assert.match(x.erreur, /Enregistrement impossible/); }
  assert.deepEqual(app.etat.erreursPage, []);
});

test('les fonctions sont protégées une seule fois et les appels internes restent cohérents', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () { return { prot: typeof fcOuvrirDossier === 'function' && fcOuvrirDossier.__protegee === true, ui: typeof fcRenderSouscripteurs, db: typeof fcDb }; });
  assert.deepEqual(r, { prot: true, ui: 'function', db: 'function' });
});
