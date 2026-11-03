const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Régression : un compte bancaire créditeur (découvert) était déduit de l'actif (solde net de 52 à 58)
   ET ajouté au passif (DR) : bilan déséquilibré de son montant. Deux banques (l'une à découvert) se
   compensaient aussi sans que le découvert n'apparaisse. Classement désormais compte par compte. */
const JEUX = {
  'un compte bancaire à découvert': [['a','2025-01-01','101','521',1000000]],
  'deux banques dont une à découvert': [['a','2025-01-01','5211','101',5000000], ['b','2025-01-02','641','5212',3000000]],
  'banque créditrice (56) et débitrice (52)': [['a','2025-01-01','521','101',2000000], ['b','2025-01-02','641','561',700000]],
  'compte 56 débiteur': [['a','2025-01-01','561','101',300000]],
};
for (const nom of Object.keys(JEUX)) {
  test('Bilan équilibré avec découverts (_lfCalc2) — ' + nom, async () => {
    const app = await ouvrirApp();
    try {
      const r = await app.page.evaluate(function (jeu) {
        DATA.ecritures = jeu.map(function (x) { return E(x[0], x[1], x[2], x[3], x[4]); });
        const c = _lfCalc2(2025, '');
        const v1 = _lfCalc(2025, '');
        return { actif: c.A.BZ.n, passif: c.B.DZ, bz1: v1.B.BZ, dz1: v1.B.DZ };
      }, JEUX[nom]);
      assert.ok(Math.abs(r.actif - r.passif) < 0.5, 'v2 : actif ' + r.actif + ' ≠ passif ' + r.passif);
      assert.ok(Math.abs(r.bz1 - r.dz1) < 0.5, 'v1 : actif ' + r.bz1 + ' ≠ passif ' + r.dz1);
    } finally { await app.fermer(); }
  });
}

test('Découvert visible : le compte à découvert va au passif sans être déduit de l\'actif', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.ecritures = [E('a','2025-01-01','5211','101',5000000), E('b','2025-01-02','641','5212',3000000)];
      const c = _lfCalc2(2025, '');
      return { bs: c.A.BS.n, dr: c.B.DR };
    });
    assert.equal(r.bs, 5000000, 'actif : seul le compte débiteur');
    assert.equal(r.dr, 3000000, 'passif : le découvert apparaît');
  } finally { await app.fermer(); }
});
