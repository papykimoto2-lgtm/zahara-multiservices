/* Foncier — immatriculation d'une parcelle rurale (AFOR / agriculture) : ouverture selon la situation du terrain,
   étapes dans l'ordre de la procédure fournie, ordre imposé, marque BLEUE (l'urbain reste rouge). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, extra) {
  return page.evaluate(async (extra) => {
    window.syncToSupabase = function () {}; window.toast = function () {}; window.dbPut = async function () { return true; }; window.userPeutSurStore = function () { return true; };
    DATA.params = DATA.params || {}; DATA.params.fc_urbain_facultatives = {}; DATA.params.fc_dependances = true;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', programme_id: 'g1', statut: 'prospection' }];
    DATA.users = [{ id: 'u1', nom: 'Resp', login: 'r', role: 'admin' }];
    ['dossiers_fonciers', 'evenements_fonciers', 'missions_foncieres', 'pieces_foncieres', 'audit_log', 'notifications_foncieres', 'clients'].forEach(function (s) { DATA[s] = []; });
    APP.currentUser = { id: 'u1', nom: 'Resp', role: 'admin' }; window.hasRole = function (r) { return r === 'admin'; };
    var r = await fcOuvrirDossier(Object.assign({ parcelle_id: 'p1', situation: 'rural', responsable_id: 'u1' }, extra || {}));
    return { ok: r.ok, erreur: r.erreur, id: r.ok ? r.dossier.id : null, av: r.avertissements };
  }, extra);
}

test('situation « parcelle rurale » : ouvre la procédure rurale, étapes dans l\'ordre du document', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page); assert.ok(a.ok, a.erreur);
  const r = await page.evaluate((id) => {
    var d = fcDossier(id), ph = {}; d.etapes.forEach(function (e) { ph[e.phase] = (ph[e.phase] || 0) + 1; });
    return { type: d.type_procedure, nb: d.etapes.length, ph: ph, premier: d.etapes[0].code, dernier: d.etapes[d.etapes.length - 1].code,
      codes: d.etapes.map(function (e) { return e.code; }), aDet: d.procedure_a_determiner, lib: FC_PROCEDURES[d.type_procedure], sit: FC_SITUATIONS.rural.procedure };
  }, a.id);
  assert.equal(r.type, 'immatriculation_rurale'); assert.equal(r.sit, 'immatriculation_rurale');
  assert.equal(r.premier, 'creation_dossier'); assert.equal(r.dernier, 'cloture');
  assert.equal(r.nb, 33); assert.equal(r.ph.R1, 5); assert.equal(r.ph.R2, 5); assert.equal(r.ph.R3, 13); assert.equal(r.ph.R4, 8);
  assert.equal(r.aDet, false);
  assert.ok(/rurale/i.test(r.lib));
  const i = (c) => r.codes.indexOf(c);
  assert.ok(i('rur_leve_topo') < i('rur_pv_famille') && i('rur_convention_notaire') < i('rur_achat_liasses') && i('rur_depot_liasses') < i('rur_commissaire_enqueteur'));
  assert.ok(i('rur_certificat_foncier') < i('rur_dossier_afor') && i('rur_creation_tf') < i('rur_validation_ministere') && i('rur_validation_ministere') < i('rur_retrait_titre'));
});

test('ordre imposé : le dépôt à l\'agriculture ne démarre pas avant la convention notariée ; la clôture exige le retrait du titre', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page); assert.ok(a.ok, a.erreur);
  const r = await page.evaluate(async (id) => {
    var d = fcDossier(id);
    var x = await fcChangerStatutEtape(id, 'rur_depot_liasses', 'en_cours', {});
    var y = await fcChangerStatutEtape(id, 'cloture', 'termine', {});
    return { x: x, dep: fcPrerequisManquants(d, 'rur_depot_liasses').map(function (e) { return e.code; }), cl: fcPrerequisManquants(d, 'cloture').map(function (e) { return e.code; }), y: y };
  }, a.id);
  assert.equal(r.x.ok, false); assert.ok(r.x.dependance, r.x.erreur);
  assert.deepEqual(r.dep, ['rur_achat_liasses']);
  assert.deepEqual(r.cl, ['rur_retrait_titre']); assert.equal(r.y.ok, false);
});

test('déroulé : la première étape se termine, la suivante devient possible', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page); assert.ok(a.ok, a.erreur);
  const r = await page.evaluate(async (id) => {
    var o = [];
    for (const c of ['creation_dossier', 'rur_recherche', 'rur_reperage']) { var x = await fcChangerStatutEtape(id, c, 'en_cours', {}); var y = await fcChangerStatutEtape(id, c, 'termine', {}); o.push([c, x.ok, y.ok, y.erreur || '']); }
    return o;
  }, a.id);
  r.forEach(function (l) { assert.ok(l[1], l.join(' | ')); });
});

test('affichage : étapes et phases rurales en BLEU, aucune en rouge ; l\'urbain reste rouge', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const a = await preparer(page); assert.ok(a.ok, a.erreur);
  const r = await page.evaluate(async (id) => {
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>');
    fcRenderDetail(id);
    var d = fcDossier(id), rur = d.etapes.filter(function (e) { return /^rur_/.test(e.code); }).length;
    var bleus = document.querySelectorAll('#fc-detail span[style*="#1f5fbf"]').length;
    var rouges = document.querySelectorAll('#fc-detail span[style*="#c0392b"][title*="procédure"]').length;
    var phases = [].filter.call(document.querySelectorAll('#fc-detail tr[data-fcphh]'), function (t) { return /^R/.test(t.getAttribute('data-fcphh')) && t.querySelector('span[style*="#1f5fbf"]'); }).length;
    var lignes = document.querySelectorAll('#fc-detail tr.fc-proc-rural').length;
    var urb = fcMarqueEtape({ code: 'urb_acquisition' }, 'x'), gen = fcMarqueEtape({ code: 'creation_dossier' }, 'x');
    return { rur: rur, bleus: bleus, rouges: rouges, phases: phases, lignes: lignes, urbRouge: /#c0392b/.test(urb), genNeutre: gen === 'x' };
  }, a.id);
  assert.equal(r.rur, 31);
  assert.ok(r.bleus >= r.rur, 'chaque étape rurale est en bleu');
  assert.equal(r.rouges, 0); assert.equal(r.phases, 4); assert.equal(r.lignes, 31);
  assert.ok(r.urbRouge); assert.ok(r.genNeutre);
});

test('modèle par défaut, assistant d\'ouverture et catalogue d\'étapes couvrent la procédure rurale', async () => {
  const app = await ouvrirApp(); const page = app.page;
  await preparer(page);
  const r = await page.evaluate(() => {
    var m = fcModeleParDefaut('immatriculation_rurale'), p = fcAssistantPropose({ situation: 'rural' });
    var lib = fcDefEtape('rur_retrait_titre'), ancien = fcEtapesPour('rural_a_examiner', '').length;
    return { jours: Object.keys(m.etapes).length, type: p.type, nb: p.nb, urbain: p.urbain, lib: lib && lib[1], phase: fcLibPhase('R3'), ancien: ancien };
  });
  assert.ok(r.jours >= 31); assert.equal(r.type, 'immatriculation_rurale'); assert.equal(r.nb, 33); assert.equal(r.urbain, false);
  assert.equal(r.lib, 'Retrait du titre foncier'); assert.ok(/^Rural/.test(r.phase)); assert.ok(r.ancien > 0);
});
