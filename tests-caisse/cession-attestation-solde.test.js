/* Cession foncière : attestation de solde — brouillon auto, circuit DG, publication portail acquéreur. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, soldee) {
  return page.evaluate((soldee) => {
    window.userPeutSurStore = () => true; window.syncToSupabase = () => {};
    APP.currentUser = { id: 'u1', nom: 'Directeur Test', role: 'admin' };
    DATA.validations = []; DATA.params = Object.assign({}, DATA.params, { societe: 'MENKO TEST' });
    DATA.cessions_foncieres = [{ id: 'k1', date: '2026-09-01', dossier: 'CF-001', designation: 'Lot 12', acquereur: 'Koné Aminata', acheteur: { type: 'physique', nom: 'Koné', prenoms: 'Aminata' },
      prix_cession: 5000000, montant_encaisse: soldee ? 5000000 : 2000000, statut: soldee ? 'soldee' : 'cedee', paiements: [{ id: 'p1', date: '2026-09-01', montant: 2000000, mode: 'virement', ref: 'V1' }, { id: 'p2', date: '2026-10-01', montant: soldee ? 3000000 : 0, mode: 'virement', ref: 'V2' }] }];
    return true;
  }, soldee);
}

test('non soldée : aucun brouillon', async () => {
  const app = await ouvrirApp(); await preparer(app.page, false);
  const r = await app.page.evaluate(() => { cesRender(); return DATA.cessions_foncieres[0].attestation_solde || null; });
  assert.equal(r, null);
});

test('soldée : brouillon auto, circuit DG, document figé et publication', async () => {
  const app = await ouvrirApp(); await preparer(app.page, true);
  const b = await app.page.evaluate(() => { cesRender(); return DATA.cessions_foncieres[0].attestation_solde; });
  assert.equal(b.statut, 'brouillon'); assert.match(b.numero, /^ACS-\d{4}-0001$/);

  const apercu = await app.page.evaluate(() => cesAttHtml(DATA.cessions_foncieres[0], { numero: 'ACS-X', projet: true }));
  assert.match(apercu, /PROJET — NON VALIDÉ/); assert.match(apercu, /5[\s\u202f\u00a0]000[\s\u202f\u00a0]000/); assert.match(apercu, /Koné/);

  await app.page.evaluate(() => cesAttDemander('k1'));
  const e = await app.page.evaluate(() => ({ st: DATA.cessions_foncieres[0].attestation_solde.statut, v: DATA.validations.map(v => v.type + ':' + v.statut) }));
  assert.equal(e.st, 'en_attente'); assert.deepEqual(e.v, ['attestation_solde_cession:en_attente']);

  await app.page.evaluate(async () => valDecide(DATA.validations[0].id, 'valide'));
  const v = await app.page.evaluate(() => DATA.cessions_foncieres[0].attestation_solde);
  assert.equal(v.statut, 'valide'); assert.ok(v.html && !/PROJET — NON VALIDÉ/.test(v.html)); assert.equal(v.valide_par, 'Directeur Test');

  await app.page.evaluate(() => cesAttPublier('k1', true));
  assert.equal(await app.page.evaluate(() => DATA.cessions_foncieres[0].attestation_solde.publie_portail), true);

  await app.page.evaluate(() => { window.prompt = () => 'Erreur de montant'; return cesAttAnnulerValidation('k1'); });
  const an = await app.page.evaluate(() => DATA.cessions_foncieres[0].attestation_solde);
  assert.equal(an.statut, 'brouillon'); assert.equal(an.publie_portail, false); assert.equal(an.html, undefined); assert.equal(an.annulations.length, 1);
});

test('rejet : motif conservé côté ERP ; versement supprimé retire le brouillon', async () => {
  const app = await ouvrirApp(); await preparer(app.page, true);
  await app.page.evaluate(async () => { cesRender(); await cesAttDemander('k1'); window.prompt = () => 'Pièce manquante'; });
  await app.page.evaluate(() => valDecide(DATA.validations[0].id, 'rejete', 'Pièce manquante'));
  const r = await app.page.evaluate(() => DATA.cessions_foncieres[0].attestation_solde);
  assert.equal(r.statut, 'rejete'); assert.equal(r.motif, 'Pièce manquante');
  await preparer(app.page, true);
  const g = await app.page.evaluate(() => { cesRender(); const c = DATA.cessions_foncieres[0]; c.montant_encaisse = 2000000; c.paiements.pop(); c.statut = 'cedee'; cesRender(); return !!c.attestation_solde; });
  assert.equal(g, false);
});

test('portail : carte circuit, motif jamais exposé, document seulement si publié', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
  const src = html.match(/function fonAttCarte\(c\)\{[\s\S]*?\n  function rendreFoncier/)[0].replace(/function rendreFoncier$/, '');
  const rendre = (c) => new Function('esc', 'dshort', src + '; return fonAttCarte;')(s => String(s), s => s)(c);
  assert.equal(rendre({}), '');
  assert.equal((rendre({ attestation_solde: { statut: 'brouillon', numero: 'ACS-1' } }).match(/class="now"/g) || []).length, 1);
  assert.ok(!/SECRET/.test(rendre({ attestation_solde: { statut: 'rejete', motif: 'SECRET' } })));
  assert.ok(!/fonOuvrirAttestation\(\)"/.test(rendre({ attestation_solde: { statut: 'valide', html: '<p>x</p>' } })));
  assert.match(rendre({ attestation_solde: { statut: 'valide', publie_portail: true, html: '<p>x</p>' } }), /fonOuvrirAttestation\(\)/);
});
