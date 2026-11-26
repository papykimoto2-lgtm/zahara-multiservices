const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('parrainage : attribution, éligibilité sur argent encaissé, validation, versement tracé, XSS inerte', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const j = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      DATA.params = DATA.params || {}; DATA.params.parrainage = { actif: true, montant: 150000, seuil_pct: 10, plafond: 0, exige_a_jour: true };
      DATA.clients = [
        { id: 'P', nom: 'Parrain <img src=x onerror=window.__xss=1>', prenoms: 'Awa', tel: '0711111111', montant_total: 10000000, date_souscription: j(300) },
        { id: 'F', nom: 'Filleul', prenoms: 'Koffi', tel: '0722222222', montant_total: 10000000, date_souscription: j(20) }];
      DATA.versements = [{ id: 'v1', client_id: 'F', montant: 1500000, date: j(5), statut: 'valide', type: 'mensualite' }, { id: 'v0', client_id: 'P', montant: 9000000, date: j(40), statut: 'valide', type: 'mensualite' }];
      DATA.leads = [{ id: 'l1', nom: 'Prospect', tel: '0722222222', stade: 'contact', created_at: j(30), source: 'salon' }];
      DATA.relances = [];
      parOuvrir('attribuer');
      document.getElementById('par-parrain').value = 'Awa — 0711111111 [P]';
      document.getElementById('par-filleul').value = 'Prospect : Prospect — 0722222222 [lead:l1]';
      await parEnregistrer();
      const lead = DATA.leads[0];
      const avant = parDonnees();
      const etatAvant = avant.liens[0].etat, cle = avant.liens[0].key;
      await parValider('P', cle);
      const apresValid = parDonnees().liens[0].etat;
      parVerserOuvrir('P', cle);
      document.getElementById('parv-ref').value = '';                  // référence vide : refusée
      await parVerserConfirmer(); const toujoursDue = parDonnees().liens[0].etat;
      document.getElementById('parv-ref').value = 'VIR-001'; await parVerserConfirmer();
      const jour = DATA.clients[0].parrainage_recompenses[0];
      const html = document.getElementById('par-body').innerHTML;
      renderPipeline();
      return { parrain: lead.parrain_id, source: lead.source, etatAvant, cle, apresValid, toujoursDue, statut: jour.statut, ref: jour.reference, montant: jour.montant, nbJournal: DATA.clients[0].parrainage_recompenses.length,
        html, xss: window.__xss || 0, bouton: !!document.querySelector('[onclick="parOuvrir()"]') };
    });
    assert.equal(r.parrain, 'P'); assert.equal(r.source, 'parrainage');
    assert.equal(r.cle, 'client:F');                 // le prospect est relié au souscripteur par le téléphone
    assert.equal(r.etatAvant, 'eligible'); assert.equal(r.apresValid, 'due'); assert.equal(r.toujoursDue, 'due');
    assert.equal(r.statut, 'versee'); assert.equal(r.ref, 'VIR-001'); assert.equal(r.montant, 150000); assert.equal(r.nbJournal, 1);
    assert.doesNotMatch(r.html, /<img src=x/); assert.equal(r.xss, 0); assert.equal(r.bouton, true);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
