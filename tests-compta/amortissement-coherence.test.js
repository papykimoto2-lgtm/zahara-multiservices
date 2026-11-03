const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Lot 2 de la revue du module amortissement : « Générer » (immobilisations société) et « Comptabiliser » (tous les biens)
   partagent un seul moteur. Même écriture quel que soit le bouton, liasse équilibrée, écritures périmées corrigées,
   clôture par division, compte de dotation vérifié avant toute écriture, contrôle plan / grand livre. */
function amorcer(page, options) {
  return page.evaluate(function (o) {
    DATA.params.comptes_defaut = Object.assign({}, DATA.params.comptes_defaut, { amort_dotation: '681' }, o.comptes || {});
    DATA.immobilisations = [{ id: 'im1', designation: 'Camion', valeur_acquisition: 1200000, valeur_residuelle: 0, duree_ans: 5, date_acquisition: '2024-01-01', methode: 'lineaire', compte: '245' }];
    DATA.biens_amort = [];
    DATA.ecritures = [];
    window.__annee = function (a) {
      const sel = document.getElementById('filter-amort-annee'); sel.innerHTML = '<option value="' + a + '">' + a + '</option>'; sel.value = String(a);
      const sy = document.getElementById('immo-soc-annee'); sy.innerHTML = '<option value="' + a + '">' + a + '</option>'; sy.value = String(a);
    };
  }, options || {});
}

test('écritures de dotation équilibrées : D compte de dotation, C compte d\'amortissement du bien, journal OD', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      DATA.biens_amort = [{ id: 'b1', designation: 'Immeuble', valeur_origine: 5000000, valeur_residuelle: 0, duree: 20, date_debut: '2024-01-01', methode: 'lineaire', compte_immo: '221', compte_amort: '2821' }];
      __annee(2025); await comptabiliserDotations();
      return DATA.ecritures.map(function (e) {
        const L = ecrLignes(e), D = L.filter(function (l) { return l.sens === 'D'; }).reduce(function (s, l) { return s + l.montant; }, 0), C = L.filter(function (l) { return l.sens === 'C'; }).reduce(function (s, l) { return s + l.montant; }, 0);
        return { D: D, C: C, deb: e.compte_debit, cre: e.compte_credit, journal: e.journal };
      });
    });
    assert.equal(r.length, 2);
    r.forEach(function (e) { assert.equal(e.D, e.C); assert.ok(e.D > 0); assert.equal(e.deb, '681'); assert.equal(e.journal, 'OD'); });
    assert.deepEqual(r.map(function (e) { return e.cre; }).sort(), ['2821', '2845']);
  } finally { await app.fermer(); }
});

test('même écriture quel que soit le bouton : « Générer » crédite le 28x du bien, pas le compte générique amort_cumul', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, { comptes: { amort_cumul: '28' } });
    const r = await app.page.evaluate(async function () {
      __annee(2025);
      await genererDotationsAnnuelles();
      const parGenerer = JSON.parse(JSON.stringify(DATA.ecritures));
      await comptabiliserDotations();
      const parComptabiliser = JSON.parse(JSON.stringify(DATA.ecritures));
      return { parGenerer: parGenerer, parComptabiliser: parComptabiliser };
    });
    assert.equal(r.parGenerer.length, 1); assert.equal(r.parComptabiliser.length, 1);
    assert.equal(r.parGenerer[0].compte_credit, '2845');
    assert.deepEqual(r.parGenerer[0], r.parComptabiliser[0], 'les deux boutons doivent produire la même écriture');
  } finally { await app.fermer(); }
});

test('liasse équilibrée après « Générer », même avec amort_cumul = « 28 » (compte inconnu de la liasse)', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, { comptes: { amort_cumul: '28' } });
    const r = await app.page.evaluate(async function () {
      DATA.ecritures = [E('acq', '2024-01-01', '245', '101', 1200000)];
      __annee(2025); await genererDotationsAnnuelles();
      annee(2025);
      const B = calcBilan(2025, ''), L = _lfCalc2(2025, '');
      return { calc: B.equilibre, actif: L.A.BZ.n, passif: L.B.DZ };
    });
    assert.equal(r.calc, true);
    assert.equal(r.actif, r.passif, 'liasse : actif ' + r.actif + ' ≠ passif ' + r.passif);
  } finally { await app.fermer(); }
});

test('idempotence : relancer les boutons ne crée jamais de doublon', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      __annee(2025);
      await comptabiliserDotations(); await comptabiliserDotations(); await genererDotationsAnnuelles(); await comptabiliserDotations();
      return DATA.ecritures.length;
    });
    assert.equal(r, 1);
  } finally { await app.fermer(); }
});

test('écriture périmée : « Générer » corrige le montant après modification du plan (avant : il ne régénérait pas)', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      __annee(2025); await genererDotationsAnnuelles();
      const avant = DATA.ecritures[0].montant;
      DATA.immobilisations[0].valeur_acquisition = 1800000;
      await genererDotationsAnnuelles();
      return { avant: avant, apres: DATA.ecritures[0].montant, n: DATA.ecritures.length, plan: calcAnnuite(_amortAdapterImmo(DATA.immobilisations[0]), 2025) };
    });
    assert.equal(r.avant, 240000); assert.equal(r.apres, 360000); assert.equal(r.apres, r.plan); assert.equal(r.n, 1);
  } finally { await app.fermer(); }
});

test('pièce visée contre-passée : « Générer » crée l\'écriture de révision', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      __annee(2025); await genererDotationsAnnuelles();
      const e = DATA.ecritures[0]; e.valide_le = '2026-01-10'; await dbPut('ecritures', e);
      e.contrepassee_par = 'CP-X'; await dbPut('ecritures', e, { forceCloture: true });
      await genererDotationsAnnuelles();
      const rev = DATA.ecritures.find(function (x) { return x.id === 'ecr_immosoc_dot_im1_2025_r2'; });
      return { rev: rev && rev.montant, orig: DATA.ecritures.find(function (x) { return x.id === 'ecr_immosoc_dot_im1_2025'; }).montant };
    });
    assert.equal(r.rev, 240000); assert.equal(r.orig, 240000);
  } finally { await app.fermer(); }
});

test('clôture par division : la dotation d\'une division clôturée est refusée, celle des autres divisions passe', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      DATA.immobilisations = [
        { id: 'im1', designation: 'Camion D1', valeur_acquisition: 1200000, valeur_residuelle: 0, duree_ans: 5, date_acquisition: '2024-01-01', methode: 'lineaire', compte: '245', division_id: 'D1' },
        { id: 'im2', designation: 'Camion D2', valeur_acquisition: 1200000, valeur_residuelle: 0, duree_ans: 5, date_acquisition: '2024-01-01', methode: 'lineaire', compte: '245', division_id: 'D2' }];
      DATA.params['cloture_2025-D1'] = true;
      __annee(2025); await comptabiliserDotations();
      return { ids: DATA.ecritures.map(function (e) { return e.id; }), toast: window.__toasts.join(' ') };
    });
    assert.deepEqual(r.ids, ['ecr_immosoc_dot_im2_2025']);
    assert.match(r.toast, /1 refusée/);
  } finally { await app.fermer(); }
});

test('compte de dotation non paramétré : message, aucune écriture et aucune exception', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      delete DATA.params.comptes_defaut.amort_dotation;
      __annee(2025);
      let erreur = null;
      try { await comptabiliserDotations(); await genererDotationsAnnuelles(); } catch (e) { erreur = String(e); }
      return { erreur: erreur, n: DATA.ecritures.length, toast: window.__toasts.join(' ') };
    });
    assert.equal(r.erreur, null); assert.equal(r.n, 0); assert.match(r.toast, /Compte non paramétré/);
  } finally { await app.fermer(); }
});

test('contrôle plan / grand livre : année manquante ou divergente détectée, puis rattrapée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      __annee(2025); await comptabiliserDotations();                       /* seule 2025 est comptabilisée : 2024 manque */
      const avant = amortControleGrandLivre(2025).map(function (e) { return e.annee + ':' + e.type; });
      buildDotations();
      const alerte = document.getElementById('dotations-alerte');
      const alerteVisible = alerte.style.display !== 'none' && /Rattraper/.test(alerte.textContent);
      await amortRattraperExercices();
      return { avant: avant, alerteVisible: alerteVisible, apres: amortControleGrandLivre(2025).length, ids: DATA.ecritures.map(function (e) { return e.id; }).sort(), alerteApres: document.getElementById('dotations-alerte').style.display };
    });
    assert.deepEqual(r.avant, ['2024:manquante']);
    assert.equal(r.alerteVisible, true);
    assert.equal(r.apres, 0);
    assert.deepEqual(r.ids, ['ecr_immosoc_dot_im1_2024', 'ecr_immosoc_dot_im1_2025']);
    assert.equal(r.alerteApres, 'none');
  } finally { await app.fermer(); }
});

test('cohérence tableau / bilan : après les dotations de toutes les années, calcBilan et le tableau concordent', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      DATA.ecritures = [E('acq', '2024-01-01', '245', '101', 1200000)];
      for (const a of [2024, 2025]) { __annee(a); await comptabiliserDotations(); }
      annee(2025);
      const B = calcBilan(2025, ''), bien = _amortAdapterImmo(DATA.immobilisations[0]);
      return { amort: B.amort, immo: B.immoBrut, cumul: calcAmortCumul(bien, 2025), vnc: calcVNC(bien, 2025), eq: B.equilibre };
    });
    assert.equal(r.amort, -r.cumul); assert.equal(r.immo + r.amort, r.vnc); assert.equal(r.eq, true);
  } finally { await app.fermer(); }
});
