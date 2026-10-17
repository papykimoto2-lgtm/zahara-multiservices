/* Portail partenaire financier : circuit solde → validation DG → délivrance des documents. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
const src = html.match(/function fiCircuitDocs\(p,solde\)\{[\s\S]*?\n  function rendreFinancier/)[0].replace(/function rendreFinancier$/, '');
const rendre = (p, solde) => new Function('esc', 'dshort', src + '; return fiCircuitDocs;')(s => String(s), s => s)(p, solde);

test('non soldé : étape 1 en cours, rien de délivré', () => {
  const o = rendre({}, false);
  assert.equal((o.match(/class="now"/g) || []).length, 1); assert.equal((o.match(/class="fait"/g) || []).length, 0);
  assert.match(o, /Brouillon dès que/);
});
test('soldé, sans validation : validation en cours', () => {
  const o = rendre({}, true);
  assert.equal((o.match(/class="fait"/g) || []).length, 1); assert.match(o, /class="now"><span><\/span><div><b>Validation de la Direction/); assert.equal((o.match(/Brouillon prêt/g) || []).length, 3);
});
test('validé : documents à délivrer', () => {
  const o = rendre({ dg_valide: true, dg_valide_date: '2026-10-01' }, true);
  assert.equal((o.match(/À délivrer par la Direction/g) || []).length, 3);
});
test('cession délivrée : date affichée', () => {
  const o = rendre({ dg_valide: true, attestation_emise: true, date_attestation: '2026-10-05', docs_etat: { contrat_reservation: { etat: 'delivre', date: '2026-10-02' } } }, true);
  assert.match(o, /Délivré le 2026-10-05/); assert.match(o, /Délivré le 2026-10-02/); assert.equal((o.match(/À délivrer/g) || []).length, 1);
});
