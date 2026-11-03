const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Moteur du Bilan utilisé par la consolidation et la liasse (_lfCalc2 + _lfCalc).
   Chaque jeu est équilibré écriture par écriture : actif et passif doivent donc l'être aussi.
   Régression : les comptes 42 à 47 (tiers de nature mixte) étaient repris à l'actif (solde net) ET au passif
   (solde net inversé) : le bilan était déséquilibré du solde net de ces comptes. */
const JEUX = {
  'compte 451 créditeur (organismes) seul': [['a','2025-01-01','512','101',1000000],['b','2025-02-01','512','451',500000]],
  'comptes 42 à 47 créditeurs ET débiteurs ensemble': [
    ['a','2025-01-01','512','101',2000000],
    ['b','2025-02-01','512','451',500000],      // 451 créditeur
    ['c','2025-02-02','462','512',200000],      // 462 débiteur (associé)
    ['d','2025-03-01','641','422',150000],      // 422 créditeur (personnel dû)
    ['e','2025-03-02','4452','512',30000],      // 4452 débiteur (TVA récupérable)
    ['f','2025-03-03','512','4431',40000],      // 4431 créditeur (TVA collectée)
  ],
  'même compte 46 débiteur puis créditeur dans l\'année (solde créditeur final)': [
    ['a','2025-01-01','512','101',1000000],
    ['b','2025-02-01','462','512',300000],
    ['c','2025-05-01','512','462',700000],
  ],
  '478 (écart de conversion actif) et 479 (passif) : une seule ligne chacun': [
    ['a','2025-01-01','512','101',1000],
    ['b','2025-02-01','478','479',400],
  ],
};

for (const nom of Object.keys(JEUX)) {
  test('Bilan consolidation équilibré (_lfCalc2) — ' + nom, async () => {
    const app = await ouvrirApp();
    try {
      const r = await app.page.evaluate(function (jeu) {
        DATA.ecritures = jeu.map(function (x) { return E(x[0], x[1], x[2], x[3], x[4]); });
        const c = _lfCalc2(2025, '');
        return { actif: c.A.BZ.n, passif: c.B.DZ };
      }, JEUX[nom]);
      assert.ok(Math.abs(r.actif - r.passif) < 0.5, 'actif ' + r.actif + ' ≠ passif ' + r.passif + ' (écart ' + (r.actif - r.passif) + ')');
    } finally { await app.fermer(); }
  });
}

test('Bilan consolidation : un compte créditeur n\'est plus déduit de l\'actif, un compte débiteur n\'est plus déduit du passif', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.ecritures = [
        E('a','2025-01-01','512','101',2000000),
        E('b','2025-02-01','512','451',500000),    // 451 créditeur 500 000
        E('c','2025-02-02','462','512',200000),    // 462 débiteur 200 000
      ];
      const c = _lfCalc2(2025, '');
      return { bj: c.A.BJ.n, dm: c.B.DM };
    });
    assert.equal(r.bj, 200000, 'BJ (créances diverses) = seul le compte 462 débiteur');
    assert.equal(r.dm, 500000, 'DM (dettes diverses) = seul le compte 451 créditeur');
  } finally { await app.fermer(); }
});

test('Consolidation par division : le bilan consolidé est équilibré avec des comptes 42 à 47 mixtes', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Division 1' }, { id: 'd2', nom: 'Division 2' }];
      DATA.ecritures = [
        E('a1','2025-01-01','512','101',3000000, { division: 'd1' }),
        E('b1','2025-02-01','512','451',900000,  { division: 'd1' }),
        E('c1','2025-02-02','462','512',250000,  { division: 'd1' }),
        E('a2','2025-01-01','512','101',1000000, { division: 'd2' }),
        E('b2','2025-03-01','641','422',120000,  { division: 'd2' }),
        E('c2','2025-03-02','4452','512',20000,  { division: 'd2' }),
      ];
      const K = consoCalcul(2025);
      return { bz: K.conso.BZ, dz: K.conso.DZ, entites: K.lignes.length };
    });
    assert.equal(r.entites, 2);
    assert.ok(Math.abs(r.bz - r.dz) < 0.5, 'consolidé : actif ' + r.bz + ' ≠ passif ' + r.dz);
  } finally { await app.fermer(); }
});
