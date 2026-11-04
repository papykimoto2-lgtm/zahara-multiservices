const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Plan comptable : comptes écrits par l'application ou mouvementés mais absents du plan — détection et création. */

test('détection : comptes système absents du plan (890, 6461, 4441, 4449, 2812, 476, 477…) et comptes mouvementés hors plan', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      APP.planComptable = APP.planComptable.filter(function (c) { return ['890', '6461', '4441', '4449', '2812', '476', '477', '28'].indexOf(c.code) === -1; });
      _BASE_PLAN_COMPTABLE = APP.planComptable.slice();
      DATA.ecritures = [E('h1', '2026-02-01', '521', '70999', 100), E('h2', '2026-02-02', '521', '2812', 50)];
      rebuildPlanComptable();
      const m = comptesManquantsPlan(), par = {}; m.forEach(function (c) { par[c.code] = c; });
      return { codes: m.map(function (c) { return c.code; }), lib890: par['890'] && par['890'].label, motif2812: par['2812'] && par['2812'].motif, motifSys: par['4441'] && par['4441'].motif,
        horsPlan: par['70999'] && par['70999'].motif, libHors: par['70999'] && par['70999'].label };
    });
    ['890', '6461', '4441', '4449', '2812', '476', '477', '70999'].forEach(function (c) { assert.ok(r.codes.indexOf(c) !== -1, 'manque ' + c); });
    assert.match(r.lib890, /liaison d'ouverture/);
    assert.equal(r.motif2812, 'mouvementé hors plan');
    assert.equal(r.motifSys, 'utilisé par l\'application');
    assert.equal(r.horsPlan, 'mouvementé hors plan');
    assert.match(r.libHors, /détail 70999|à renommer/);
  } finally { await app.fermer(); }
});

test('création : les comptes sont inscrits au plan (plus hors plan), tracés, sans doublon à la seconde exécution', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      APP.planComptable = APP.planComptable.filter(function (c) { return ['890', '6461', '4441', '4449'].indexOf(c.code) === -1; });
      _BASE_PLAN_COMPTABLE = APP.planComptable.slice();
      DATA.params.plan_comptable_custom = [];
      DATA.ecritures = [E('h1', '2026-01-01', '521', '890', 100)];
      rebuildPlanComptable();
      window.__audit = []; window.logAction = function (t, d) { window.__audit.push(t + ' | ' + d); };
      const avant = comptesManquantsPlan().length;
      await creerComptesManquants();
      const apres = comptesManquantsPlan().length;
      const c890 = APP.planComptable.find(function (c) { return c.code === '890'; });
      const nCustom = DATA.params.plan_comptable_custom.length;
      window.__toasts = [];
      await creerComptesManquants();
      return { avant, apres, horsPlan: c890 && !!c890._horsPlan, label: c890 && c890.label, nCustom, nCustom2: DATA.params.plan_comptable_custom.length, audit: window.__audit, msg: window.__toasts.join(' | '), hp: APP._comptesHorsPlan.length };
    });
    assert.ok(r.avant >= 4);
    assert.equal(r.apres, 0);
    assert.equal(r.horsPlan, false);
    assert.match(r.label, /liaison d'ouverture/);
    assert.equal(r.nCustom2, r.nCustom);
    assert.equal(r.hp, 0);
    assert.match(r.audit[0], /^PLAN_COMPTABLE_COMPTES_CREES \| \d+ compte\(s\)/);
    assert.match(r.msg, /Aucun compte manquant/);
  } finally { await app.fermer(); }
});

test('création : droit Comptabilité requis ; annulation de la confirmation = rien n\'est créé', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      APP.planComptable = APP.planComptable.filter(function (c) { return c.code !== '890'; });
      _BASE_PLAN_COMPTABLE = APP.planComptable.slice();
      DATA.params.plan_comptable_custom = []; DATA.ecritures = [];
      rebuildPlanComptable();
      const droit = window.exigerDroit; window.exigerDroit = function () { return false; };
      await creerComptesManquants();
      const n1 = DATA.params.plan_comptable_custom.length;
      window.exigerDroit = droit;
      const conf = window.confirm; window.confirm = function () { return false; };
      await creerComptesManquants();
      window.confirm = conf;
      return { n1, n2: DATA.params.plan_comptable_custom.length };
    });
    assert.deepEqual(r, { n1: 0, n2: 0 });
  } finally { await app.fermer(); }
});

test('écran du plan comptable : bouton « Créer les comptes manquants » présent tant qu\'il manque des comptes, absent ensuite', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      APP.planComptable = APP.planComptable.filter(function (c) { return c.code !== '890'; });
      _BASE_PLAN_COMPTABLE = APP.planComptable.slice();
      DATA.params.plan_comptable_custom = []; DATA.ecritures = [];
      rebuildPlanComptable();
      renderDashboardPlanComptable();
      const avant = /Créer les comptes manquants/.test(document.getElementById('pc-alerte-horsplan').innerHTML);
      await creerComptesManquants();
      renderDashboardPlanComptable();
      return { avant, apres: /Créer les comptes manquants/.test(document.getElementById('pc-alerte-horsplan').innerHTML) };
    });
    assert.deepEqual(r, { avant: true, apres: false });
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
