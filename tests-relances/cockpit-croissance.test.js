const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../cockpit-croissance.js');
const tout = { jour: '2026-11-08', tresorerie: { premierNegatif: 3, besoin: 5000000, soldeMin: -2000000, semaineMin: 6, seuil: 500000 }, wa: { actif: true, nb: 12, montant: 8000000 },
  leads: { chauds: 4, budgetChauds: 60000000, dormantsNego: 2, budgetNego: 30000000, relancesRetard: 3 }, parrainage: { aValider: 2, montant: 300000 },
  marges: { rouge: 1, orange: 2, incomplets: 1, premier: 'Eden' }, apporteurs: { dormants: 2, contrats: 1 } };

test('toutes les actions ont le schéma du Cockpit et un identifiant daté', () => {
  const A = C.construire(tout, (n) => String(n));
  assert.equal(A.length, 9);   // la marge rouge remplace la ligne marge orange
  A.forEach(a => { assert.match(a.aid, /^cr_.*_2026-11-08$/); assert.equal(typeof a.prio, 'number'); assert.ok(a.titre && a.detail && a.icone && Array.isArray(a.boutons) && a.boutons.length); a.boutons.forEach(b => assert.ok(b.fn || b.href)); });
  assert.equal(new Set(A.map(a => a.aid)).size, A.length);
});

test('priorités : trésorerie proche en tête, urgente ; prospects chauds après les négociations dormantes', () => {
  const A = C.construire(tout).sort((a, b) => b.prio - a.prio);
  assert.equal(A[0].aid.startsWith('cr_treso_'), true); assert.equal(A[0].urgent, true); assert.equal(A[0].prio, 110);
  const idx = (p) => A.findIndex(a => a.aid.startsWith(p));
  assert.ok(idx('cr_nego_') < idx('cr_chauds_')); assert.ok(idx('cr_marge_r_') < idx('cr_wa_'));   // marge négative (88) avant campagne WhatsApp (84)
  assert.ok(A.every(a => a.prio >= 25 && a.prio <= 120));
});

test('trésorerie lointaine : prio réduite et non urgente ; sous le seuil seulement : action douce', () => {
  assert.equal(C.construire({ jour: 'j', tresorerie: { premierNegatif: 9, besoin: 1, soldeMin: -1, semaineMin: 9, seuil: 0 } })[0].urgent, false);
  assert.equal(C.construire({ jour: 'j', tresorerie: { premierNegatif: 9, besoin: 1, soldeMin: -1, semaineMin: 9, seuil: 0 } })[0].prio, 80);
  const s = C.construire({ jour: 'j', tresorerie: { premierNegatif: null, besoin: 400000, soldeMin: 100000, semaineMin: 5, seuil: 500000 } });
  assert.equal(s[0].prio, 60);
});

test('rien à signaler : aucune action ; campagne WhatsApp absente si inactive', () => {
  assert.deepEqual(C.construire({ jour: 'j' }), []);
  assert.deepEqual(C.construire({ jour: 'j', tresorerie: { premierNegatif: null, besoin: 0 }, wa: { actif: false, nb: 5, montant: 1 }, leads: { chauds: 0 } }), []);
});

test('marge : rouge prioritaire sur orange (une seule ligne marge) ; pluriels', () => {
  const A = C.construire({ jour: 'j', marges: { rouge: 2, orange: 5, incomplets: 3, premier: 'X' } });
  assert.equal(A.length, 1); assert.match(A[0].titre, /2 programmes à marge négative/);
  assert.match(C.construire({ jour: 'j', leads: { chauds: 1, budgetChauds: 1 } })[0].titre, /^1 prospect chaud à appeler$/);
});
