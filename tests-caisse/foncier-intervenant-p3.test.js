/* Foncier Connect — portail intervenants (P3) : dépôt, soumission, demande d'informations.
   Le portail écrit en SQL (fc_intervenant_deposer / soumettre / demander_info / reprendre) ; l'ERP doit comprendre ces lignes,
   poursuivre le workflow (vérification, validation, refus) et ne pas écraser en silence ce que le portail a écrit. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }]; DATA.parcelles = [{ id: 'p1', ref: 'PARC-1' }];
    window.userPeutSurStore = function () { return true; }; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'admin' }; window.syncToSupabase = function () {};
    DATA.dossiers_fonciers = []; DATA.evenements_fonciers = []; DATA.intervenants_fonciers = []; DATA.missions_foncieres = []; DATA.notifications_foncieres = [];
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var i = (await fcEnregistrerIntervenant({ nom_organisation: 'Cabinet Géo', type: 'geometre', email: 'geo@x.ci' })).intervenant;
    var m = (await fcCreerMission({ dossier_id: d.id, intervenant_id: i.id, titre: 'Bornage', livrables: ['Plan', 'PV'], echeance: '2099-12-31', etape_code: 'reception_livrables' })).mission;
    await fcChangerStatutMission(m.id, 'envoyee'); await fcChangerStatutMission(m.id, 'acceptee', { reference: 'mail' }); await fcChangerStatutMission(m.id, 'en_cours');
    return { d: d.id, i: i.id, m: m.id, l1: m.livrables[0].id, l2: m.livrables[1].id };
  });
}
/* Reproduit EXACTEMENT ce que font les fonctions SQL du portail (champs écrits et événement au format fcEvenement). */
const portail = {
  deposer: (page, ids, livrable, ref, note) => page.evaluate(function (a) {
    var m = fcMission(a.m), l = m.livrables.find(function (x) { return x.id === a.livrable; }), maintenant = new Date().toISOString();
    l.versions.push({ numero: l.versions.length + 1, reference: a.ref, note: a.note, date: maintenant.slice(0, 10), depose_par: 'Cabinet Géo', statut: 'soumis', refus: null }); m._modifie = maintenant;
    DATA.evenements_fonciers.push({ id: 'dep' + l.versions.length + a.livrable, dossier_id: m.dossier_id, etape_code: m.etape_code, type: 'livrable_depose', description: m.reference + ' — « ' + l.libelle + ' » : version ' + l.versions.length + ' déposée',
      ancien: '', nouveau: '', source: 'prestataire', source_ref: a.ref, motif: '', acteur: 'Cabinet Géo', acteur_id: a.i, acteur_role: 'intervenant', date: maintenant, mission_id: a.m });
  }, Object.assign({ livrable: livrable, ref: ref, note: note }, ids)),
  statut: (page, ids, de, vers, motif) => page.evaluate(function (a) {
    var m = fcMission(a.m), maintenant = new Date().toISOString(); m.statut = a.vers; m._modifie = maintenant;
    DATA.evenements_fonciers.push({ id: 'st' + a.vers, dossier_id: m.dossier_id, etape_code: m.etape_code, type: 'mission_statut', description: m.reference + ' : ' + FC_STATUTS_MISSION[a.de] + ' → ' + FC_STATUTS_MISSION[a.vers],
      ancien: a.de, nouveau: a.vers, source: 'prestataire', source_ref: '', motif: a.motif || '', acteur: 'Cabinet Géo', acteur_id: a.i, acteur_role: 'intervenant', date: maintenant, mission_id: a.m });
  }, Object.assign({ de: de, vers: vers, motif: motif }, ids)),
};

test('dépôt puis soumission par le portail : le responsable est notifié deux fois, sans doublon', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await portail.deposer(app.page, ids, ids.l1, 'LIEN/plan.pdf', 'Plan 1/500');
  await portail.statut(app.page, ids, 'en_cours', 'livrable_soumis');
  const r = await app.page.evaluate(async function () {
    var n = await fcRattraperNotifications(), n2 = await fcRattraperNotifications();
    return { n: n, n2: n2, notifs: DATA.notifications_foncieres.filter(function (x) { return x.event_id === 'dep1' + DATA.missions_foncieres[0].livrables[0].id || x.event_id === 'stlivrable_soumis'; }).map(function (x) { return [x.titre, x.destinataire_id]; }).sort() };
  });
  assert.deepEqual(r.notifs, [['Livrable déposé à vérifier', 'u1'], ['Livrables soumis pour vérification', 'u1']]);
  assert.equal(r.n2, 0);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('demande d\'informations par le portail : le responsable reçoit la question', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await portail.statut(app.page, ids, 'en_cours', 'attente_informations', 'Il manque le titre foncier');
  const r = await app.page.evaluate(async function () { await fcRattraperNotifications(); return DATA.notifications_foncieres.filter(function (x) { return x.event_id === 'stattente_informations'; }).map(function (x) { return [x.titre, x.destinataire_id, x.message]; }); });
  assert.equal(r.length, 1); assert.equal(r[0][0], 'Informations demandées par un intervenant'); assert.equal(r[0][1], 'u1');
  assert.match(r[0][2], /Il manque le titre foncier/);
});

test('une soumission saisie dans l\'ERP par le personnel ne notifie pas le responsable à tort (source « promoteur »)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (a) {
    await fcSoumettreLivrable(a.m, a.l1, { reference: 'x.pdf' }); var avant = DATA.notifications_foncieres.length;
    await fcChangerStatutMission(a.m, 'livrable_soumis');
    return DATA.notifications_foncieres.slice(avant).filter(function (x) { return x.titre === 'Livrables soumis pour vérification'; }).length;
  }, ids);
  assert.equal(r, 0);
});

test('l\'ERP poursuit après le portail : vérification, refus, nouvelle version visible de l\'intervenant', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await portail.deposer(app.page, ids, ids.l1, 'LIEN/plan.pdf', 'Plan 1/500'); await portail.deposer(app.page, ids, ids.l2, '', 'PV remis');
  await portail.statut(app.page, ids, 'en_cours', 'livrable_soumis');
  const r = await app.page.evaluate(async function (a) {
    var v = await fcChangerStatutMission(a.m, 'en_verification');
    var ok = await fcValiderLivrable(a.m, a.l2);
    var ref = await fcRefuserLivrable(a.m, a.l1, { motif: 'Échelle incorrecte', elements: 'Refaire à 1/500' });
    var vue = fcVueIntervenant(a.i).missions[0];
    return { v: v.ok, ok: ok.ok, ref: ref.ok, statut: vue.statut, plan: vue.livrables[0].versions, pv: vue.livrables[1].versions[0].statut };
  }, ids);
  assert.equal(r.v, true); assert.equal(r.ok, true); assert.equal(r.ref, true); assert.equal(r.statut, 'a_corriger');
  assert.equal(r.plan[0].statut, 'refuse'); assert.equal(r.plan[0].refus.elements, 'Refaire à 1/500');
  assert.equal(r.plan[0].reference, 'LIEN/plan.pdf', 'l\'intervenant retrouve la référence qu\'il a déposée'); assert.equal(r.plan[0].note, 'Plan 1/500');
  assert.equal(r.pv, 'valide');
});

test('la vue de l\'intervenant ne montre toujours rien d\'interne malgré la référence et la note des versions', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await portail.deposer(app.page, ids, ids.l1, 'LIEN/plan.pdf', 'Plan 1/500');
  const t = await app.page.evaluate(function (a) { fcDossier(fcMission(a.m).dossier_id).observations = 'NOTE INTERNE'; return JSON.stringify(fcVueIntervenant(a.i)); }, ids);
  assert.equal(/INTERNE|observations|responsable|montant|prix/i.test(t), false);
});

test('écrasement : chaque sauvegarde d\'une mission mémorise la version précédente (_baseModifie) pour la détection de conflit', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (a) {
    var m = fcMission(a.m); m._modifie = '2026-01-01T00:00:00.000Z'; delete m._baseModifie;
    await fcSauverMission(m);
    var un = { base: m._baseModifie, modifie: m._modifie };
    await fcSauverMission(m);
    return { un: un, deux: { base: m._baseModifie, modifie: m._modifie } };
  }, ids);
  assert.equal(r.un.base, '2026-01-01T00:00:00.000Z'); assert.ok(r.un.modifie > r.un.base);
  assert.equal(r.deux.base, r.un.modifie, 'la base suit la dernière version connue');
});

test('écrasement : les missions sont dans la liste des stores à détection de conflit de synchro', async () => {
  const page = ['menko-immo.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f) && /var _STORES_CONFLIT/.test(fs.readFileSync(f, 'utf8')));
  const src = fs.readFileSync(page, 'utf8');
  const m = src.match(/var _STORES_CONFLIT = \[([^\]]*)\]/);
  assert.ok(m, 'liste introuvable'); assert.ok(m[1].includes("'pi_missions_foncieres'"));
});
