/* Portail souscripteur : le circuit de l'attestation de solde est visible dès le brouillon. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
const src = html.match(/function sAttSoldeSuivi\(\)\{[\s\S]*?\n  function sAttSoldeBtn/)[0].replace(/function sAttSoldeBtn$/, '');
const rendre = (client) => new Function('S', 'esc', 'dshort', src + '; return sAttSoldeSuivi();')({ client }, s => String(s), s => s);

test('rien sans attestation', () => assert.equal(rendre({}), ''));
test('brouillon : étape 1 en cours', () => {
  const o = rendre({ attestation_solde: { statut: 'brouillon', numero: 'AS-1' } });
  assert.match(o, /AS-1/); assert.equal((o.match(/class="now"/g) || []).length, 1); assert.equal((o.match(/class="fait"/g) || []).length, 0);
});
test('en attente : brouillon fait, validation en cours', () => {
  const o = rendre({ attestation_solde: { statut: 'en_attente', numero: 'AS-1', date_demande: '2026-10-01' } });
  assert.equal((o.match(/class="fait"/g) || []).length, 1); assert.match(o, /class="now"><span><\/span><div><b>En validation/);
});
test('validée non publiée puis publiée', () => {
  assert.match(rendre({ attestation_solde: { statut: 'valide', numero: 'A' } }), /prochainement/);
  assert.match(rendre({ attestation_solde: { statut: 'valide', publie_portail: true, numero: 'A' } }), /disponible ci-dessous/);
});
test('rejet : motif interne jamais exposé', () => {
  const o = rendre({ attestation_solde: { statut: 'rejete', numero: 'A', motif: 'SECRET' } });
  assert.ok(!/SECRET/.test(o)); assert.match(o, /À reprendre par la Direction/);
});
