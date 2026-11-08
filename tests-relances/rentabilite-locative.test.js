const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../rentabilite-locative.js');
const T = (s) => Date.parse(s + 'T12:00:00');
const NOW = T('2026-11-08');
const bien = (id, o) => Object.assign({ id, designation: id, loyer: 300000, surface: 60, commune: 'Cocody', type: 'appartement', created_at: '2024-01-01' }, o);
const bail = (id, bienId, o) => Object.assign({ id, bien_id: bienId, statut: 'actif', loyer: 300000, debut: '2025-01-01', fin: '2027-01-01', derniere_revision: '2026-06-01' }, o);
const an = (o) => R.analyser({ now: NOW, biens: [], baux: [], quittances: [], travaux: [], ...o });
const alerte = (r, k) => r.alertes.filter(a => a.k === k);

test('occupation : union des baux sur 12 mois, chevauchement non compté deux fois', () => {
  const d0 = T('2025-11-08'), baux = [bail('a', 'b', { debut: '2025-11-08', statut: 'resilie', date_resiliation: '2026-02-06' }), bail('b', 'b', { debut: '2026-01-01', statut: 'resilie', date_resiliation: '2026-03-02' })];
  assert.equal(R.joursOccupes(baux, d0, NOW, NOW), 114);          // 8 nov 2025 → 2 mars 2026
  assert.equal(R.joursOccupes([bail('c', 'b', { debut: '2020-01-01' })], d0, NOW, NOW), 365);
});

test('vacance courante : depuis la fin du dernier bail ; perte chiffrée ; alerte rouge à 90 j', () => {
  const r = an({ biens: [bien('B')], baux: [bail('a', 'B', { statut: 'resilie', debut: '2025-01-01', date_resiliation: '2026-07-10' })] });
  const l = r.biens[0]; assert.equal(l.statut, 'vacant'); assert.equal(l.vacance_courante, 121);
  const a = alerte(r, 'vacance')[0]; assert.equal(a.niveau, 'rouge'); assert.equal(a.montant, Math.round(300000 * 121 / 30.4375));
  assert.equal(r.total.perte_mensuelle, 300000);
  assert.equal(alerte(an({ biens: [bien('B')], baux: [bail('a', 'B', { statut: 'resilie', date_resiliation: '2026-10-20' })] }), 'vacance').length, 0);   // 19 j : sous le seuil
});

test('bien jamais loué : vacance depuis la mise en disponibilité ; bien en travaux ou retiré exclu', () => {
  const r = an({ biens: [bien('N', { disponible_le: '2026-09-01' }), bien('T', { statut: 'travaux' }), bien('X', { statut: 'retire' })] });
  assert.equal(r.biens.find(l => l.bien.id === 'N').vacance_courante, 68);
  assert.equal(r.biens.length, 2); assert.equal(r.total.biens, 1);
  assert.equal(alerte(r, 'vacance').every(a => a.bien_id === 'N'), true);
});

test('recouvrement : alerte si ≥ 3 quittances et taux sous le seuil', () => {
  const q = (p, regle) => ({ bail_id: 'a', periode: p, loyer: 300000, total: 330000, regle });
  const faible = an({ biens: [bien('B')], baux: [bail('a', 'B')], quittances: [q('2026-08', 0), q('2026-09', 100000), q('2026-10', 100000)] });
  assert.equal(alerte(faible, 'recouvrement').length, 1); assert.equal(faible.biens[0].taux_recouvrement, 20.2);
  const bon = an({ biens: [bien('B')], baux: [bail('a', 'B')], quittances: [q('2026-08', 330000), q('2026-09', 330000), q('2026-10', 330000)] });
  assert.equal(alerte(bon, 'recouvrement').length, 0);
  assert.equal(alerte(an({ biens: [bien('B')], baux: [bail('a', 'B')], quittances: [q('2026-10', 0), q('2026-09', 0)] }), 'recouvrement').length, 0);   // 2 quittances : non concluant
});

test('entretien : travaux terminés des 12 mois / loyers encaissés ; imputation « nous » comptée à part', () => {
  const q = [1, 2, 3, 4, 5, 6].map(m => ({ bail_id: 'a', periode: '2026-0' + m, loyer: 300000, total: 300000, regle: 300000 }));
  const travaux = [{ bail_id: 'a', statut: 'termine', cout_reel: 400000, date_fin: '2026-05-01', imputation: 'proprietaire' }, { bail_id: 'a', statut: 'facture', cout_reel: 200000, date_fin: '2026-06-01', imputation: 'promoteur' },
    { bail_id: 'a', statut: 'brouillon', cout_reel: 9999999, date_fin: '2026-06-01' }, { bail_id: 'a', statut: 'termine', cout_reel: 9999999, date_fin: '2024-06-01' }];
  const r = an({ biens: [bien('B')], baux: [bail('a', 'B')], quittances: q, travaux });
  const l = r.biens[0]; assert.equal(l.travaux_total, 600000); assert.equal(l.travaux_nous, 200000);
  const a = alerte(r, 'entretien')[0]; assert.equal(a.montant, 600000); assert.equal(a.niveau, 'rouge');      // 600 000 / 1 800 000 = 33 % > 30 %
});

test('sous-location : loyer/m² sous la médiane du parc (≥ 3 comparables), gain annuel chiffré', () => {
  const bs = [bien('A', { loyer: 300000 }), bien('B', { loyer: 330000 }), bien('C', { loyer: 360000 }), bien('D', { loyer: 200000 })];   // 5000, 5500, 6000, 3333 /m²
  const baux = bs.map(b => bail('x' + b.id, b.id, { loyer: b.loyer }));
  const r = an({ biens: bs, baux });
  const a = alerte(r, 'sous_loue'); assert.equal(a.length, 1); assert.equal(a[0].bien_id, 'D');
  assert.equal(a[0].montant, Math.round((5250 * 60 - 200000) * 12));            // médiane 5250
  assert.equal(an({ biens: bs.slice(0, 2), baux: baux.slice(0, 2) }).alertes.filter(x => x.k === 'sous_loue').length, 0);
});

test('fin de bail proche et révision due ; gain seulement si le taux est saisi', () => {
  const b = bail('a', 'B', { fin: '2027-01-15', derniere_revision: '2025-09-01' });
  const sans = an({ biens: [bien('B')], baux: [b] });
  assert.equal(alerte(sans, 'fin_proche').length, 1); assert.equal(alerte(sans, 'fin_proche')[0].montant, null);
  assert.equal(alerte(sans, 'revision')[0].montant, null); assert.match(alerte(sans, 'revision')[0].texte, /Saisissez le taux/);
  const avec = an({ biens: [bien('B')], baux: [b], params: { taux_revision_pct: 3 } });
  assert.equal(alerte(avec, 'revision')[0].montant, Math.round(300000 * 0.03 * 12));
  assert.equal(alerte(an({ biens: [bien('B')], baux: [bail('a', 'B', { fin: '2027-09-01', derniere_revision: '2026-06-01' })] }), 'revision').length, 0);
});

test('tri : rouge d\'abord, puis montant ; totaux du parc', () => {
  const r = an({ biens: [bien('V1', { created_at: '2026-01-01', disponible_le: '2026-10-01' }), bien('V2', { loyer: 800000, disponible_le: '2026-05-01' }), bien('L', {})], baux: [bail('a', 'L')] });
  assert.equal(r.alertes[0].niveau, 'rouge'); assert.equal(r.alertes[0].bien_id, 'V2');
  assert.equal(r.total.biens, 3); assert.equal(r.total.loues, 1); assert.equal(r.total.vacants, 2); assert.equal(r.total.occupation_pct, 33.3);
  assert.equal(r.total.perte_mensuelle, 1100000);
});
