/* Rejets budgétaires soumis au droit et au plafond ; numéros sans doublon après suppression. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('les numéros FED, DA, BC et factures suivent le plus grand numéro attribué', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    var an = new Date().getFullYear();
    DATA.fiches_engagement_depense = [{ id: 'a', numero_fed: 'FED-' + an + '-0001', numero_da: 'DA-' + an + '-0001' }, { id: 'c', numero_fed: 'FED-' + an + '-0003', numero_da: 'DA-' + an + '-0003' }];
    DATA.bons_commande = [{ id: 'b1', numero: 'BC-' + an + '-001' }, { id: 'b3', numero: 'BC-' + an + '-003' }];
    DATA.factures_client = [{ id: 'f1', numero: 'FV-' + an + '-00001' }, { id: 'f3', numero: 'FV-' + an + '-00003' }];
    DATA.receptions_travaux = [{ id: 'p', numero: 'PVR-' + an + '-002' }];
    return { fed: _fedGenererNumero(), da: _daGenererNumero(), bc: bcNextNum(), pvr: rectNextNum(), an: an,
      vide: (function () { DATA.livraisons = []; return livNextNum(); })() };
  });
  assert.equal(r.fed, 'FED-' + r.an + '-0004');
  assert.equal(r.da, 'DA-' + r.an + '-0004');
  assert.equal(r.bc, 'BC-' + r.an + '-004');
  assert.equal(r.pvr, 'PVR-' + r.an + '-003');
  assert.equal(r.vide, 'LIV-' + r.an + '-001');
});

test('le rejet budgétaire consulte le droit de validation et le plafond, et respecte un refus', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async function () {
    var appels = [], droit = true, plafondOk = true, sortie = {};
    window.toast = function () {};
    window.exigerDroit = function (m, a) { appels.push('droit:' + m + ':' + a); return droit; };
    window.exigerPlafond = function (mt) { appels.push('plafond:' + mt); return plafondOk; };
    function neuf() {
      DATA.caisse_budgets = [{ id: 'bg', statut: 'soumis', montant: 1000 }];
      DATA.transferts_budgetaires = [{ id: 'tr', statut: 'soumis', montant: 2000 }];
      DATA.fiches_engagement_depense = [{ id: 'fe', statut: 'soumise', montant: 3000, numero_fed: 'FED-X' }];
      DATA.demandes_reappro = [{ id: 'dr', statut: 'soumise', montant_demande: 4000, numero: 'REAP-X' }];
      appels = [];
    }
    function etats() { return [DATA.caisse_budgets[0].statut, DATA.transferts_budgetaires[0].statut, DATA.fiches_engagement_depense[0].statut, DATA.demandes_reappro[0].statut]; }
    async function tout() { await budgetPrevisionnelRejeter('bg', 'm'); await transfertRejeter('tr', 'm'); await daRejeter('fe', 'm'); await reapRejeter('dr', 'm'); }
    neuf(); droit = false; plafondOk = true; await tout(); sortie.sansDroit = etats();
    neuf(); droit = true; plafondOk = false; await tout(); sortie.plafondBas = etats();
    neuf(); droit = true; plafondOk = true; await tout(); sortie.autorise = etats(); sortie.appels = appels.filter(function (a) { return a.indexOf('plafond:') === 0; });
    return sortie;
  });
  assert.deepEqual(r.sansDroit, ['soumis', 'soumis', 'soumise', 'soumise']);
  assert.deepEqual(r.plafondBas, ['soumis', 'soumis', 'soumise', 'soumise']);
  assert.deepEqual(r.autorise, ['rejete', 'rejete', 'rejetee', 'rejetee']);
  assert.deepEqual(r.appels, ['plafond:1000', 'plafond:2000', 'plafond:3000', 'plafond:4000']);
});
