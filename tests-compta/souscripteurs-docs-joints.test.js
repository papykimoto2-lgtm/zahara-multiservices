const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Liste Souscripteurs : badge « 📎 n » et filtre « Documents joints » (avec / sans), calculés sans charger les fichiers. */
test('la liste affiche le nombre de documents joints et le filtre fonctionne', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.programmes = []; DATA.lots = []; DATA.versements = []; DATA.employes = []; DATA.apporteurs = [];
      DATA.clients = [
        { id: 'c1', nom: 'AVECDOC', prenoms: 'Un', tel: '0700000001', montant_total: 1000, statut: 'actif' },
        { id: 'c2', nom: 'SANSDOC', prenoms: 'Deux', tel: '0700000002', montant_total: 1000, statut: 'actif' }
      ];
      await dbPut('documents', { id: 'd1', entity_type: 'client', entity_id: 'c1', name: 'a.pdf', type: 'application/pdf', size: 3, blob: 'data:application/pdf;base64,QUJD', upload_date: '2026-11-01' });
      await dbPut('documents', { id: 'd2', entity_type: 'client', entity_id: 'c1', name: 'b.pdf', type: 'application/pdf', size: 3, blob: 'data:application/pdf;base64,QUJD', upload_date: '2026-11-01' });
      await dbPut('documents', { id: 'd3', entity_type: 'programme', entity_id: 'c2', name: 'p.pdf', type: 'application/pdf', size: 3, blob: 'data:application/pdf;base64,QUJD', upload_date: '2026-11-01' });
      renderClients();
      await new Promise(function (ok) { setTimeout(ok, 400); });
      const html = document.getElementById('tbody-clients').innerHTML;
      const badge = /AVECDOC[\s\S]*?📎 2/.test(html), pasSans = !/SANSDOC[\s\S]*?📎/.test(html);
      document.getElementById('filter-docs-client').value = 'avec'; renderClients();
      const avec = document.getElementById('tbody-clients').innerText;
      document.getElementById('filter-docs-client').value = 'sans'; renderClients();
      const sans = document.getElementById('tbody-clients').innerText;
      return { badge, pasSans, avecOk: /AVECDOC/.test(avec) && !/SANSDOC/.test(avec), sansOk: /SANSDOC/.test(sans) && !/AVECDOC/.test(sans) };
    });
    assert.deepEqual(r, { badge: true, pasSans: true, avecOk: true, sansOk: true });
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
