const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lead-score.js');
const T = (s) => Date.parse(s);
const NOW = T('2026-11-08T12:00:00Z');
const lead = (id, o) => Object.assign({ id, stade: 'contact', tel: '0712345678', source: 'site_web', created_at: '2026-11-05', budget: 10000000 }, o);

test('score borné 0-100, poids cohérents (total 100)', () => {
  assert.equal(Object.values(L.POIDS).reduce((a, b) => a + b, 0), 100);
  const max = lead('m', { stade: 'negociation', date_contact: '2026-11-08', email: 'a@b.c', programme_id: 'p', commercial_id: 'c', date_relance: '2026-11-10' });
  const s = L.scorer(max, L.contexte([max], { ticket: 10000000 }), NOW);
  assert.ok(s.score >= 85 && s.score <= 100, String(s.score));
  assert.equal(s.niveau, 'chaud');
  const min = lead('n', { stade: 'prospect', tel: '', budget: 0, source: '—', created_at: '2026-01-01' });
  const z = L.scorer(min, L.contexte([min], {}), NOW);
  assert.ok(z.score >= 0 && z.score < 20, String(z.score)); assert.equal(z.niveau, 'froid');
});

test('chaque point est expliqué : somme des raisons = score', () => {
  const l = lead('a', { stade: 'visite_faite', programme_id: 'p1' });
  const s = L.scorer(l, L.contexte([l], { prixProgramme: { p1: 12000000 } }), NOW);
  assert.equal(Math.round(s.raisons.reduce((t, r) => t + r.points, 0)), s.score);
  assert.ok(s.raisons.every(r => r.points >= 0 && r.points <= r.max && r.texte));
});

test('fraîcheur : un lead qui dort perd des points', () => {
  const ctx = L.contexte([], {});
  const frais = L.scorer(lead('a', { created_at: '2026-11-07' }), ctx, NOW), vieux = L.scorer(lead('b', { created_at: '2026-08-01' }), ctx, NOW);
  assert.ok(frais.score - vieux.score >= 15);
});

test('budget : insuffisant < suffisant ; non renseigné traité à part', () => {
  const ctx = L.contexte([], { ticket: 10000000 });
  const p = (b) => L.scorer(lead('x', { budget: b }), ctx, NOW).raisons.find(r => r.critere === 'budget').points;
  assert.ok(p(10000000) > p(8000000)); assert.ok(p(8000000) > p(5000000)); assert.ok(p(5000000) < p(0));   /* budget connu et insuffisant < budget inconnu */
  assert.equal(p(0), 3);
});

test('source : appris des données si ≥ 5 leads, sinon neutre', () => {
  const ls = [];
  for (let i = 0; i < 6; i++) ls.push(lead('w' + i, { source: 'site_web', stade: i < 4 ? 'reservation' : 'contact' }));
  for (let i = 0; i < 6; i++) ls.push(lead('s' + i, { source: 'salon', stade: i < 1 ? 'reservation' : 'contact' }));
  ls.push(lead('r', { source: 'rare' }));
  const ctx = L.contexte(ls, {});
  const pts = (src) => L.scorer(lead('t', { source: src }), ctx, NOW).raisons.find(r => r.critere === 'source').points;
  assert.ok(pts('site_web') > pts('salon')); assert.equal(pts('rare'), 7.5);
});

test('leads clos : pas de score', () => {
  const ctx = L.contexte([], {});
  assert.equal(L.scorer(lead('a', { statut: 'perdu' }), ctx, NOW), null);
  assert.equal(L.scorer(lead('b', { stade: 'reservation' }), ctx, NOW), null);
  assert.equal(L.scorer(lead('c', { statut: 'converti' }), ctx, NOW), null);
});

test('action : une seule, adaptée', () => {
  const ctx = L.contexte([], {});
  const a = (o) => L.scorer(lead('x', o), ctx, NOW).action;
  assert.match(a({ tel: '' }), /téléphone/i);
  assert.match(a({ date_relance: '2026-10-20' }), /retard/i);
  assert.match(a({ stade: 'visite_faite' }), /48 h/);
  assert.match(a({ stade: 'negociation' }), /offre|signature/);
  assert.match(a({ stade: 'contact', budget: 0 }), /budget/i);
});

test('classement : score puis budget', () => {
  const ls = [lead('a', { stade: 'prospect' }), lead('b', { stade: 'negociation', budget: 5000000 }), lead('c', { stade: 'negociation', budget: 20000000 }), lead('d', { statut: 'perdu' })];
  assert.deepEqual(L.classer(ls, null, NOW).map(x => x.lead.id), ['c', 'b', 'a']);
});
