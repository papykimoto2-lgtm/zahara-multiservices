/* Assistant d'étapes : suggestions selon la procédure et le contexte, ajout (suggestion ou catalogue), journal, placement, équipe. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const USERS = [{ id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' }, { id: 's1', nom: 'Foncier 1', login: 's1', role: 'service_foncier' }, { id: 'j1', nom: 'Juriste', login: 'j1', role: 'juridique' }];
async function preparer(page) {
  await page.evaluate(async (users) => {
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = users; window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
  }, USERS);
}

test('règle B : dossier standard en situation coutumière → phase coutumière proposée ; ajout inséré après l\'identification, journalisé, confié à la fonction', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', situation: 'terrain_coutumier', responsable_id: 'dir' })).dossier;
    const avant = d.etapes.length, s = fcSuggestionsEtapes(d), coutumier = s.find(x => x.id === 'coutumier');
    const res = await fcAjouterEtapes(d.id, coutumier.codes, { apres: coutumier.apres, raison: coutumier.titre });
    const f = fcDossier(d.id), codes = f.etapes.map(e => e.code), i = codes.indexOf('identification_procedure');
    return { sug: s.map(x => x.id), n: coutumier.codes.length, res: res.ok && res.ajoutees, apres: f.etapes.length - avant, suite: codes.slice(i + 1, i + 3), ordres: f.etapes.every((e, k) => e.ordre === k + 1),
             juriste: f.etapes.filter(e => e.code === 'urb_contrat_exclusivite')[0].responsable_id, evt: DATA.evenements_fonciers.filter(e => e.type === 'etapes_ajoutees').length, resteSug: fcSuggestionsEtapes(f).map(x => x.id) };
  });
  assert.ok(r.sug.indexOf('coutumier') !== -1); assert.equal(r.res, r.n); assert.equal(r.apres, r.n); assert.deepEqual(r.suite, ['urb_acquisition', 'urb_civilite_delimitation']);
  assert.equal(r.ordres, true); assert.equal(r.juriste, 'j1', 'étape juridique confiée à la personne de la fonction juridique'); assert.equal(r.evt, 1); assert.deepEqual(r.resteSug, []);
});

test('règle A : étape de la procédure manquante proposée, réinsérée à sa place ; dossier sans écart : aucune suggestion', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir' })).dossier;
    const aucune = fcSuggestionsEtapes(d).length;
    const k = d.etapes.findIndex(e => e.code === 'recepisse'), avant = d.etapes[k - 1].code, apres = d.etapes[k + 1].code; d.etapes.splice(k, 1); d.etapes.forEach((e, i) => { e.ordre = i + 1; });
    const s = fcSuggestionsEtapes(d); const res = await fcAjouterEtapes(d.id, s[0].codes);
    const codes = fcDossier(d.id).etapes.map(e => e.code), j = codes.indexOf('recepisse');
    return { aucune, sug: s.map(x => x.id), codes: s[0].codes, ok: res.ok, voisins: [codes[j - 1], codes[j + 1]], attendu: [avant, apres] };
  });
  assert.equal(r.aucune, 0); assert.deepEqual(r.sug, ['ref']); assert.deepEqual(r.codes, ['recepisse']); assert.equal(r.ok, true); assert.deepEqual(r.voisins, r.attendu);
});

test('ajout manuel du catalogue, doublons et étapes inconnues refusés, dossier clôturé et droit requis', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir' })).dossier;
    const ok = await fcAjouterEtapes(d.id, ['urb_commodo'], { raison: 'ajout manuel' });
    const doublon = await fcAjouterEtapes(d.id, ['urb_commodo']); const inconnue = await fcAjouterEtapes(d.id, ['xxx']);
    APP.currentUser = { id: 'x', nom: 'Agent', role: 'foncier' }; const refus = await fcAjouterEtapes(d.id, ['urb_dm']); APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    d.statut = 'cloture'; const clos = await fcAjouterEtapes(d.id, ['urb_dm']);
    return { ok: ok.ok, doublon: doublon.ok, inconnue: inconnue.ok, refus: refus.ok, clos: clos.ok, msg: clos.erreur };
  });
  assert.equal(r.ok, true); assert.equal(r.doublon, false); assert.equal(r.inconnue, false); assert.equal(r.refus, false); assert.equal(r.clos, false); assert.match(r.msg, /cl/);
});

test('interface : carte de suggestions avec bouton, liste du catalogue, ajout rafraîchit le dossier', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', situation: 'attestation_villageoise', responsable_id: 'dir' })).dossier;
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>'); fcRenderDetail(d.id);
    const h = document.getElementById('fc-detail').innerHTML; const o = { carte: /Étapes suggérées pour ce dossier/.test(h), btn: /Ajouter ces \d+ étape/.test(h), select: !!document.getElementById('fc-add-etape'), avant: d.etapes.length };
    await fcAjouterSuggestionUI(d.id, APP._fcSug[d.id].findIndex(x => x.id === 'coutumier')); o.apres = fcDossier(d.id).etapes.length; o.lignes = document.querySelectorAll('#fc-detail tr[data-fcph]').length;
    return o;
  });
  assert.equal(r.carte, true); assert.equal(r.btn, true); assert.equal(r.select, true); assert.ok(r.apres > r.avant); assert.equal(r.lignes, r.apres);
  assert.deepEqual(app.etat.erreursPage, []);
});
