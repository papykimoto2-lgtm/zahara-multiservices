const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../entonnoir.js');
const T = (s) => Date.parse(s);
const lead = (id, o) => Object.assign({ id, stade: 'prospect', created_at: '2026-10-01', source: 'site_web', budget: 10000000 }, o);

test('transition : historique initial + passage, idempotent', () => {
  const l = lead('a'); 
  assert.equal(E.transition(l, 'contact', T('2026-10-03T10:00:00Z'), 'u1'), true);
  assert.equal(E.transition(l, 'contact', T('2026-10-04T10:00:00Z')), false);
  assert.deepEqual(l.historique_stades.map(h => h.stade), ['prospect', 'contact']);
  assert.equal(l.stade, 'contact');
  assert.equal(E.transition(l, 'inconnu', Date.now()), false);
});

test('perte : motif obligatoire connu, réouverture', () => {
  const l = lead('a', { stade: 'negociation' });
  assert.equal(E.marquerPerdu(l, 'bidon'), false);
  assert.equal(E.marquerPerdu(l, 'prix', 'trop cher', T('2026-10-20T00:00:00Z'), 'u1'), true);
  assert.equal(l.statut, 'perdu'); assert.equal(l.perte.stade, 'negociation');
  assert.equal(E.rouvrir(l), true); assert.equal(l.statut, 'actif'); assert.equal(l.perte, null);
});

test('cohorte : une perte compte à son étape, le franchi reste franchi', () => {
  const a = lead('a'), b = lead('b'), c = lead('c'), d = lead('d');
  E.transition(a, 'contact', T('2026-10-02')); E.transition(a, 'visite', T('2026-10-05')); E.transition(a, 'visite_faite', T('2026-10-08'));
  E.transition(a, 'negociation', T('2026-10-10')); E.transition(a, 'reservation', T('2026-10-15'));
  E.transition(b, 'contact', T('2026-10-02')); E.transition(b, 'visite', T('2026-10-05')); E.marquerPerdu(b, 'financement', '', T('2026-10-12'));
  E.transition(c, 'contact', T('2026-10-03'));
  const r = E.analyser([a, b, c, d], { minEffectif: 1, ticket: 10000000 }, T('2026-11-01'));
  assert.deepEqual(r.etapes.map(e => e.atteint), [4, 3, 2, 1, 1, 1]);
  assert.equal(r.etapes[2].taux_etape, 66.7);
  assert.equal(r.conversion_globale, 25);
  assert.equal(r.perdus, 1); assert.equal(r.etapes[2].perdus, 1);   // perdu à « visite »
  assert.equal(r.valeur_perdue, 10000000);
  assert.equal(r.motifs[0].motif, 'financement');
  assert.equal(r.estimes, 1);                                         // d : pas d'historique
  assert.ok(r.scenario && r.scenario.ventes_en_plus > 0 && r.scenario.valeur_en_plus > 0);
});

test('lead ancien sans historique : compté d\'après son stade, signalé estimé', () => {
  const r = E.analyser([lead('x', { stade: 'negociation' })], { minEffectif: 1 }, T('2026-11-01'));
  assert.deepEqual(r.etapes.map(e => e.atteint), [1, 1, 1, 1, 1, 0]);
  assert.equal(r.estimes, 1); assert.equal(r.estimes_part, 100);
});

test('goulot : jamais désigné sur un effectif trop faible', () => {
  const ls = [lead('a', { stade: 'contact' }), lead('b', { stade: 'prospect' })];
  assert.equal(E.analyser(ls, {}, T('2026-11-01')).goulot, null);
  assert.ok(E.analyser(ls, { minEffectif: 1 }, T('2026-11-01')).goulot);
});

test('filtres : période d\'entrée, source, commercial', () => {
  const ls = [lead('a', { created_at: '2026-09-10' }), lead('b', { created_at: '2026-10-10', source: 'salon', commercial_id: 'c1' }), lead('c', { created_at: '2026-10-20', source: 'salon' })];
  assert.equal(E.analyser(ls, { debut: '2026-10-01', fin: '2026-10-31' }).total, 2);
  assert.equal(E.analyser(ls, { source: 'salon' }).total, 2);
  assert.equal(E.analyser(ls, { source: 'salon', commercial_id: 'c1' }).total, 1);
});

test('segments : fiable d\'abord, taux de conversion par source', () => {
  const ls = [];
  for (let i = 0; i < 6; i++) ls.push(lead('w' + i, { source: 'site_web', stade: i < 3 ? 'reservation' : 'contact' }));
  ls.push(lead('s', { source: 'salon', stade: 'reservation' }));
  const r = E.analyser(ls, {}, T('2026-11-01'));
  assert.equal(r.par_source[0].cle, 'site_web'); assert.equal(r.par_source[0].taux, 50); assert.equal(r.par_source[0].fiable, true);
  assert.equal(r.par_source[1].fiable, false);
});

test('durée médiane par étape', () => {
  const a = lead('a'), b = lead('b');
  E.transition(a, 'contact', T('2026-10-03')); E.transition(a, 'visite', T('2026-10-05'));
  E.transition(b, 'contact', T('2026-10-05')); E.transition(b, 'visite', T('2026-10-11'));
  a.historique_stades[0].date = '2026-10-01'; b.historique_stades[0].date = '2026-10-01';
  const d = E.dureesParEtape([a, b], T('2026-11-01'));
  assert.equal(d[0].mediane, 3);          // prospect : 2 j et 4 j
  assert.equal(d[1].mediane, 4);          // contact : 2 j et 6 j
});

test('dormants : ouverts sans mouvement, triés par budget', () => {
  const a = lead('a', { budget: 5000000 }), b = lead('b', { budget: 20000000 }), c = lead('c', { budget: 99000000 }), d = lead('d', { stade: 'reservation' });
  E.initialiser(a, T('2026-10-01')); E.initialiser(b, T('2026-10-02')); E.initialiser(c, T('2026-10-30')); 
  const r = E.dormants([a, b, c, d], T('2026-11-05'), 14);
  assert.deepEqual(r.map(x => x.lead.id), ['b', 'a']);
});
