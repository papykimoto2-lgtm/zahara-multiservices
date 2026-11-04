/* Foncier : changement de procédure d'un dossier déjà ouvert.
   Règle : les étapes engagées sont conservées, les étapes pas commencées sont remplacées, le tout tracé au journal. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  await page.evaluate(function () {
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville' }, { id: 'p2', ref: 'PARC-2', localisation: 'Bassam' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }, { id: 'u2', nom: 'Autre', login: 'au' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier' };
    DATA.dossiers_fonciers = []; DATA.evenements_fonciers = [];
    window.syncToSupabase = function () {};
    window.__ouvrir = function (type, extra) { return fcOuvrirDossier(Object.assign({ parcelle_id: 'p1', type: type, responsable_id: 'u1' }, extra || {})); };
  });
}

test('changement de procédure : étapes engagées conservées, étapes pas commencées remplacées, journal et historique', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    const a = await __ouvrir('acd'); const d = a.dossier;
    const avant = d.etapes.map(function (e) { return e.code; });
    const eng = d.etapes[1]; eng.statut = 'en_cours'; eng.date_debut = '2026-10-01'; eng.observations = 'Démarrée';
    const res = await fcChangerProcedure(d.id, 'regularisation', 'Le terrain relève finalement d\'une régularisation', {});
    const apres = DATA.dossiers_fonciers[0];
    const ev = DATA.evenements_fonciers.filter(function (e) { return e.type === 'changement_procedure'; });
    return { res: res, avant: avant, engCode: eng.code, apresCodes: apres.etapes.map(function (e) { return e.code; }), type: apres.type_procedure,
             engStatut: (apres.etapes.find(function (e) { return e.code === eng.code; }) || {}).statut, hist: apres.historique_procedures, ev: ev.map(function (e) { return e.description + ' | ' + e.ancien + ' | ' + e.nouveau; }),
             ordres: apres.etapes.map(function (e) { return e.ordre; }), nouvelles: fcEtapesPour('regularisation', '').map(function (e) { return e.code; }) };
  });
  assert.equal(r.res.ok, true, JSON.stringify(r.res));
  assert.equal(r.type, 'regularisation');
  assert.ok(r.apresCodes.indexOf(r.engCode) >= 0, 'l\'étape engagée reste');
  assert.equal(r.engStatut, 'en_cours');
  r.nouvelles.forEach(function (c) { assert.ok(r.apresCodes.indexOf(c) >= 0, 'étape de la nouvelle procédure : ' + c); });
  assert.deepEqual(r.ordres, r.ordres.map(function (_, i) { return i + 1; }), 'ordres renumérotés');
  assert.equal(r.hist.length, 1); assert.equal(r.hist[0].type, 'acd'); assert.match(r.hist[0].motif, /régularisation/);
  assert.equal(r.ev.length, 1); assert.match(r.ev[0], /Demande d'ACD → Régularisation/); assert.match(r.ev[0], /\| acd \| regularisation$/);
});

test('étape engagée hors nouvelle procédure : conservée et marquée « hors procédure » ; étape pas commencée retirée', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    const d = (await __ouvrir('acd')).dossier;
    const cibles = fcEtapesPour('immatriculation_rurale', '').map(function (e) { return e.code; });
    const horsCible = d.etapes.find(function (e) { return cibles.indexOf(e.code) === -1 && e.code !== 'creation_dossier' && e.code !== 'cloture'; });
    const libre = d.etapes.filter(function (e) { return cibles.indexOf(e.code) === -1 && e.code !== 'creation_dossier' && e.code !== 'cloture' && e !== horsCible; })[0];
    horsCible.statut = 'termine'; horsCible.date_fin = '2026-09-01';
    const aperçu = fcPlanChangementProcedure(d, 'immatriculation_rurale');
    const res = await fcChangerProcedure(d.id, 'immatriculation_rurale', 'Changement de voie suite à un contrôle', {});
    const apres = DATA.dossiers_fonciers[0];
    return { horsCode: horsCible.code, libreCode: libre && libre.code, aperçu: { hors: aperçu.horsProc.length, retirees: aperçu.retirees.length }, res: res,
             gardee: apres.etapes.find(function (e) { return e.code === horsCible.code; }), libreGardee: !!(libre && apres.etapes.find(function (e) { return e.code === libre.code; })),
             rangCrea: apres.etapes.findIndex(function (e) { return e.code === 'creation_dossier'; }), rangHors: apres.etapes.findIndex(function (e) { return e.code === horsCible.code; }) };
  });
  assert.equal(r.res.ok, true);
  assert.ok(r.aperçu.hors >= 1);
  assert.ok(r.gardee, 'étape terminée hors procédure conservée'); assert.equal(r.gardee.hors_procedure, true); assert.equal(r.gardee.statut, 'termine');
  if (r.libreCode) assert.equal(r.libreGardee, false, 'étape pas commencée retirée');
  assert.equal(r.rangHors, r.rangCrea + 1, 'placée juste après la création du dossier');
  assert.equal(r.res.hors_procedure >= 1, true);
});

test('refus : motif trop court, même procédure, procédure inconnue ou titre individuel, dossier clôturé, utilisateur sans droit', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    const d = (await __ouvrir('acd')).dossier, id = d.id;
    const sortie = {};
    sortie.court = (await fcChangerProcedure(id, 'regularisation', 'court', {})).erreur;
    sortie.meme = (await fcChangerProcedure(id, 'acd', 'Motif suffisamment long', {})).erreur;
    sortie.inconnue = (await fcChangerProcedure(id, 'nimporte', 'Motif suffisamment long', {})).erreur;
    sortie.individuel = (await fcChangerProcedure(id, 'titre_individuel', 'Motif suffisamment long', {})).erreur;
    APP.currentUser = { id: 'u2', nom: 'Autre' };
    sortie.droit = (await fcChangerProcedure(id, 'regularisation', 'Motif suffisamment long', {})).erreur;
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier' };
    d.statut = 'cloture';
    sortie.cloture = (await fcChangerProcedure(id, 'regularisation', 'Motif suffisamment long', {})).erreur;
    sortie.type = DATA.dossiers_fonciers[0].type_procedure; sortie.events = DATA.evenements_fonciers.filter(function (e) { return e.type === 'changement_procedure'; }).length;
    return sortie;
  });
  assert.match(r.court, /10 caractères/); assert.match(r.meme, /déjà cette procédure/); assert.match(r.inconnue, /inconnue/); assert.match(r.individuel, /inconnue ou non applicable/);
  assert.match(r.droit, /Seul le responsable/); assert.match(r.cloture, /plus modifiable/);
  assert.equal(r.type, 'acd'); assert.equal(r.events, 0);
});

test('doublon : un dossier déjà ouvert avec la nouvelle procédure sur la même parcelle bloque, sauf confirmation', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    const a = (await __ouvrir('acd')).dossier, b = (await __ouvrir('regularisation')).dossier;
    const refus = await fcChangerProcedure(a.id, 'regularisation', 'Motif suffisamment long', {});
    const force = await fcChangerProcedure(a.id, 'regularisation', 'Motif suffisamment long', { forcer: true });
    return { refus: refus, force: force.ok, ref: b.reference };
  });
  assert.equal(r.refus.ok, false); assert.match(r.refus.erreur, /déjà ouvert/); assert.ok(r.refus.doublon);
  assert.equal(r.force, true);
});

test('modèle de dossier : appliqué aux étapes nouvelles seulement, jamais aux étapes engagées', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    const d = (await __ouvrir('acd')).dossier;
    const cibles = fcEtapesPour('regularisation', '').map(function (e) { return e.code; });
    const eng = d.etapes.find(function (e) { return cibles.indexOf(e.code) !== -1 && e.code !== 'creation_dossier' && e.code !== 'cloture'; });
    eng.statut = 'en_cours'; eng.date_debut = '2026-10-01'; eng.date_cible = '2026-12-31'; eng.responsable_id = 'u2';
    const nouvelle = cibles.find(function (c) { return !d.etapes.some(function (e) { return e.code === c; }); });
    const mod = { actif: true, etapes: {} }; mod.etapes[eng.code] = { jours: 5, responsable_id: 'u1' }; if (nouvelle) mod.etapes[nouvelle] = { jours: 9, responsable_id: 'u2' };
    DATA.params.fc_modeles = { regularisation: mod };
    const res = await fcChangerProcedure(d.id, 'regularisation', 'Application du modèle de régularisation', {});
    const apres = DATA.dossiers_fonciers[0];
    const e2 = apres.etapes.find(function (e) { return e.code === eng.code; }), n2 = nouvelle && apres.etapes.find(function (e) { return e.code === nouvelle; });
    return { ok: res.ok, engCible: e2.date_cible, engResp: e2.responsable_id, nouvelleCible: n2 && n2.date_cible, nouvelleResp: n2 && n2.responsable_id, aNouvelle: !!nouvelle };
  });
  assert.equal(r.ok, true);
  assert.equal(r.engCible, '2026-12-31'); assert.equal(r.engResp, 'u2');
  if (r.aNouvelle) { assert.ok(r.nouvelleCible, 'délai du modèle appliqué à l\'étape nouvelle'); assert.equal(r.nouvelleResp, 'u2'); }
});

test('vers l\'immatriculation urbaine : propriétaire unique → étapes de parcellaire écartées ; ancien indicateur « à déterminer » levé', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    const d = (await __ouvrir('rural_a_examiner')).dossier; d.procedure_a_determiner = true;
    const res = await fcChangerProcedure(d.id, 'immatriculation_urbaine', 'Terrain finalement urbain sans titre', { plusieurs_proprietaires: false });
    const apres = DATA.dossiers_fonciers[0];
    return { ok: res.ok, type: apres.type_procedure, prop: apres.proprietaires, parcellaire: (apres.etapes.find(function (e) { return e.code === 'urb_parcellaire'; }) || {}).statut, aDeterminer: apres.procedure_a_determiner };
  });
  assert.equal(r.ok, true); assert.equal(r.type, 'immatriculation_urbaine'); assert.equal(r.prop, 'un'); assert.equal(r.parcellaire, 'annule'); assert.equal(r.aDeterminer, false);
});

test('interface : panneau, aperçu et bouton « Changer la procédure » (responsable, dossier ouvert)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    const d = (await __ouvrir('acd')).dossier;
    APP._fcChgProc = null; const ferme = fcPanneauChangerProcedure(d);
    APP._fcChgProc = d.id; const ouvert = fcPanneauChangerProcedure(d);
    const dom = document.createElement('div'); dom.innerHTML = ouvert; document.body.appendChild(dom);
    const opts = [].map.call(dom.querySelectorAll('#fc-cp-type option'), function (o) { return o.value; });
    dom.querySelector('#fc-cp-type').value = 'regularisation'; fcApercuChangementUI(d.id);
    const apercu = dom.querySelector('#fc-cp-apercu').textContent;
    return { ferme: ferme, aTitre: /Changer la procédure du dossier/.test(ouvert), opts: opts, apercu: apercu };
  });
  assert.equal(r.ferme, ''); assert.ok(r.aTitre);
  assert.ok(r.opts.indexOf('acd') === -1, 'la procédure actuelle n\'est pas proposée'); assert.ok(r.opts.indexOf('titre_individuel') === -1); assert.ok(r.opts.indexOf('regularisation') >= 0);
  assert.match(r.apercu, /étape\(s\) engagée\(s\) conservée\(s\)/);
});
