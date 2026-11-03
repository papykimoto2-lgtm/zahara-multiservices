const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Les deux moteurs du Bilan (page Comptabilité : calcBilan ; liasse et consolidation : _lfCalc2) doivent
   donner le MÊME total d'actif et de passif. Avant : la liasse compensait les soldes de tous les tiers d'un
   même compte collectif (411, 401) ; un client créditeur ou un fournisseur débiteur disparaissait. */
const JEUX = {
  'simple': function () { return [E('a','2025-01-01','521','101',5000000)]; },
  'client créditeur à côté d\'un client débiteur (même compte 4111)': function () { return [
    E('a','2025-01-01','521','101',5000000),
    tiers(E('v1','2025-02-01','4111','701',1000000), '4111', 'A'),
    tiers(E('v2','2025-03-01','521','4111',400000), '4111', 'B')]; },
  'fournisseur débiteur à côté d\'un fournisseur créditeur (même compte 4011)': function () { return [
    E('a','2025-01-01','521','101',5000000),
    tiers(E('f1','2025-02-01','601','4011',300000), '4011', 'X'),
    tiers(E('f2','2025-03-01','4011','521',500000), '4011', 'Y')]; },
  'compte de liaison 890': function () { return [E('a','2025-01-01','521','890',1000000)]; },
  'découvert bancaire + banque créditrice': function () { return [
    E('a','2025-01-01','5211','101',5000000), E('b','2025-01-02','641','5212',3000000)]; },
  'tiers 42 à 47 mixtes': function () { return [
    E('a','2025-01-01','521','101',2000000), E('b','2025-02-01','521','451',500000),
    E('c','2025-02-02','462','521',200000), E('d','2025-03-01','641','422',150000)]; },
};
for (const nom of Object.keys(JEUX)) {
  test('Deux moteurs du Bilan, mêmes totaux — ' + nom, async () => {
    const app = await ouvrirApp();
    try {
      const r = await app.page.evaluate(function (src) {
        window.tiers = function (e, compte, tid) { e.lignes.forEach(function (l) { if (l.compte === compte) l.tiers_id = tid; }); return e; };
        DATA.ecritures = eval('(' + src + ')')();
        const b = calcBilan(2025, ''), c = _lfCalc2(2025, '');
        return { pa: b.totalActif, pp: b.totalPassif, la: c.A.BZ.n, lp: c.B.DZ };
      }, JEUX[nom].toString());
      assert.ok(Math.abs(r.pa - r.pp) < 0.5, 'page déséquilibrée');
      assert.ok(Math.abs(r.la - r.lp) < 0.5, 'liasse déséquilibrée');
      assert.ok(Math.abs(r.pa - r.la) < 0.5, 'actif page ' + r.pa + ' ≠ actif liasse ' + r.la);
    } finally { await app.fermer(); }
  });
}
