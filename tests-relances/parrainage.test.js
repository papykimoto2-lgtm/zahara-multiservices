const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../parrainage.js');
const NOW = Date.parse('2026-11-08T12:00:00');
const cl = (id, o) => Object.assign({ id, nom: id, prenoms: '', tel: '07' + String(id.length).padStart(2, '0') + id.charCodeAt(0).toString().padStart(6, '0'), montant_total: 10000000, date_souscription: '2026-09-01' }, o);
const vr = (c, m, o) => Object.assign({ client_id: c, montant: m, statut: 'valide', type: 'mensualite' }, o);
const params = { actif: true, montant: 100000, seuil_pct: 10 };
const an = (o) => R.analyser({ params, now: NOW, clients: [], leads: [], versements: [], ...o });
const etat = (r, key) => r.liens.find(l => l.key === key).etat;

test('prospect parrainé : en cours, puis perdu', () => {
  const P = cl('P'), l = { id: 'l1', nom: 'Awa', tel: '0711111111', parrain_id: 'P', created_at: '2026-10-01' };
  assert.equal(etat(an({ clients: [P], leads: [l] }), 'lead:l1'), 'prospect');
  assert.equal(etat(an({ clients: [P], leads: [{ ...l, statut: 'perdu' }] }), 'lead:l1'), 'perdu');
});

test('lead converti : relié au souscripteur par le téléphone, en attente tant que le seuil n\'est pas versé', () => {
  const P = cl('P'), F = cl('F', { tel: '+225 07 11 11 11 11' }), l = { id: 'l1', nom: 'Awa', tel: '0711111111', parrain_id: 'P', created_at: '2026-10-01' };
  const r = an({ clients: [P, F], leads: [l], versements: [vr('F', 500000)] });            // 5 % < 10 %
  assert.equal(r.liens.length, 1); assert.equal(r.liens[0].key, 'client:F'); assert.equal(r.liens[0].etat, 'attente_versement');
  assert.equal(r.a_creer.length, 0);
});

test('seuil versé : récompense éligible, proposée mais jamais créée toute seule', () => {
  const P = cl('P'), F = cl('F', { parrain_id: 'P' });
  const r = an({ clients: [P, F], versements: [vr('F', 1000000)] });                         // 10 %
  assert.equal(etat(r, 'client:F'), 'eligible'); assert.deepEqual(r.a_creer, [{ parrain_id: 'P', filleul_key: 'client:F', filleul_nom: 'F', montant: 100000, type: 'prime' }]);
  assert.equal(P.parrainage_recompenses, undefined);
});

test('frais de souscription et versements annulés ne déclenchent rien', () => {
  const P = cl('P'), F = cl('F', { parrain_id: 'P' });
  assert.equal(etat(an({ clients: [P, F], versements: [vr('F', 5000000, { type: 'frais_souscription' }), vr('F', 5000000, { statut: 'annule' })] }), 'client:F'), 'attente_versement');
});

test('journal : due, versée, annulée ; pas de doublon de récompense', () => {
  const F = cl('F', { parrain_id: 'P' }), v = [vr('F', 2000000)];
  const mk = (statut) => cl('P', { parrainage_recompenses: [{ id: 'r', parrain_id: 'P', filleul_key: 'client:F', montant: 100000, statut }] });
  assert.equal(etat(an({ clients: [mk('due'), F], versements: v }), 'client:F'), 'due');
  assert.equal(etat(an({ clients: [mk('versee'), F], versements: v }), 'client:F'), 'versee');
  const r = an({ clients: [mk('annulee'), F], versements: v }); assert.equal(etat(r, 'client:F'), 'annulee'); assert.equal(r.a_creer.length, 0);
  assert.equal(an({ clients: [mk('due'), F], versements: v }).a_creer.length, 0);
});

test('anti-abus : auto-parrainage (même fiche ou même téléphone), parrain résilié ou en retard, filleul résilié', () => {
  const P = cl('P', { tel: '0700000001' }), v = [vr('F', 2000000), vr('P', 2000000)];
  assert.equal(etat(an({ clients: [P], versements: v, leads: [{ id: 'l', nom: 'x', tel: '0700000001', parrain_id: 'P' }] }), 'client:P'), 'refuse_auto');
  const F2 = cl('F', { parrain_id: 'P', tel: '0700000001' }); assert.equal(etat(an({ clients: [P, F2], versements: v }), 'client:F'), 'refuse_auto');
  const F = cl('F', { parrain_id: 'P', tel: '0799999999' });
  assert.equal(etat(an({ clients: [{ ...P, statut: 'resilie' }, F], versements: v }), 'client:F'), 'refuse_parrain');
  assert.equal(etat(an({ clients: [P, F], versements: v, enRetard: { P: true } }), 'client:F'), 'bloque_retard');
  assert.equal(etat(an({ clients: [P, F], versements: v, enRetard: { P: true }, params: { ...params, exige_a_jour: false } }), 'client:F'), 'eligible');
  assert.equal(etat(an({ clients: [P, { ...F, statut: 'resilie' }], versements: v }), 'client:F'), 'annulee_resilie');
});

test('plafond par parrain : les plus anciens d\'abord', () => {
  const P = cl('P'), F1 = cl('F1', { parrain_id: 'P', tel: '0711111111', date_souscription: '2026-08-01' }), F2 = cl('F2', { parrain_id: 'P', tel: '0722222222', date_souscription: '2026-09-01' });
  const r = an({ clients: [P, F1, F2], versements: [vr('F1', 2000000), vr('F2', 2000000)], params: { ...params, plafond: 1 } });
  assert.equal(etat(r, 'client:F1'), 'eligible'); assert.equal(etat(r, 'client:F2'), 'plafond');
});

test('classement des parrains : souscrits, valeur, coût en % des contrats', () => {
  const P = cl('P', { parrainage_recompenses: [{ id: 'r', parrain_id: 'P', filleul_key: 'client:F', montant: 100000, statut: 'versee' }] });
  const F = cl('F', { parrain_id: 'P', montant_total: 10000000 });
  const r = an({ clients: [P, F], versements: [vr('F', 2000000)] });
  assert.equal(r.classement[0].souscrits, 1); assert.equal(r.classement[0].valeur, 10000000); assert.equal(r.classement[0].versee, 100000); assert.equal(r.classement[0].cout_pct, 1);
  assert.equal(r.totaux.versee, 100000);
});

test('ambassadeurs : satisfaits (soldés ou ≥ 50 %), à jour, pas sollicités depuis 90 j', () => {
  const A = cl('A'), B = cl('B', { tel: '0722222222' }), C = cl('C', { tel: '0733333333' }), D = cl('D', { tel: '0744444444', parrainage_demandes: [{ date: '2026-10-20' }] }), E = cl('E', { tel: '0755555555' });
  const v = [vr('A', 10000000), vr('B', 6000000), vr('C', 2000000), vr('D', 10000000), vr('E', 9000000)];
  const r = an({ clients: [A, B, C, D, E], versements: v, enRetard: { E: true } });
  assert.deepEqual(r.ambassadeurs.map(x => x.client.id), ['A', 'B']);                           // soldé d'abord ; C < 50 % ; D sollicité ; E en retard
});

test('message de demande : l\'offre n\'apparaît que si le programme est actif', () => {
  const c = cl('A', { prenoms: 'Awa' });
  assert.match(R.messageDemande(c, R.cfg({ actif: true, montant: 150000 }), 'Zahara'), /150 000 FCFA/);
  assert.doesNotMatch(R.messageDemande(c, R.cfg({ actif: false }), 'Zahara'), /FCFA/);
});
