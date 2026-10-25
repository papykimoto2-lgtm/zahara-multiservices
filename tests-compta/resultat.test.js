const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('Compte de résultat : une vente contre-passée et une charge extournée s\'annulent', async () => {
  const app = await ouvrirApp();
  try {
    const R = await app.page.evaluate(function () {
      DATA.ecritures = [E('s1','2025-02-01','4111','701',1000), E('s2','2025-02-02','701','4111',1000),
                        E('c1','2025-02-03','641','512',400), E('c2','2025-02-04','512','641',400)];
      const r = _calcResultat('2025');
      return { ventes: r.ventes, personnel: r.personnel, rNet: r.rNet };
    });
    assert.equal(R.ventes, 0);
    assert.equal(R.personnel, 0);
    assert.equal(R.rNet, 0);
  } finally { await app.fermer(); }
});

test('Compte de résultat : même résultat que le Bilan, y compris comptes hors rubriques (697, 79, classe 8)', async () => {
  const app = await ouvrirApp();
  try {
    const R = await app.page.evaluate(function () {
      DATA.ecritures = [E('a','2025-02-01','4111','701',900), E('b','2025-03-02','601','512',100), E('c','2025-03-03','697','512',30),
                        E('d','2025-03-04','512','821',50), E('e','2025-03-05','512','791',20)];
      const r = _calcResultat('2025'), b = calcBilan(2025, '');
      return { avantIS: r.rAvantIS, bilan: b.resultat, produits: r.totalProduits, charges: r.totalCharges, is: r.is, rNet: r.rNet };
    });
    assert.equal(R.avantIS, R.bilan);            /* 900 - 100 - 30 + 50 + 20 = 840 */
    assert.equal(R.bilan, 840);
    assert.equal(R.produits - R.charges, R.rNet);
  } finally { await app.fermer(); }
});

test('Tableau de bord : produits et charges nets des contre-passations', async () => {
  const app = await ouvrirApp();
  try {
    const R = await app.page.evaluate(function () {
      DATA.ecritures = [E('s1','2025-02-01','4111','701',1000), E('s2','2025-02-02','701','4111',300), E('c1','2025-02-03','641','512',400), E('c2','2025-02-04','512','641',100)];
      return { p: dashProduits(), c: dashDecaissements() };
    });
    assert.equal(R.p, 700);
    assert.equal(R.c, 300);
  } finally { await app.fermer(); }
});

test('Compte de résultat : production stockée (71-72) nette, sans double décompte', async () => {
  const app = await ouvrirApp();
  try {
    const R = await app.page.evaluate(function () {
      DATA.ecritures = [E('a','2025-02-01','331','712',1000), E('b','2025-03-01','712','331',400)];
      const r = _calcResultat('2025');
      return { stock: r.prodStockee, rNet: r.rNet, bilan: calcBilan(2025, '').resultat };
    });
    assert.equal(R.stock, 600);
    assert.equal(R.bilan, 600);
  } finally { await app.fermer(); }
});

test('Référentiel SYSCOHADA révisé : 66 personnel, 64 impôts, 67 frais financiers, 83/84 HAO, 89 impôt sur le résultat', async () => {
  const app = await ouvrirApp();
  try {
    const R = await app.page.evaluate(function () {
      /* plan SYSCOHADA : le compte 661 y est la rémunération du personnel */
      APP.planComptable.filter(function (c) { return c.code === '661'; }).forEach(function (c) { c.label = 'Rémunérations directes versées au personnel national'; });
      APP.planComptable.filter(function (c) { return c.code === '641'; }).forEach(function (c) { c.label = 'Impôts et taxes directs'; });   /* en SYSCOHADA 64 = impôts et taxes */
      const ref = referentielCompta();
      DATA.ecritures = [E('v','2025-02-01','4111','701',1000), E('p','2025-02-02','661','512',200), E('i','2025-02-03','641','512',50),
                        E('f','2025-02-04','671','512',30), E('h','2025-02-05','512','841',70), E('c','2025-02-06','831','512',20), E('t','2025-12-31','891','444',10)];
      const r = _calcResultat('2025'), b = calcBilan(2025, '');
      return { ref: ref, personnel: r.personnel, impots: r.impots, fin: r.chargesFin, hao: r.rHAO, is: r.isComptab, avantIS: r.rAvantIS, bilan: b.resultat, rNet: r.rNet,
               equil: b.equilibre };
    });
    assert.equal(R.ref, 'syscohada');
    assert.equal(R.personnel, 200);
    assert.equal(R.impots, 50);
    assert.equal(R.fin, 30);
    assert.equal(R.hao, 50);            /* 70 - 20 */
    assert.equal(R.is, 10);
    assert.equal(R.rNet, R.bilan);      /* l'impôt est comptabilisé : plus aucun écart avec le Bilan */
    assert.equal(R.bilan, 1000 - 200 - 50 - 30 + 70 - 20 - 10);
  } finally { await app.fermer(); }
});

test('Plan d\'origine : numérotation de type PCG inchangée (64 personnel, 693 impôt)', async () => {
  const app = await ouvrirApp();
  try {
    const R = await app.page.evaluate(function () {
      const ref = referentielCompta();
      DATA.ecritures = [E('p','2025-02-02','641','512',200), E('i','2025-02-03','633','512',50), E('t','2025-12-31','693','444',10)];
      const r = _calcResultat('2025');
      return { ref: ref, personnel: r.personnel, impots: r.impots, is: r.isComptab };
    });
    assert.equal(R.ref, 'pcg');
    assert.equal(R.personnel, 200);
    assert.equal(R.impots, 50);
    assert.equal(R.is, 10);
  } finally { await app.fermer(); }
});

test('Référentiel : le plan de production (SYSCOHADA révisé, libellés abrégés) est reconnu', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      /* libellés réels du plan MENCO (1 827 comptes) */
      APP.planComptable = APP.planComptable.filter(function (c) { return ['641', '661', '64', '66', '121', '129', '131', '139'].indexOf(c.code) === -1; });
      [['64', 'IMPOTS TAXES'], ['641', 'IMPOTS TAXES DIRECTS'], ['66', 'CHARGES PERSONNEL'], ['661', 'REMU DIRECT VERS PERSL NATIONAL'],
       ['121', 'REPORT A NOUVEAU CREDITEUR'], ['129', 'REPORT A NOUVEAU DEBITEUR'], ['131', 'RESULTAT NET BENEFICE'], ['139', 'RESULTAT NET PERTE']]
        .forEach(function (x) { APP.planComptable.push({ code: x[0], classe: x[0][0], label: x[1], nature: 'variable' }); });
      const ref = referentielCompta();
      /* sans 131/139 au plan, 121/129 (report à nouveau) ne doivent JAMAIS recevoir le résultat */
      APP.planComptable = APP.planComptable.filter(function (c) { return c.code !== '131' && c.code !== '139'; });
      const cpt = await _assurerCompteResultat(true);
      return { ref: ref, cpt: cpt };
    });
    assert.equal(r.ref, 'syscohada');
    assert.equal(r.cpt, '131');
  } finally { await app.fermer(); }
});
