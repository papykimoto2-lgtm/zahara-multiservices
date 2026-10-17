/* Versement : pas de type par défaut (« frais de souscription » faussait solde et compta) ; confirmation si montant anormal en frais. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('le formulaire de versement n\'a aucun type présélectionné, même après un précédent choix', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(() => {
    const sel = document.getElementById('v-type'), vide = sel.options[0].value === '' && sel.value === '';
    sel.value = 'mensualite'; clearPaiementForm();
    return { vide, apres: sel.value };
  });
  assert.equal(r.vide, true); assert.equal(r.apres, '');
});

test('garde-fou : frais de souscription au montant anormal', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(() => {
    DATA.clients = [{ id: 'c1', montant_total: 4500000 }]; DATA.params = Object.assign({}, DATA.params, { frais_souscription: 0 });
    const a = vrsTypeSuspect('c1', 'frais_souscription', 1700000);      // > 5 % du contrat (225 000)
    const b = vrsTypeSuspect('c1', 'frais_souscription', 100000);       // sous le seuil
    const c = vrsTypeSuspect('c1', 'mensualite', 1700000);              // autre type : jamais
    DATA.params.frais_souscription = 100000;
    const d = vrsTypeSuspect('c1', 'frais_souscription', 100000);       // égal aux frais prévus
    const e = vrsTypeSuspect('c1', 'frais_souscription', 300000);       // dépasse les frais prévus
    return { a, b, c, d, e };
  });
  assert.match(r.a, /Frais de souscription/); assert.equal(r.b, ''); assert.equal(r.c, ''); assert.equal(r.d, ''); assert.match(r.e, /100[\s  ]000/);
});
