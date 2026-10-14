/* Foncier Connect — modifier et imprimer un dossier. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.programmes = [{ id: 'g1', nom: 'Résidence Les Palmiers' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville', programme_id: 'g1' }];
    DATA.lots = [{ id: 'l1', numero: 'L1', parcelle_id: 'p1' }];
    DATA.clients = [{ id: 'c1', nom: 'Aminata Koné', lot_id: 'l1', email: 'a@exemple.ci' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf', email: 'rf@exemple.ci' }, { id: 'u2', nom: 'Autre agent', login: 'ag', email: 'ag@exemple.ci' }, { id: 'u3', nom: 'Ancien', login: 'an', statut: 'inactif' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(function (s) { DATA[s] = []; });
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', priorite: 'normale' })).dossier;
    return { d: d.id };
  });
}
const run = (page, fn, arg) => page.evaluate(fn, arg === undefined ? null : arg);

test('modifier : champs autorisés, journalisés ; inchangé = aucun événement', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const r = await run(app.page, (d) => fcModifierDossier(d, { priorite: 'haute', date_cible: '2026-12-31', observations: 'Priorité direction' }), d);
  assert.equal(r.ok, true); assert.equal(r.modifications.length, 3);
  const x = await run(app.page, (d) => { var o = fcDossier(d); return [o.priorite, o.date_cible, o.observations]; }, d);
  assert.deepEqual(x, ['haute', '2026-12-31', 'Priorité direction']);
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.filter(function (e) { return e.type === 'modification' && /priorité : Normale → Haute/.test(e.description); }).length), 1);
  const avant = await run(app.page, () => DATA.evenements_fonciers.length);
  const idem = await run(app.page, (d) => fcModifierDossier(d, { priorite: 'haute' }), d);
  assert.equal(idem.ok, true); assert.equal(idem.inchange, true);
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.length), avant);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('modifier : validations (priorité, date, responsable inactif ou inconnu, longueur)', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const essai = (c) => app.page.evaluate(function (a) { return fcModifierDossier(a.d, a.c); }, { d: d, c: c });
  assert.match((await essai({ priorite: 'urgentissime' })).erreur, /Priorité inconnue/);
  assert.match((await essai({ date_cible: '31/12/2026' })).erreur, /invalide/);
  assert.match((await essai({ responsable_id: 'u3' })).erreur, /inactif/);
  assert.match((await essai({ responsable_id: 'zz' })).erreur, /inconnu/);
  assert.match((await essai({ observations: 'x'.repeat(2001) })).erreur, /trop longues/);
  assert.equal(await run(app.page, (d) => fcDossier(d).priorite, d), 'normale');
});

test('modifier : réservé au responsable ou à l\'administrateur ; dossier clôturé non modifiable', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, () => { APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' }; });
  assert.match((await run(app.page, (d) => fcModifierDossier(d, { priorite: 'haute' }), d)).erreur, /responsable du dossier/);
  await run(app.page, () => { APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' }; fcDossier(DATA.dossiers_fonciers[0].id).statut = 'cloture'; });
  assert.match((await run(app.page, (d) => fcModifierDossier(d, { priorite: 'haute' }), d)).erreur, /plus modifiable/);
});

test('changement de responsable : répercuté sur ses étapes, journalisé, nouveau responsable notifié', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, (d) => { fcDossier(d).etapes[2].responsable_id = 'u2'; }, d);
  const r = await run(app.page, (d) => fcModifierDossier(d, { responsable_id: 'u2' }), d);
  assert.equal(r.ok, true);
  const x = await run(app.page, (d) => { var o = fcDossier(d); return { resp: o.responsable_id, etapes: o.etapes.filter(function (e) { return e.responsable_id === 'u2'; }).length, total: o.etapes.length }; }, d);
  assert.equal(x.resp, 'u2'); assert.equal(x.etapes, x.total, 'étapes de l\'ancien responsable et étape déjà confiée à u2');
  assert.equal(await run(app.page, () => DATA.evenements_fonciers.some(function (e) { return e.type === 'changement_responsable' && e.nouveau === 'u2'; })), true);
  assert.equal(await run(app.page, () => DATA.notifications_foncieres.some(function (n) { return n.titre === 'Dossier qui vous est confié' && n.destinataire_id === 'u2'; })), true);
});

test('un changement de responsable ne touche pas les étapes déjà terminées ni celles confiées à un tiers', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, async (d) => { var o = fcDossier(d); o.etapes[0].statut = 'termine'; o.etapes[3].responsable_id = 'u3'; }, d);
  await run(app.page, (d) => fcModifierDossier(d, { responsable_id: 'u2' }), d);
  const x = await run(app.page, (d) => { var o = fcDossier(d); return [o.etapes[0].responsable_id, o.etapes[3].responsable_id, o.etapes[4].responsable_id]; }, d);
  assert.deepEqual(x, ['u1', 'u3', 'u2']);
});

test('impression : fiche complète, sans le contenu des fichiers, pièces restreintes masquées', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, async (d) => {
    var pdf = { nom: 'plan.pdf', type: 'application/pdf', taille: 900, contenu: 'data:application/pdf;base64,' + btoa('%PDF-1.4 secret-contenu') };
    await fcAjouterPiece(d, 'depot', pdf, { categorie: 'plan_cadastral' });
    await fcAjouterPiece(d, 'depot', Object.assign({}, pdf, { nom: 'cni-confidentielle.pdf' }), { categorie: 'identite', confidentialite: 'restreinte' });
    await fcModifierDossier(d, { observations: 'Note interne X' });
    await fcDefinirReferences(d, { idufci: 'CI-ABJ-000123', numero_dossier_guf: 'GUF-1', source: 'administration_declaree' });
  }, d);
  const h = await run(app.page, (d) => fcHtmlFicheDossier(fcDossier(d)), d);
  assert.match(h, /Dossier foncier DF-/); assert.match(h, /Note interne X/); assert.match(h, /CI-ABJ-000123/); assert.match(h, /plan\.pdf/); assert.match(h, /Historique/); assert.match(h, /Contrôles essentiels/);
  assert.ok(!h.includes('secret-contenu') && !h.includes('base64'), 'jamais le contenu des fichiers');
  assert.match(h, /cni-confidentielle\.pdf/, 'visible par le responsable');
  await run(app.page, () => { APP.currentUser = { id: 'u2', nom: 'Autre agent', role: 'foncier' }; });
  const h2 = await run(app.page, (d) => fcHtmlFicheDossier(fcDossier(d)), d);
  assert.ok(!h2.includes('cni-confidentielle.pdf'), 'masquée pour un tiers'); assert.match(h2, /plan\.pdf/);
});

test('impression : titre individuel, liste, journal, droit d\'export', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  await run(app.page, () => { DATA.parcelles[0].statut = 'tf_definitif'; });
  const ind = (await run(app.page, () => fcOuvrirDossierIndividuel({ lot_id: 'l1' }))).dossier.id;
  const h = await run(app.page, (i) => fcHtmlFicheDossier(fcDossier(i)), ind);
  assert.match(h, /Titre individuel — lot\(s\) L1/); assert.match(h, /Aminata Koné/); assert.match(h, /Titre mère/);
  const l = await run(app.page, () => fcHtmlListeDossiers(DATA.dossiers_fonciers));
  assert.match(l, /Titre individuel/); assert.match(l, /Global/);
  const n = await run(app.page, (d) => { window.getAllRoles = function () { return { foncier: { permissions: { Foncier: true } } }; }; STORE_MODULE.dossiers_fonciers = 'Foncier'; window.__pp = []; window.openPrintPreview = function (html, titre) { window.__pp.push(titre); }; return fcImprimerDossierUI(d).then(function () { return [window.__pp.slice(), DATA.evenements_fonciers.filter(function (e) { return e.type === 'impression'; }).length]; }); }, d);
  assert.deepEqual(n, [['Dossier ' + (await run(app.page, (d) => fcDossier(d).reference, d))], 1]);
  const refus = await run(app.page, (d) => { window.getAllRoles = function () { return { foncier: { permissions: { Foncier: false } } }; }; STORE_MODULE.dossiers_fonciers = 'Foncier'; window.__pp = []; return fcImprimerDossierUI(d).then(function () { return window.__pp.length; }); }, d);
  assert.equal(refus, 0);
});

test('interface : boutons Modifier et Imprimer dans la liste et le détail ; formulaire de modification', async () => {
  const app = await ouvrirApp(); const { d } = await preparer(app.page);
  const h = await run(app.page, (d) => { document.body.insertAdjacentHTML('beforeend', '<div id="fc-root"></div>'); fcRender(); var liste = document.getElementById('fc-root').innerHTML; APP._fcEdit = d; fcRenderDetail(d); return { liste: liste, detail: document.getElementById('fc-detail').innerHTML }; }, d);
  assert.match(h.liste, /✏️ Modifier/); assert.match(h.liste, /🖨 Imprimer/); assert.match(h.liste, /Imprimer la liste/);
  assert.match(h.detail, /Modifier le dossier DF-/); assert.match(h.detail, /Imprimer le dossier/); assert.match(h.detail, /fc-m-resp/);
  await run(app.page, (d) => { document.getElementById('fc-m-prio').value = 'haute'; return fcEnregistrerModifUI(d); }, d);
  assert.equal(await run(app.page, (d) => fcDossier(d).priorite, d), 'haute');
  assert.equal(await run(app.page, () => APP._fcEdit), null);
  assert.deepEqual(app.etat.erreursPage, []);
});
