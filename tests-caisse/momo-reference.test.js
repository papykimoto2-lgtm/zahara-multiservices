/* Mobile Money : la référence VRS-AAAA-NNNN suit le plus grand numéro attribué, jamais le nombre de versements. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('momoEncaisser ne réutilise pas une référence après suppression d\'un versement', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async function () {
    var an = new Date().getFullYear();
    DATA.clients = [{ id: 'c-momo', nom: 'Test', prenoms: 'Momo', tel: '0700000000', montant_total: 1000000 }];
    DATA.versements = [
      { id: 'v1', ref: 'VRS-' + an + '-0001', client_id: 'c-momo', montant: 1, statut: 'valide' },
      { id: 'v3', ref: 'VRS-' + an + '-0003', client_id: 'c-momo', montant: 1, statut: 'valide' }
    ];
    window.genererEcritureVersement = async function () {};
    window.genererCommissionsVersement = async function () {};
    window.majStatutLotClient = async function () {};
    MOMO_LINES = [{ date: '', tel: '0700000000', nom: 'Test', montant: 5000, ref: 'MM-TEST-1', clientId: 'c-momo', done: false }];
    await momoEncaisser(0);
    var v = DATA.versements[DATA.versements.length - 1];
    return { ref: v.ref, an: an };
  });
  assert.equal(r.ref, 'VRS-' + r.an + '-0004');
});
