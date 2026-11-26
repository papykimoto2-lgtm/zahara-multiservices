const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../marge-prog.js');
const base = { produitsEngages: 400, produitsPotentiel: 1000, couts: 700, margePot: 300, caRestant: 600, nbLotsRestants: 6, coutFoncier: 100, coutTravaux: 500, foncierLie: true,
  programmeConstruction: true, nbLogements: 10, nbLotsSansPrix: 0, coutCommercial: 40, commissionsAVenir: null, encaisse: 300, nbCommissions: 3 };

test('statuts : vert, orange sous la cible, rouge si marge négative', () => {
  assert.equal(M.evaluer(base).statut, 'vert');                                                    // 30 % ≥ 15 %
  assert.equal(M.evaluer({ ...base, couts: 900, margePot: 100 }).statut, 'orange');                // 10 % < 15 %
  assert.equal(M.evaluer({ ...base, couts: 1100, margePot: -100 }).statut, 'rouge');
  assert.equal(M.evaluer({ ...base, margePot: 300 }, 40).statut, 'orange');                        // cible réglable
  assert.equal(M.evaluer({ ...base, produitsPotentiel: 0, margePot: 0 }).statut, 'inconnu');
});

test('commissions à venir : la marge nette peut faire basculer le statut', () => {
  const e = M.evaluer({ ...base, couts: 860, margePot: 140, commissionsAVenir: 40 });             // 14 % → 10 % net
  assert.equal(e.statut, 'orange'); assert.equal(e.marge_nette, 100); assert.equal(e.taux_net, 10);
  assert.equal(M.evaluer({ ...base, commissionsAVenir: null }).marge_nette, null);
});

test('fiabilité : foncier, travaux, prix, commissions manquants', () => {
  assert.equal(M.evaluer(base).fiable, true);
  const m = (o) => M.evaluer({ ...base, ...o }).manques.map(x => x.k);
  assert.deepEqual(m({ foncierLie: false }), ['foncier']); assert.deepEqual(m({ coutFoncier: 0 }), ['foncier']);
  assert.deepEqual(m({ coutTravaux: 0 }), ['travaux']); assert.deepEqual(m({ coutTravaux: 0, programmeConstruction: false }), []);
  assert.deepEqual(m({ nbLotsSansPrix: 2 }), ['prix']); assert.deepEqual(m({ nbCommissions: 0 }), ['commissions']);
  assert.deepEqual(m({ nbCommissions: 0, encaisse: 0 }), []);
});

test('prix plancher : prix moyen minimal des lots restants pour tenir la cible', () => {
  const e = M.evaluer({ ...base, couts: 850, produitsEngages: 400, caRestant: 600, nbLotsRestants: 6 }, 15);
  // requis = 850 / 0,85 = 1000 ; reste = 600 ; par lot = 100 ; actuel = 100 → remise max 0 %
  assert.equal(e.plancher.prix_moyen_min, 100); assert.equal(e.plancher.prix_moyen_actuel, 100); assert.equal(e.plancher.remise_max_pct, 0);
  const f = M.evaluer({ ...base, couts: 595, caRestant: 600 }, 15);   // requis 700 ; reste 300 ; 50/lot vs 100 → 50 % de marge de manœuvre
  assert.equal(f.plancher.prix_moyen_min, 50); assert.equal(f.plancher.remise_max_pct, 50); assert.equal(f.plancher.deja_insuffisant, false);
  const g = M.evaluer({ ...base, couts: 1000, caRestant: 600 }, 15);   // requis 1176 ; reste 776 ; 129/lot > 100
  assert.equal(g.plancher.deja_insuffisant, true); assert.ok(g.plancher.remise_max_pct < 0);
  assert.equal(M.evaluer({ ...base, nbLotsRestants: 0 }).plancher, null);
});

test('classement : rouge puis orange, non fiables avant fiables à statut égal', () => {
  const L = [{ id: 'v', e: M.evaluer(base) }, { id: 'r', e: M.evaluer({ ...base, couts: 1100, margePot: -100 }) }, { id: 'o', e: M.evaluer({ ...base, couts: 900, margePot: 100 }) },
    { id: 'vi', e: M.evaluer({ ...base, foncierLie: false }) }];
  assert.deepEqual(M.classer(L).map(x => x.id), ['r', 'o', 'vi', 'v']);
});
