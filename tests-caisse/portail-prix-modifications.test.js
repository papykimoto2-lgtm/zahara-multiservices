/* Portail souscripteur : bloc « Prix du bien et modifications » (lecture seule, mêmes règles que les attestations de solde). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright').chromium; }
const fs = require('fs');
const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const exe = process.env.CHROMIUM_PATH || (fs.existsSync(base) ? fs.readdirSync(base).filter(d => d.startsWith('chromium-')).sort().reverse().map(d => path.join(base, d, 'chrome-linux', 'chrome')).find(f => fs.existsSync(f)) : undefined);
let nav; after(async () => { if (nav) await nav.close(); });
async function ouvrir() {
  nav = nav || await chromium.launch({ executablePath: exe });
  const page = await (await nav.newContext()).newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await page.goto('file://' + path.resolve(__dirname, '..', 'portail-unique.html'));
  await page.waitForFunction(() => typeof sPrixModifs === 'function');
  return { page, erreurs };
}
const rendre = (page, client, versements) => page.evaluate(([c, v]) => { S.client = c; S.versements = v; return sPrixModifs(); }, [client, versements]);

test('prix initial, modifications, valeur finale, versé et reste', async () => {
  const { page, erreurs } = await ouvrir();
  const h = await rendre(page, { id: 'c1', montant_total: 30000000, demandes_modification: [{ date: '2026-03-01', description: 'Cuisine américaine', facture: true, montant_facture: 2000000 }, { date: '2026-04-01', description: 'Non facturée', facture: false, montant_facture: 999 }],
    regularisations_surface: [{ date: '2026-05-01', ecart_m2: 2, prix_m2: 500000, montant: 1000000 }] },
  [{ montant: 20000000, type: 'versement' }, { montant: 500000, type: 'frais_souscription' }, { montant: 1000000, statut: 'annule' }]);
  assert.match(h, /Prix initial du bien[\s\S]*27[\s ]000[\s ]000 FCFA/); assert.match(h, /Cuisine américaine/); assert.doesNotMatch(h, /Non facturée/);
  assert.match(h, /Écart de surface de 2 m²/); assert.match(h, /Valeur finale du bien[\s\S]*30[\s ]000[\s ]000 FCFA/);
  assert.match(h, /Total versé[\s\S]*20[\s ]000[\s ]000 FCFA/); assert.match(h, /Reste à payer[\s\S]*10[\s ]000[\s ]000 FCFA/);
  assert.deepEqual(erreurs, []);
});

test('sans modification : pas de valeur finale ; soldé ; sans montant : rien', async () => {
  const { page } = await ouvrir();
  const a = await rendre(page, { id: 'c1', montant_total: 27000000 }, [{ montant: 27000000 }]);
  assert.match(a, /Prix initial du bien/); assert.doesNotMatch(a, /Valeur finale/); assert.match(a, /soldé ✓/); assert.match(a, /Aucune modification facturée/);
  assert.equal(await rendre(page, { id: 'c1' }, []), '');
});

test('données incohérentes (modifications ≥ contrat) : aucune décomposition inventée', async () => {
  const { page } = await ouvrir();
  const h = await rendre(page, { id: 'c1', montant_total: 1000000, demandes_modification: [{ facture: true, montant_facture: 5000000, description: 'X' }] }, []);
  assert.doesNotMatch(h, /Valeur finale/); assert.match(h, /1[\s ]000[\s ]000 FCFA/);
});

test('échappement HTML des libellés', async () => {
  const { page } = await ouvrir();
  const h = await rendre(page, { id: 'c1', montant_total: 5000000, demandes_modification: [{ facture: true, montant_facture: 100000, description: '<img src=x onerror=alert(1)>' }] }, []);
  assert.doesNotMatch(h, /<img/); assert.match(h, /&lt;img/);
});

test('espace notaire : liste des attestations transmises, échappée ; rien si aucune', async () => {
  const { page, erreurs } = await ouvrir();
  const r = await page.evaluate(() => {
    INT.attestations = []; var vide = _intAttestationsHtml();
    INT.attestations = [{ souscripteur: '<b>BENDE</b>', dossier: 'D-1', kind: 'finale', numero: 'ATF-1', date: '2026-10-14', html: '<p>x</p>' }, { souscripteur: 'KONE', dossier: 'D-2', kind: 'initial', numero: 'ATS-2', html: '<p>y</p>' }];
    return { vide: vide, h: _intAttestationsHtml() };
  });
  assert.equal(r.vide, ''); assert.doesNotMatch(r.h, /<b>BENDE/); assert.match(r.h, /&lt;b&gt;BENDE/); assert.match(r.h, /Valeur finale · N° ATF-1 · validée le 14\/10\/2026/); assert.match(r.h, /Prix initial · N° ATS-2/);
  assert.equal((r.h.match(/intOuvrirAttestation/g) || []).length, 2); assert.deepEqual(erreurs, []);
});
