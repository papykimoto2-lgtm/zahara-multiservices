const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('bilan de promotion : commissions réelles comptées (bug corrigé), santé des marges, XSS inerte', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.programmes = [{ id: 'p1', nom: 'Eden <img src=x onerror=window.__xss=1>', nature: 'construction', statut: 'actif', parcelle_id: 'pc1' },
                         { id: 'p2', nom: 'Sans foncier', nature: 'construction', statut: 'actif' }];
      DATA.parcelles = [{ id: 'pc1', prix_acq: 100000000 }];
      DATA.lots = [
        { id: 'l1', programme_id: 'p1', statut: 'vendu', prix: 60000000, nature: 'villa' }, { id: 'l2', programme_id: 'p1', statut: 'disponible', prix: 60000000, nature: 'villa' },
        { id: 'l3', programme_id: 'p2', statut: 'disponible', prix: 50000000, nature: 'villa' }];
      DATA.clients = [{ id: 'c1', programme_id: 'p1', lot_id: 'l1', montant_total: 60000000 }];
      DATA.versements = [{ id: 'v1', client_id: 'c1', programme_id: 'p1', montant: 30000000, date: '2026-10-01', statut: 'valide', type: 'mensualite' }];
      DATA.commissions = [
        { id: 'm1', client_id: 'c1', programme_id: 'p1', type_beneficiaire: 'apporteur', montant_comm: 3000000, statut: 'a_payer' },
        { id: 'm2', client_id: 'c1', type_beneficiaire: 'commercial', montant_comm: 1500000, statut: 'payee' },        // rattachée via le souscripteur
        { id: 'm3', client_id: 'c1', programme_id: 'p1', type_beneficiaire: 'apporteur', montant_comm: 9999999, statut: 'annulee' }];
      DATA.conventions = []; DATA.situations = []; DATA.params = DATA.params || {};
      const b = bpCompute('p1');
      mpRendre();
      return { comm: b.coutCommercial, avenir: b.commissionsAVenir, nb: b.nbCommissions, html: document.getElementById('bp-sante').innerHTML, xss: window.__xss || 0 };
    });
    assert.equal(r.comm, 4500000);                        // 3 M + 1,5 M ; l'annulée est exclue
    assert.equal(r.nb, 2);
    assert.equal(r.avenir, 4500000);                      // taux observé 4,5 M / 30 M encaissés × 30 M restants
    assert.match(r.html, /Santé des marges/); assert.match(r.html, /Coût du foncier absent/); assert.doesNotMatch(r.html, /<img src=x/);
    assert.equal(r.xss, 0);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
