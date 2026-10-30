/* Références séquentielles par liste : numéro = plus grand numéro attribué + 1, jamais « nombre d'éléments + 1 ». */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('prochaineRefListe ne réattribue pas un numéro après suppression', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    var l = [{ ref: 'KYC-0001' }, { ref: 'KYC-0003' }];
    return {
      vide: prochaineRefListe([], 'KYC-', 4),
      trou: prochaineRefListe(l, 'KYC-', 4),
      autrePrefixe: prochaineRefListe([{ ref: 'JUR-CV-0007' }], 'JUR-LOC-', 4),
      mois: prochaineRefListe([{ ref: 'QUIT-202610-0002' }, { ref: 'QUIT-202609-0009' }], 'QUIT-202610-', 4),
      sansRef: prochaineRefListe([{}, null, { ref: 'BIEN-002' }], 'BIEN-', 3)
    };
  });
  assert.equal(r.vide, 'KYC-0001');
  assert.equal(r.trou, 'KYC-0004');
  assert.equal(r.autrePrefixe, 'JUR-LOC-0001');
  assert.equal(r.mois, 'QUIT-202610-0003');
  assert.equal(r.sansRef, 'BIEN-003');
});

test('une fiche KYC créée après suppression garde une référence unique', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    DATA.kyc_fiches = [{ id: 'a', ref: 'KYC-0001' }, { id: 'c', ref: 'KYC-0003' }];
    return prochaineRefListe(_kyc(), 'KYC-', 4);
  });
  assert.equal(r, 'KYC-0004');
});
