const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../tresorerie-prev.js');
const NOW = Date.parse('2026-11-02T12:00:00');   // lundi

test('catégories : personnel, impôts, emprunts, fournisseurs, investissement, autres', () => {
  assert.equal(P.categorieDe('641'), 'paie'); assert.equal(P.categorieDe('4211'), 'paie'); assert.equal(P.categorieDe('431'), 'paie');
  assert.equal(P.categorieDe('4441'), 'impots'); assert.equal(P.categorieDe('661'), 'emprunts'); assert.equal(P.categorieDe('165'), 'emprunts');
  assert.equal(P.categorieDe('401'), 'fournisseurs'); assert.equal(P.categorieDe('605'), 'fournisseurs'); assert.equal(P.categorieDe('241'), 'investissement');
  assert.equal(P.categorieDe('658'), 'autres');
  assert.equal(P.categorieDe('666', { paie: ['66'] }), 'paie');
});

test('profil des sorties : mensuel posé au jour habituel, diffus à la semaine, investissement exclu, hors fenêtre ignoré', () => {
  const h = [
    { date: '2026-08-28', montant: 3000000, cat: 'paie' }, { date: '2026-09-28', montant: 3000000, cat: 'paie' }, { date: '2026-10-28', montant: 3000000, cat: 'paie' },
    { date: '2026-09-10', montant: 900000, cat: 'fournisseurs' }, { date: '2026-10-15', montant: 900000, cat: 'fournisseurs' },
    { date: '2026-10-01', montant: 50000000, cat: 'investissement' }, { date: '2025-01-01', montant: 9999999, cat: 'autres' }
  ];
  const p = P.profilSorties(h, NOW, 90);
  assert.equal(p.paie.mode, 'mensuel'); assert.equal(p.paie.jour, 28); assert.ok(Math.abs(p.paie.mensuel - 9000000 / (90 / 30.4375)) < 1);
  assert.equal(p.fournisseurs.mode, 'diffus'); assert.equal(p.investissement, undefined); assert.equal(p.autres, undefined);
});

test('taux de recouvrement : mesuré, plafonné, repli signalé', () => {
  assert.deepEqual(P.tauxRecouvrement(60, 100), { taux: 0.6, mesure: true });
  assert.equal(P.tauxRecouvrement(500, 100).taux, 1.2);
  assert.deepEqual(P.tauxRecouvrement(0, 0), { taux: 0.7, mesure: false });
});

test('échéances client : jour du mois, plafonnées au reste à payer, pas avant l\'ancrage', () => {
  const c = { client_id: 'c', ancre: '2026-01-15', mensualite: 100000, reste: 250000 };
  const e = P.echeancesClient(c, NOW, 13);
  assert.deepEqual(e.map(x => x.date), ['2026-11-15', '2026-12-15', '2027-01-15']);
  assert.deepEqual(e.map(x => x.montant), [100000, 100000, 50000]);
  assert.equal(P.echeancesClient({ ...c, ancre: '2027-03-01' }, NOW, 13).length, 0);
  assert.equal(P.echeancesClient({ ...c, mensualite: 0 }, NOW, 13).length, 0);
});

test('lignes manuelles : unique, hebdo, mensuel plafonné fin de mois, probabilité, date de fin', () => {
  const deb = Date.parse('2026-11-02T12:00:00'), fin = deb + 13 * 7 * 86400000;
  assert.equal(P.occurrences({ date: '2026-11-10', montant: 100, recurrence: 'unique' }, deb, fin).length, 1);
  assert.equal(P.occurrences({ date: '2026-11-10', montant: 100, recurrence: 'unique' }, deb, deb + 3 * 86400000).length, 0);
  assert.equal(P.occurrences({ date: '2026-11-02', montant: 100, recurrence: 'hebdo' }, deb, fin).length, 13);
  assert.equal(P.occurrences({ date: '2026-11-02', montant: 100, recurrence: 'hebdo', fin: '2026-11-20' }, deb, fin).length, 3);
  const m = P.occurrences({ date: '2026-10-31', montant: 100, recurrence: 'mensuel' }, deb, fin).map(o => new Date(o.t).getDate());
  assert.deepEqual(m, [30, 31, 31]);   // 30 nov (plafonné), 31 déc, 31 janv : tous avant le 1er févr. 2027
});

test('projection : solde cumulé cohérent, scénarios ordonnés, creux et alerte', () => {
  const e = { now: NOW, soldeInitial: 5000000, tauxRecouvrement: 0.8,
    echeances: [{ date: '2026-11-10', montant: 2000000 }, { date: '2026-12-10', montant: 2000000 }],
    profil: { paie: { mode: 'mensuel', mensuel: 3000000, jour: 28, hebdo: 0 }, fournisseurs: { mode: 'diffus', hebdo: 300000, mensuel: 0, jour: 1 } },
    manuels: [{ date: '2026-11-20', libelle: 'Terrain', sens: 'sortie', montant: 4000000, recurrence: 'unique' }, { date: '2026-12-01', libelle: 'Vente', sens: 'entree', montant: 1000000, recurrence: 'unique', proba: 0.5 }], seuil: 1000000 };
  const b = P.projeter(e);
  assert.equal(b.semaines.length, 13);
  let s = e.soldeInitial; b.semaines.forEach(w => { s += w.entrees - w.total_sorties; assert.ok(Math.abs(w.solde - s) < 1e-6); });
  assert.ok(Math.abs(b.solde_final - s) < 1e-6);
  assert.equal(b.semaines[1].clients, 1600000);                            // 2 000 000 × 0,8 en semaine 2
  assert.equal(b.semaines[2].manuel_out, 4000000);                         // 20 nov
  const sc = P.comparer(e);
  assert.ok(sc.prudent.solde_final < sc.base.solde_final && sc.base.solde_final < sc.optimiste.solde_final);
  assert.ok(b.solde_min <= e.soldeInitial);
  const al = P.alertes(b, 1000000); assert.ok(al.length >= 1);
});

test('paie : montant inchangé entre scénarios (le salaire se paie quoi qu\'il arrive)', () => {
  const e = { now: NOW, soldeInitial: 0, profil: { paie: { mode: 'mensuel', mensuel: 1000, jour: 28, hebdo: 0 } } };
  const tot = (sc) => P.projeter({ ...e, scenario: sc }).sorties;
  assert.equal(tot('prudent'), tot('optimiste'));
});

test('solde négatif : première semaine négative et besoin chiffré', () => {
  const p = P.projeter({ now: NOW, soldeInitial: 100, profil: { fournisseurs: { mode: 'diffus', hebdo: 60, mensuel: 0, jour: 1 } }, seuil: 500 });
  assert.equal(p.premier_negatif, 2); assert.equal(p.semaine_min, 13); assert.ok(p.besoin > 500);
  assert.equal(P.alertes(p, 500)[0].niveau, 'rouge');
});
