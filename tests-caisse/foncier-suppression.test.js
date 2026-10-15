/* Foncier Connect — suppression d'un dossier (SUP1). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('suppression : admin seul, motif, refus si trace comptable, cascade et audit', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const r = await page.evaluate(async () => {
    window.syncToSupabase = function () {}; window.toast = function () {}; window.dbPut = async function () { return true; };
    window.userPeutSurStore = function () { return true; };
    DATA.params = DATA.params || {}; DATA.programmes = [{ id: 'g1', nom: 'R', division_id: 'dv1' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', programme_id: 'g1', statut: 'tf_definitif' }, { id: 'p2', ref: 'PARC-2', programme_id: 'g1', statut: 'tf_definitif' }];
    DATA.users = [{ id: 'u1', nom: 'Resp', login: 'rf', role: 'admin' }];
    ['dossiers_fonciers', 'evenements_fonciers', 'missions_foncieres', 'pieces_foncieres', 'audit_log', 'suppressions_sync'].forEach(function (s) { DATA[s] = []; });
    APP.currentUser = { id: 'u1', nom: 'Resp', role: 'admin' };
    var out = {}, a = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier, b = (await fcOuvrirDossier({ parcelle_id: 'p2', type: 'acd', responsable_id: 'u1' })).dossier;
    out.nonAdmin = (function () { window.hasRole = function () { return false; }; return null; })();
    out.refusNonAdmin = (await fcSupprimerDossier(a.id, 'motif assez long')).ok;
    window.hasRole = function (r) { return r === 'admin'; };
    out.refusMotif = (await fcSupprimerDossier(a.id, 'court')).ok;
    b.frais_titre = [{ id: 'f1', nature: 'honoraires_notaire', statut: 'comptabilise' }];
    out.refusCompta = (await fcSupprimerDossier(b.id, 'motif assez long')).ok;
    out.ev = DATA.evenements_fonciers.filter(function (e) { return e.dossier_id === a.id; }).length;
    var r = await fcSupprimerDossier(a.id, 'doublon créé par erreur');
    out.ok = r.ok; out.reste = !!fcDossier(a.id); out.evApres = DATA.evenements_fonciers.filter(function (e) { return e.dossier_id === a.id; }).length;
    out.audit = DATA.audit_log.filter(function (e) { return e.action === 'delete' && e.entite_id === a.id; }).map(function (e) { return e.snapshot._motif_suppression; });
    out.tomb = DATA.suppressions_sync.some(function (t) { return t.record_id === a.id; });
    out.autreIntact = !!fcDossier(b.id);
    return out;
  });
  assert.equal(r.refusNonAdmin, false); assert.equal(r.refusMotif, false); assert.equal(r.refusCompta, false);
  assert.ok(r.ok); assert.equal(r.reste, false); assert.equal(r.evApres, 0); assert.ok(r.ev >= 1);
  assert.deepEqual(r.audit, ['doublon créé par erreur']); assert.ok(r.tomb); assert.ok(r.autreIntact);
  assert.deepEqual(app.etat.erreursPage, []);
});
