const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../prix-dynamique.js');
const T = (s) => Date.parse(s + 'T12:00:00');
const NOW = T('2026-11-08');
const lot = (id, o) => Object.assign({ id, programme_id: 'P', statut: 'disponible', prix: 40000000, cout_revient: 0, surface: 100, created_at: '2025-01-01' }, o);
const vente = (id, jours, o) => Object.assign({ id, programme_id: 'P', date_souscription: new Date(NOW - jours * 86400000).toISOString().slice(0, 10) }, o);
const lead = (n, o) => Array.from({ length: n }, (_, i) => Object.assign({ id: 'l' + i, programme_id: 'P', stade: 'negociation' }, o));
const an = (o) => D.analyser({ now: NOW, programmes: [{ id: 'P', nom: 'P' }], lots: [], clients: [], leads: [], planchers: {}, ...o });
const pl = { P: { prix_moyen_min: 36000000, prix_moyen_actuel: 40000000, fiable: true } };

test('hausse : forte demande (ventes, stock court, prospects chauds) — arrondi inférieur, pas de dépassement du pas', () => {
  const r = an({ lots: [lot('a'), lot('b')], clients: [vente('v1', 10), vente('v2', 30), vente('v3', 60)], leads: lead(3) });
  const p = r.programmes[0]; assert.equal(p.action, 'hausse'); assert.equal(p.stock, 2); assert.equal(p.mois_stock, 2);
  assert.deepEqual(p.propositions.map(x => x.suggere), [42000000, 42000000]);               // 40 M +5 % = 42 M
  assert.equal(p.impact, 4000000); assert.equal(r.total.hausses, 1);
});

test('hausse refusée si la demande manque : peu de ventes ou pas de prospects chauds', () => {
  assert.equal(an({ lots: [lot('a')], clients: [vente('v1', 10), vente('v2', 30)], leads: lead(3) }).programmes[0].action, 'maintien');       // 2 ventes < 3
  assert.equal(an({ lots: [lot('a')], clients: [vente('v1', 10), vente('v2', 30), vente('v3', 60)], leads: [] }).programmes[0].action, 'maintien');
});

test('baisse : stock qui dort et peu de demande ; seulement les lots anciens ; jamais sous le plancher', () => {
  const lots = [lot('vieux', { cout_revient: 30000000 }), lot('neuf', { created_at: '2026-10-20' }), lot('v2')];
  const r = an({ lots, clients: [], leads: lead(0), planchers: pl });
  const p = r.programmes[0]; assert.equal(p.action, 'baisse'); assert.equal(p.sans_vente, true);
  const ids = p.propositions.map(x => x.lot.id); assert.deepEqual(ids.sort(), ['v2', 'vieux']);                // le lot récent n'est pas soldé
  const v = p.propositions.find(x => x.lot.id === 'vieux'); assert.equal(v.suggere, 38000000); assert.equal(v.source_plancher, 'cout_lot');   // 40 M −5 % = 38 M ≥ 30/0,85 = 35,3 M
  const w = p.propositions.find(x => x.lot.id === 'v2'); assert.equal(w.source_plancher, 'programme'); assert.equal(w.plancher, 36000000); assert.equal(w.suggere, 38000000);
  assert.ok(p.impact < 0);
});

test('plancher : la baisse s\'arrête au plancher, ou est bloquée si le plancher est atteint ou inconnu', () => {
  const serre = an({ lots: [lot('a', { cout_revient: 34000000 })], clients: [], leads: [] }).programmes[0];     // plancher 40 M : déjà au prix plancher
  assert.equal(serre.propositions[0].blocage, 'plancher'); assert.equal(serre.action, 'bloque');
  const inconnu = an({ lots: [lot('a')], clients: [], leads: [] }).programmes[0];                                // aucun coût, aucun plancher fiable
  assert.equal(inconnu.propositions[0].blocage, 'plancher_inconnu'); assert.equal(inconnu.action, 'bloque');
  const proche = an({ lots: [lot('a', { cout_revient: 31000000 })], clients: [], leads: [] }).programmes[0];     // plancher 36,47 M → 36,5 M au lieu de 38 M ? non : 38 M ≥ 36,5 M
  assert.equal(proche.propositions[0].suggere, 38000000);
  const limite = an({ lots: [lot('a', { cout_revient: 33000000 })], clients: [], leads: [] }).programmes[0];     // plancher 33 M / 0,85 = 38,82 M → 38,85 M (arrondi) : baisse limitée là, au lieu de 38 M
  assert.equal(limite.propositions[0].suggere, 38850000); assert.equal(limite.propositions[0].blocage, null);
  assert.equal(an({ lots: [lot('a')], clients: [], leads: [], planchers: { P: { prix_moyen_min: 36000000, prix_moyen_actuel: 40000000, fiable: false } } }).programmes[0].propositions[0].blocage, 'plancher_inconnu');
});

test('rythme normal : maintien ; aucun lot : aucun ; lots réservés ou vendus jamais touchés', () => {
  const r = an({ lots: [lot('a'), lot('r', { statut: 'reserve' }), lot('v', { statut: 'vendu' })], clients: [vente('v1', 10), vente('v2', 40), vente('v3', 70), vente('v4', 80)], leads: [] }).programmes[0];      // demande chaude absente : pas de hausse
  assert.equal(r.stock, 1); assert.equal(r.action, 'maintien'); assert.deepEqual(r.propositions, []);
  assert.equal(an({ lots: [lot('v', { statut: 'vendu' })] }).programmes[0].action, 'aucun');
});

test('tendance et mois de stock', () => {
  const r = an({ lots: [lot('a'), lot('b'), lot('c'), lot('d')], clients: [vente('v1', 10), vente('v2', 20), vente('v3', 100)] }).programmes[0];
  assert.equal(r.ventes_90j, 2); assert.equal(r.ventes_prec_90j, 1); assert.equal(r.tendance, 'hausse'); assert.equal(r.mois_stock, 6);
});

test('applique : historique tracé, prix_m2 recalé ; refuse un lot non disponible ou un prix déjà modifié', () => {
  const l = lot('a', { prix_mode: 'm2', prix_m2: 400000 }), prop = { prix: 40000000, suggere: 42000000, blocage: null };
  assert.deepEqual(D.appliquer(l, prop, NOW, 'Awa', 'forte demande'), { ok: true });
  assert.equal(l.prix, 42000000); assert.equal(l.prix_m2, 420000); assert.deepEqual(l.prix_historique[0], { date: '2026-11-08', ancien: 40000000, nouveau: 42000000, motif: 'forte demande', par: 'Awa' });
  assert.equal(D.appliquer(l, prop, NOW).raison, 'prix_modifie');
  assert.equal(D.appliquer(lot('r', { statut: 'reserve' }), prop, NOW).raison, 'lot_non_disponible');
  assert.equal(D.appliquer(lot('b'), { prix: 40000000, suggere: 38000000, blocage: 'plancher' }, NOW).raison, 'proposition_invalide');
});

test('réglages : pas plafonné à 20 %, valeurs invalides ramenées aux défauts', () => {
  assert.equal(D.cfg({ pas_pct: 50 }).pas_pct, 20); assert.equal(D.cfg({ pas_pct: -3 }).pas_pct, 5); assert.equal(D.cfg({ arrondi: 'x' }).arrondi, 50000);
});
