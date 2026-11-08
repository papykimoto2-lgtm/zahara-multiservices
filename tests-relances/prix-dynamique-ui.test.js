const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('prix dynamique : propositions lues dans les vraies données, application tracée, plancher respecté, XSS inerte', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const j = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      DATA.params = DATA.params || {};
      DATA.programmes = [{ id: 'P1', nom: 'Eden <img src=x onerror=window.__xss=1>', statut: 'actif', nature: 'construction', parcelle_id: 'pc' }];
      DATA.parcelles = [{ id: 'pc', prix_acq: 100000000 }]; DATA.conventions = []; DATA.situations = []; DATA.commissions = []; DATA.ecritures = []; DATA.apporteurs = []; DATA.relances = [];
      DATA.lots = [{ id: 'L1', programme_id: 'P1', numero: '1', statut: 'disponible', prix: 40000000, cout_revient: 30000000, surface: 100, created_at: j(400), nature: 'villa' },
                   { id: 'L2', programme_id: 'P1', numero: '2', statut: 'vendu', prix: 40000000, nature: 'villa' },
                   { id: 'L3', programme_id: 'P1', numero: '3', statut: 'disponible', prix: 40000000, cout_revient: 37000000, surface: 100, created_at: j(400), nature: 'villa' }];
      DATA.clients = []; DATA.versements = []; DATA.leads = [];
      pxdOuvrir();
      const d = pxdDonnees(), p = d.programmes[0];
      const html = document.getElementById('pxd-body').innerHTML;
      const l1 = p.propositions.find(x => x.lot.id === 'L1'), l3 = p.propositions.find(x => x.lot.id === 'L3');
      PXD.sel = { L1: true }; await pxdAppliquer();
      const lot1 = DATA.lots.find(l => l.id === 'L1'), lot3 = DATA.lots.find(l => l.id === 'L3');
      return { action: p.action, l1: l1 && { sug: l1.suggere, blocage: l1.blocage }, l3: l3 && { sug: l3.suggere, blocage: l3.blocage }, prix1: lot1.prix, hist: lot1.prix_historique, prix3: lot3.prix,
        html, xss: window.__xss || 0, bouton: !!document.querySelector('[onclick="pxdOuvrir()"]'), cockpit: (CCR.cache = null, ckActions().filter(a => a.aid.startsWith('cr_prix_')).length) };
    });
    assert.equal(r.action, 'baisse');                                           // aucune vente en 90 j, stock dormant, aucun prospect
    assert.deepEqual(r.l1, { sug: 38000000, blocage: null });                    // 40 M −5 %, au-dessus du plancher 30/0,85 = 35,3 M
    assert.equal(r.l3.blocage, 'plancher');                                      // plancher 43,5 M > prix : baisse impossible
    assert.equal(r.prix1, 38000000); assert.equal(r.hist.length, 1); assert.equal(r.hist[0].ancien, 40000000); assert.equal(r.prix3, 40000000);
    assert.doesNotMatch(r.html, /<img src=x/); assert.equal(r.xss, 0); assert.equal(r.bouton, true); assert.equal(r.cockpit, 1);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
