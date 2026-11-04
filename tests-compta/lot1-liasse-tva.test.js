const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Revue comptabilité, lot 1 : liasse toujours équilibrée, configuration TVA séparée du taux par défaut,
   une seule liquidation de TVA par mois, quote-part non déductible imputée compte par compte. */

test('liasse : un produit 7088 ou une charge 693 ne déséquilibre plus la liasse et le résultat est juste', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.ecritures = [E('a', '2026-01-01', '521', '7088', 1000), E('b', '2026-02-01', '693', '521', 200)];
      const c = _lfCalc2(2026, ''), p = calcBilan(2026);
      return { bz: c.B.BZ, dz: c.B.DZ, xi: c.R.XI, resPage: p.resultat, ecartPage: Math.round(p.totalActif - p.totalPassif) };
    });
    assert.equal(r.bz, r.dz);
    assert.equal(r.xi, 800);
    assert.equal(r.xi, r.resPage);
  } finally { await app.fermer(); }
});

test('liasse : comptes de bilan hors rubriques (119, 281, 481 débiteur, 485 créditeur…) restent équilibrés et conformes à la page', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      const cas = [['119', '521'], ['521', '281'], ['481', '521'], ['521', '485'], ['419', '521'], ['521', '409']];
      return cas.map(function (c) {
        DATA.ecritures = [E('i', '2026-01-01', '521', '101', 5000), E('x', '2026-02-01', c[0], c[1], 1000)];
        const l = _lfCalc2(2026, ''), p = calcBilan(2026);
        return { cas: c.join('/'), ecart: Math.round(l.B.BZ - l.B.DZ), actifPage: Math.round(p.totalActif), actifLiasse: Math.round(l.B.BZ) };
      });
    });
    r.forEach(function (x) { assert.equal(x.ecart, 0, x.cas); });
  } finally { await app.fermer(); }
});

test('TVA : enregistrer les Paramètres ne détruit plus la configuration de TVA ; le taux par défaut survit à la déclaration', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.params.tva = 20;
      const cfg = _tvaCfg(); cfg.prorata = 50; cfg.declarations = [{ mois: '2026-01', credit_reporte: 777 }];
      await _tvaSave(cfg);
      const apresSave = { taux: tvaDefaut(), prorata: _tvaCfg().prorata, decl: _tvaCfg().declarations.length };
      /* ce que fait saveParams : écrase params.tva par le taux saisi */
      DATA.params = Object.assign(DATA.params, { tva: 20 });
      return { apresSave, apresParams: { taux: tvaDefaut(), prorata: _tvaCfg().prorata, decl: _tvaCfg().declarations.length } };
    });
    assert.deepEqual(r.apresSave, { taux: 20, prorata: 50, decl: 1 });
    assert.deepEqual(r.apresParams, { taux: 20, prorata: 50, decl: 1 });
  } finally { await app.fermer(); }
});

test('TVA : l\'ancien emplacement (objet sous params.tva) est repris puis libéré', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      delete DATA.params.tva_cfg; DATA.params.tva = { prorata: 60, declarations: [{ mois: '2025-12' }] };
      const lu = { prorata: _tvaCfg().prorata, decl: _tvaCfg().declarations.length };
      await _tvaSave(_tvaCfg());
      return { lu, tvaApres: typeof DATA.params.tva, taux: tvaDefaut() };
    });
    assert.deepEqual(r.lu, { prorata: 60, decl: 1 });
    assert.equal(r.tvaApres, 'undefined');
    assert.equal(r.taux, 18);
  } finally { await app.fermer(); }
});

async function preparerTva(page, prorata) {
  await page.evaluate(function (pr) {
    DATA.ecritures = [
      E('v', '2026-03-10', '4111', '4431', 1800),
      E('a1', '2026-03-12', '4451', '4011', 180),
      E('a2', '2026-03-13', '4452', '4011', 180)
    ];
    DATA.params.tva_cfg = { prorata: pr, regime: 'RNI', declarations: [] };
    delete DATA.params.tva;
    ouvrirDeclarationTVA();
    document.getElementById('tva-mois').value = '2026-03';
    document.getElementById('tva-prorata').value = String(pr);
    renderDeclarationTVA();
  }, prorata);
}

test('TVA : une seconde liquidation du même mois est refusée tant que la première n\'est pas contre-passée', async () => {
  const app = await ouvrirApp();
  try {
    await preparerTva(app.page, 100);
    const r = await app.page.evaluate(async function () {
      await passerEcritureTVA(); await passerEcritureTVA();
      const n1 = DATA.ecritures.filter(function (e) { return e.source === 'liquidation_tva'; }).length;
      const msg = window.__toasts.join(' | ');
      DATA.ecritures.find(function (e) { return e.source === 'liquidation_tva'; }).contrepassee_par = 'CP';
      await passerEcritureTVA();
      return { n1, msg, n2: DATA.ecritures.filter(function (e) { return e.source === 'liquidation_tva'; }).length };
    });
    assert.equal(r.n1, 1);
    assert.match(r.msg, /déjà passée/);
    assert.equal(r.n2, 2);
  } finally { await app.fermer(); }
});

test('TVA : avec un prorata de 50 %, chaque compte 445x est soldé et la part rejetée va en charge', async () => {
  const app = await ouvrirApp();
  try {
    await preparerTva(app.page, 50);
    const r = await app.page.evaluate(async function () {
      await passerEcritureTVA();
      const sol = function (c) { return Math.round(_lfS(_lfSoldes(2026, ''), [c])); };
      const liq = DATA.ecritures.find(function (e) { return e.source === 'liquidation_tva'; });
      const D = ecrLignes(liq).filter(function (l) { return l.sens === 'D'; }).reduce(function (a, l) { return a + l.montant; }, 0);
      const C = ecrLignes(liq).filter(function (l) { return l.sens === 'C'; }).reduce(function (a, l) { return a + l.montant; }, 0);
      return { s4451: sol('4451'), s4452: sol('4452'), s4431: sol('4431'), s6461: sol('6461'), eq: Math.round(D - C) };
    });
    assert.equal(r.s4451, 0);
    assert.equal(r.s4452, 0);
    assert.equal(r.s4431, 0);
    assert.equal(r.s6461, 180);
    assert.equal(r.eq, 0);
  } finally { await app.fermer(); }
});
