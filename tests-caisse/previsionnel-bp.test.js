/* Prévisionnel / Business plan : moteur (calendrier des coûts, TVA neutre, créances de fin, IS avec report et IMF,
   DSCR minimum, plan de financement rapproché de la trésorerie, plafond de lots, sensibilité) et écran
   (copie de travail, versions figées, reprise du Budget, pré-remplissage, PDF identique à l'écran). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('moteur : flux réalistes, rapprochement plan/trésorerie, fiscalité, ratios', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(() => {
      const o = {}, s = _prevDefaut(), c = _prevCompute(s), R = c.ratios;
      o.ecart = c.plan.map((p, k) => Math.abs(p.cumul - c.treso[(k + 1) * 12 - 1].cumul) < 1);
      o.flux = [c.ecoCF[0] < 0, R.tri !== null && R.tri > 0, c.creancesFin > 0, c.treso[0].production > 0 && c.treso[0].enc < c.treso[0].production];
      o.dscr = [R.dscrMin === Math.min(...R.dscrAns.filter(x => x !== null)), R.dscrAns[0] > R.dscrMin];
      o.va = c.years.every(a => Math.abs(a.va - (a.CA - a.prodCost - a.imprevus - a.etudes - a.comm - a.marketing - a.chFixes)) < 1 && Math.abs(a.ebe - (a.va - a.taxesLoc - a.masse)) < 1);
      const sT = _prevDefaut(); sT.hyp.tva = 0; const cT = _prevCompute(sT);
      o.tva = [Math.abs(cT.ratios.van - R.van) < 1, Math.abs(cT.totals.rNet - c.totals.rNet) < 1, c.treso.reduce((x, t) => x + t.tva, 0) > 0];
      const sP = _prevDefaut(); sP.hyp.lots_par_an = 8; sP.hyp.croissance = 150; const cP = _prevCompute(sP);
      o.fiscal = [cP.years[0].rAvantIS < 0, cP.years[0].imf, cP.years[0].is === 3000000, Math.round(cP.years[1].deficitImpute) === Math.round(-cP.years[0].rAvantIS)];
      const sL = _prevDefaut(); sL.hyp.lots_max = 50; const cL = _prevCompute(sL);
      o.plafond = [Math.round(cL.lotsVendus), cL.plafondAtteint];
      const sI = _prevDefaut(); sI.hyp.inflation = 10; o.inflation = _prevCompute(sI).years[2].chFixes > c.years[2].chFixes;
      const sV = _prevDefaut(); sV.fin.invest = 50000000; sV.fin.amort_ans = 5; const cV = _prevCompute(sV);
      o.invest = [cV.years[0].dotations === 10000000, cV.plan[0].invest === 50000000, cV.treso[0].invest === 50000000];
      o.seuil = R.seuilRentab > 0;
      const sA = _prevDefaut(); sA.fin.invest = 50000000; sA.fin.amort_ans = 2; sA.horizon_annees = 5; const cA = _prevCompute(sA);
      o.amort = cA.years.map(a => a.dotations);
      const s0 = _prevDefaut(); s0.fin.actualisation = 0; o.actu = _prevCompute(s0).ratios.tauxActu;
      o.stock = [c.stockFin > 0, c.treso.slice(-6).every(t => t.production > 0)];
      o.verdict = [R.tresoMin < 0, _prevVerdict(c).bancable, _prevVerdict(c).nbOk >= 4];
      o.sens = _prevSensibilite(s).map(x => Math.round(x.van / 1e6));
      const ancien = { nom: 'Ancien', date_debut: '2026-01-01', horizon_annees: 3, hyp: { prix_lot: 1000000, lots_par_an: 10 }, fin: {} };
      o.ancien = [_prevNormaliser(ancien).hyp.foncier_avance_mois, _prevNormaliser(ancien).hyp.imf_min, _prevNormaliser(ancien).fin.amort_ans];
      return o;
    });
    assert.deepEqual(r.ecart, [true, true, true]);
    assert.deepEqual(r.flux, [true, true, true, true]);
    assert.deepEqual(r.dscr, [true, true]);
    assert.equal(r.va, true);
    assert.deepEqual(r.tva, [true, true, true]);
    assert.deepEqual(r.fiscal, [true, true, true, true]);
    assert.deepEqual(r.plafond, [50, true]);
    assert.equal(r.inflation, true);
    assert.deepEqual(r.invest, [true, true, true]);
    assert.equal(r.seuil, true);
    assert.deepEqual(r.amort, [25000000, 25000000, 0, 0, 0]);
    assert.equal(r.actu, 0.12);
    assert.deepEqual(r.stock, [true, true]);
    assert.deepEqual(r.verdict, [true, false, true]);
    assert.ok(r.sens[0] < r.sens[1] && r.sens[1] < r.sens[2]);
    assert.deepEqual(r.ancien, [6, 3000000, 5]);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});

test('écran : copie de travail, versions figées, Budget, pré-remplissage, PDF = écran', async () => {
  const app = await ouvrirApp();
  try {
    app.etat.prompts.push('Dossier banque test');
    const r = await app.page.evaluate(async () => {
      const o = {}, pdf = [];
      window.genererEtatPDF = function (x) { pdf.push(x); };
      DATA.previsionnels = []; APP._prevCurrent = null; DATA.programmes = [{ id: 'p1', nom: 'Cité A' }];
      loadPrevisionnel();
      const val = id => document.getElementById(id).value, saisir = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); };
      o.defaut = [val('prev-foncier-avance'), val('prev-imf-pct'), document.getElementById('prev-dirty').style.display];
      saisir('prev-nom', 'Scénario A'); await prevSaveScenario();
      const id = DATA.previsionnels[0].id;
      o.apresSave = document.getElementById('prev-dirty').style.display;
      saisir('prev-prix-lot', '99'); o.dirty = document.getElementById('prev-dirty').style.display;
      o.nonMute = DATA.previsionnels[0].hyp.prix_lot;
      document.getElementById('prev-select').value = id; prevSelectScenario();
      o.relu = val('prev-prix-lot');
      await prevFigerVersion();
      o.version = [DATA.previsionnels[0].versions.length, DATA.previsionnels[0].versions[0].libelle, !!document.querySelector('[data-prev-version]')];
      saisir('prev-commentaire', 'Garantie <b>hypothèque</b>\nRéférences'); o.dirtyCom = document.getElementById('prev-dirty').style.display;
      etatDossierBancaire();
      o.graph = [(pdf[0].contenu.match(/<svg /g) || []).length, /Analyse et commentaire/.test(pdf[0].contenu), /Mot du promoteur<\/b><br>Garantie &lt;b&gt;hypothèque&lt;\/b&gt;<br>Références/.test(pdf[0].contenu),
        /<b>Financement et trésorerie\.<\/b>/.test(pdf[0].contenu), /Besoin maximal de trésorerie/.test(pdf[0].contenu), /NaN|undefined/.test(pdf[0].contenu)];
      o.pdf = [/version figée « Dossier banque test »/.test(pdf[0].sousTitre), /VALEUR AJOUTÉE/.test(pdf[0].contenu), /Marketing/.test(pdf[0].contenu), /Pessimiste/.test(pdf[0].contenu), /Hausse du stock/.test(pdf[0].contenu)];
      const d = document.createElement('div'); d.innerHTML = _prevExploitHTML(_prevCompute(prevReadForm())); o.ecranPdf = document.getElementById('prev-results').textContent.indexOf(d.textContent) !== -1;
      saisir('prev-prix-lot', '20000000'); etatPrevResultat();
      o.travail = /version de travail/.test(pdf[1].sousTitre);
      window._cexpBudgetParRubrique = function () { const z = () => Array(12).fill(0), b = {}; ['transports', 'personnel', 'impots', 'dotations', 'autresServices'].forEach(k => b[k] = z());
        b.transports[0] = 1200000; b.autresServices[5] = 1200000; b.personnel[0] = 24000000; b.impots[1] = 500000; b.dotations[2] = 900000; return b; };
      prevReprendreBudget();
      o.budget = [val('prev-charges-fixes'), val('prev-masse-salariale'), val('prev-taxes-locales'), val('prev-dotations')];
      saisir('prev-charges-fixes', '777'); saisir('prev-taxes-locales', '888');
      window._cexpBudgetParRubrique = function () { const b = { personnel: Array(12).fill(0), achats: Array(12).fill(0), publiciteMarketing: Array(12).fill(0) }; b.personnel[0] = 1200000; b.achats[0] = 9e6; b.publiciteMarketing[0] = 5e6; return b; };
      prevReprendreBudget();
      o.budgetPartiel = [val('prev-charges-fixes'), val('prev-taxes-locales'), val('prev-masse-salariale')];
      DATA.lots = [{ programme_id: 'p1', prix: 10000000 }, { programme_id: 'p1', prix: 20000000 }, { programme_id: 'p1', prix: 0 }, { programme_id: 'p1', prix: 90000000, statut: 'vendu' }, { programme_id: 'p1', prix: 90000000, statut: 'reserve' }];
      DATA.terrains = [{ programme_id: 'p1', prix_acq: 3000000, valeur_actuelle: 9000000 }];
      document.getElementById('prev-programme').value = 'p1'; prevSeedFromProgramme();
      o.seed = [val('prev-prix-lot'), val('prev-lots-max'), val('prev-foncier-lot')];
      return o;
    });
    assert.deepEqual(r.defaut, ['6', '0.5', '']);
    assert.equal(r.apresSave, 'none');
    assert.equal(r.dirty, '');
    assert.equal(r.nonMute, 15000000);
    assert.equal(r.relu, '15000000');
    assert.deepEqual(r.version, [1, 'Dossier banque test', true]);
    assert.deepEqual(r.pdf, [true, true, true, true, true]);
    assert.equal(r.dirtyCom, '');
    assert.deepEqual(r.graph, [3, true, true, true, true, false]);
    assert.equal(r.ecranPdf, true);
    assert.equal(r.travail, true);
    assert.deepEqual(r.budget, ['200000', '2000000', '500000', '900000']);
    assert.deepEqual(r.budgetPartiel, ['777', '888', '100000']);
    assert.deepEqual(r.seed, ['15000000', '3', '600000']);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
