const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../apporteurs-rang.js');
const T = (s) => Date.parse(s + 'T12:00:00');
const NOW = T('2026-11-08');
const ap = (id, o) => Object.assign({ id, nom: id, statut: 'actif', date_contrat: '2026-01-01', date_expiration: '2027-06-01', non_contournement: 'signe' }, o);
const cl = (id, a, o) => Object.assign({ id, apporteur_id: a, montant_total: 10000000, date_souscription: '2026-10-01' }, o);
const vr = (c, m, d, o) => Object.assign({ client_id: c, montant: m, date: d || '2026-10-15', statut: 'valide', type: 'mensualite' }, o);
const per = { debut: T('2026-08-01'), fin: T('2026-11-08') };

test('classement par argent encaissé, pas par nombre de ventes', () => {
  const r = A.analyser({ now: NOW, periode: per, apporteurs: [ap('A'), ap('B')],
    clients: [cl('c1', 'A'), cl('c2', 'A'), cl('c3', 'A'), cl('c4', 'B')],
    versements: [vr('c1', 100000), vr('c2', 100000), vr('c3', 100000), vr('c4', 2000000)] });
  assert.deepEqual(r.classes.map(x => x.id), ['B', 'A']);
  assert.equal(r.classes[0].rang, 1); assert.equal(r.classes[1].ventes_n, 3);
  assert.ok(Math.abs(r.classes[1].part_cumulee - 1) < 1e-9);
});

test('frais de souscription et versements annulés ne comptent pas ; hors période ignoré', () => {
  const r = A.analyser({ now: NOW, periode: per, apporteurs: [ap('A')], clients: [cl('c1', 'A')],
    versements: [vr('c1', 500000, null, { type: 'frais_souscription' }), vr('c1', 400000, null, { statut: 'annule' }), vr('c1', 300000, '2025-01-01'), vr('c1', 250000)] });
  assert.equal(r.classes[0].encaisse, 250000);
});

test('résilié : pas compté en vente mais en résiliation', () => {
  const r = A.analyser({ now: NOW, periode: per, apporteurs: [ap('A')], clients: [cl('c1', 'A'), cl('c2', 'A', { statut: 'resilie' })], versements: [vr('c1', 1)] });
  assert.equal(r.classes[0].ventes_n, 1); assert.equal(r.classes[0].resilies_n, 1);
});

test('qualité : retard ≥ 40 % avec ≥ 3 clients signalé, pas en dessous de 3 clients', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => cl('k' + i, 'A'));
  const r3 = A.analyser({ now: NOW, periode: per, apporteurs: [ap('A')], clients: mk(3), versements: [vr('k0', 1)], enRetard: { k0: true, k1: true } });
  assert.ok(r3.classes[0].tags.some(t => t.k === 'qualite'));
  const r2 = A.analyser({ now: NOW, periode: per, apporteurs: [ap('A')], clients: mk(2), versements: [vr('k0', 1)], enRetard: { k0: true, k1: true } });
  assert.ok(!r2.classes[0].tags.some(t => t.k === 'qualite'));
});

test('soldé en retard apparent : non compté en retard', () => {
  const r = A.analyser({ now: NOW, periode: per, apporteurs: [ap('A')], clients: [cl('a', 'A'), cl('b', 'A'), cl('c', 'A')], versements: [vr('a', 1)], enRetard: { a: true, b: true }, soldes: { a: true } });
  assert.equal(r.classes[0].retard_n, 1);
});

test('dormant, jamais vendu, contrat expiré / bientôt, non-contournement', () => {
  const r = A.analyser({ now: NOW, periode: per, apporteurs: [
      ap('D'), ap('J'), ap('E', { date_expiration: '2026-10-01' }), ap('S', { date_expiration: '2026-12-15' }), ap('N', { non_contournement: 'en_attente' })],
    clients: [cl('d1', 'D', { date_souscription: '2026-05-01' }), cl('n1', 'N')], versements: [] });
  const tags = (id) => [...r.classes, ...r.autres].find(x => x.id === id).tags.map(t => t.k);
  assert.ok(tags('D').includes('dormant')); assert.ok(tags('J').includes('jamais'));
  assert.ok(tags('E').includes('contrat')); assert.ok(tags('S').includes('contrat')); assert.ok(tags('N').includes('nc'));
  assert.equal(r.nb_dormants, 1);
});

test('apporteur suspendu : jamais classé, signalé', () => {
  const r = A.analyser({ now: NOW, periode: per, apporteurs: [ap('A'), ap('X', { statut: 'suspendu' })], clients: [cl('c1', 'A'), cl('c2', 'X')], versements: [vr('c1', 10), vr('c2', 999)] });
  assert.deepEqual(r.classes.map(x => x.id), ['A']);
  assert.ok(r.autres[0].tags.some(t => t.k === 'inactif'));
});

test('commissions : coût en % de l\'encaissé, dues hors annulées, rattachement par client', () => {
  const r = A.analyser({ now: NOW, periode: per, apporteurs: [ap('A')], clients: [cl('c1', 'A')], versements: [vr('c1', 1000000)],
    commissions: [{ type_beneficiaire: 'apporteur', apporteur_id: 'A', montant_comm: 100000, statut: 'a_payer', date_versement: '2026-10-15' },
      { type_beneficiaire: 'apporteur', client_id: 'c1', montant_comm: 50000, statut: 'payee', date_versement: '2026-10-16' },
      { type_beneficiaire: 'apporteur', apporteur_id: 'A', montant_comm: 999999, statut: 'annulee', date_versement: '2026-10-16' },
      { type_beneficiaire: 'commercial', apporteur_id: 'A', montant_comm: 777777, statut: 'a_payer', date_versement: '2026-10-16' }] });
  assert.equal(r.classes[0].cout_pct, 15); assert.equal(r.classes[0].commission_due, 100000); assert.equal(r.commission_due_totale, 100000);
});

test('paliers de reconnaissance sur 12 mois et part du réseau', () => {
  assert.equal(A.palierDe(0), null); assert.equal(A.palierDe(1), 'Bronze'); assert.equal(A.palierDe(5), 'Argent'); assert.equal(A.palierDe(12), 'Platine');
  const r = A.analyser({ now: NOW, periode: per, apporteurs: [ap('A')], clients: [cl('c1', 'A'), cl('c2', null)], versements: [vr('c1', 1)] });
  assert.equal(r.part_reseau, 50); assert.equal(r.classes[0].palier, 'Bronze');
});

test('message de relance adapté', () => {
  const r = A.analyser({ now: NOW, periode: per, apporteurs: [ap('D', { prenoms: 'Awa' })], clients: [cl('d1', 'D', { date_souscription: '2026-05-01' })], versements: [] });
  assert.match(A.messageRelance(r.autres[0] || r.classes[0], 'Zahara'), /Awa/);
});
