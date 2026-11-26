const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('../wa-relances.js');
const d = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };

test('échéances : jour du mois, plafonné en fin de mois', () => {
  const e = W.echeances('2026-01-31', d('2026-02-27'));
  assert.equal(e.joursAvant, 1);                      // 28 fév (plafonné)
  assert.equal(e.joursDepuis, 27);                    // depuis le 31 janv
  const f = W.echeances('2026-03-15', d('2026-03-15'));
  assert.equal(f.joursDepuis, 0);
});

test('paliers en retard : J0, J3, J10', () => {
  const base = { ancre: '2026-01-10', ecart: 100000, moisRetard: 1 };
  assert.equal(W.palierDuJour({ ...base, now: d('2026-05-10') }).palier, 'J0');
  assert.equal(W.palierDuJour({ ...base, now: d('2026-05-12') }).palier, 'J0');
  assert.equal(W.palierDuJour({ ...base, now: d('2026-05-13') }).palier, 'J3');
  assert.equal(W.palierDuJour({ ...base, now: d('2026-05-19') }).palier, 'J3');
  const r = W.palierDuJour({ ...base, now: d('2026-05-20') });
  assert.equal(r.palier, 'J10'); assert.equal(r.cycle, '2026-05-10'); assert.equal(r.montant, 100000);
});

test('J-3 : à jour mais en retard à la prochaine échéance', () => {
  const p = { ancre: '2026-01-10', ecart: 0, ecartAvenir: 50000, mensualite: 50000 };
  assert.equal(W.palierDuJour({ ...p, now: d('2026-05-07') }).palier, 'J-3');
  assert.equal(W.palierDuJour({ ...p, now: d('2026-05-07') }).cycle, '2026-05-10');
  assert.equal(W.palierDuJour({ ...p, now: d('2026-05-06') }).palier, null);   // trop tôt
  assert.equal(W.palierDuJour({ ...p, now: d('2026-05-10') }).palier, null);   // jour J : plus de J-3
  assert.equal(W.palierDuJour({ ...p, ecartAvenir: 0, now: d('2026-05-07') }).palier, null); // en avance
});

test('≥ 3 mois : aucun envoi automatique', () => {
  const r = W.palierDuJour({ ancre: '2026-01-10', now: d('2026-05-20'), ecart: 300000, moisRetard: 3 });
  assert.equal(r.palier, null); assert.equal(r.raison, 'escalade_humaine');
});

test('téléphones', () => {
  assert.equal(W.normaliserTel('07 12 34 56 78'), '2250712345678');
  assert.equal(W.normaliserTel('+225 07 12 34 56 78'), '2250712345678');
  assert.equal(W.normaliserTel('+33612345678'), '33612345678');
  assert.equal(W.normaliserTel('0712'), '');
  assert.equal(W.normaliserTel('abc'), '');
});

test('file : doublon, désinscrit, téléphone invalide', () => {
  const now = d('2026-05-20');
  const e = (id, tel) => ({ client_id: id, nom: 'N', prenom: 'P', tel, dossier: 'D', ancre: '2026-01-10', ecart: 80000, moisRetard: 1 });
  const deja = { [W.cle('a', '2026-05-10', 'J10')]: true };
  const optout = { '2250799999999': true };
  const { file, ignores } = W.construireFile([e('a', '0711111111'), e('b', '0799999999'), e('c', '12'), e('d', '0722222222')], deja, optout, now);
  assert.deepEqual(file.map(x => x.client_id), ['d']);
  assert.deepEqual(ignores.map(x => x.raison).sort(), ['deja_envoye', 'desinscrit', 'telephone_invalide']);
});

test('texte : variables et mention STOP', () => {
  const t = W.rendreTexte('J0', { prenom: 'Awa', montant: W.formatMontant(150000), dossier: 'Lot 12', lien: 'https://x', societe: 'Zahara' });
  assert.match(t, /Awa/); assert.match(t, /150.000 FCFA/); assert.match(t, /STOP/); assert.doesNotMatch(t, /\{/);
});
