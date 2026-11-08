const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('locatif : rentabilité lue dans les vraies données, seuils enregistrés, Cockpit alimenté, XSS inerte', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const j = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      DATA.params = DATA.params || {};
      DATA.biens_locatifs = [
        { id: 'b1', designation: 'Villa <img src=x onerror=window.__xss=1>', loyer: 400000, surface: 100, commune: 'Cocody', type: 'villa', created_at: j(500), disponible_le: j(100) },
        { id: 'b2', designation: 'Appart A', loyer: 250000, surface: 50, commune: 'Cocody', type: 'appartement', created_at: j(500) }];
      DATA.baux = [{ id: 'x1', bien_id: 'b2', statut: 'actif', loyer: 250000, debut: j(400), fin: j(-300), derniere_revision: j(10) },
                   { id: 'x0', bien_id: 'b1', statut: 'resilie', loyer: 400000, debut: j(450), date_resiliation: j(100), fin: j(100) }];
      DATA.quittances = []; DATA.ordres_travaux = []; DATA.ecritures = []; DATA.programmes = []; DATA.lots = []; DATA.clients = []; DATA.versements = []; DATA.leads = []; DATA.apporteurs = []; DATA.relances = [];
      rloOuvrir();
      const html = document.getElementById('rlo-body').innerHTML, d = rloDonnees();
      document.getElementById('rlo-vac').value = '200'; await rloSeuilsSauver();
      const apres = rloDonnees().alertes.filter(a => a.k === 'vacance').length;
      DATA.params.rentabilite_locative = null; CCR.cache = null;
      const cr = ckActions().filter(a => a.aid.startsWith('cr_locvac_'));
      return { statut: d.biens.find(l => l.bien.id === 'b1').statut, vac: d.biens.find(l => l.bien.id === 'b1').vacance_courante, alertes: d.alertes.map(a => a.k), html, apres, nbCockpit: cr.length,
        bouton: !!document.querySelector('[onclick="rloOuvrir()"]'), xss: window.__xss || 0 };
    });
    assert.equal(r.statut, 'vacant'); assert.equal(r.vac, 100); assert.ok(r.alertes.includes('vacance'));
    assert.match(r.html, /Rentabilité locative|Alertes/); assert.doesNotMatch(r.html, /<img src=x/);
    assert.equal(r.apres, 0, 'seuil relevé à 200 j : plus d\'alerte'); assert.equal(r.nbCockpit, 1);
    assert.equal(r.bouton, true); assert.equal(r.xss, 0);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
