const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('apporteurs : classement lu dans les vraies données, XSS inerte, export neutralisé', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const j = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      DATA.apporteurs = [
        { id: 'a1', nom: 'Top <img src=x onerror=window.__xss=1>', prenoms: 'Awa', tel: '0711111111', statut: 'actif', date_contrat: j(300), date_expiration: j(-300), non_contournement: 'signe' },
        { id: 'a2', nom: '=cmd', tel: '0722222222', statut: 'actif', date_contrat: j(200), date_expiration: j(-100), non_contournement: 'signe' },
        { id: 'a3', nom: 'Dormant', tel: '0733333333', statut: 'actif', date_contrat: j(400), date_expiration: j(-100), non_contournement: 'signe' }];
      DATA.clients = [
        { id: 'c1', apporteur_id: 'a1', nom: 'X', montant_total: 8000000, date_souscription: j(20) },
        { id: 'c2', apporteur_id: 'a2', nom: 'Y', montant_total: 8000000, date_souscription: j(25) },
        { id: 'c3', apporteur_id: 'a3', nom: 'Z', montant_total: 8000000, date_souscription: j(200) }];
      DATA.versements = [{ id: 'v1', client_id: 'c1', montant: 2000000, date: j(10), statut: 'valide', type: 'mensualite' }, { id: 'v2', client_id: 'c2', montant: 500000, date: j(12), statut: 'valide', type: 'mensualite' }];
      DATA.commissions = [];
      aprOuvrir();
      const html = document.getElementById('apr-body').innerHTML;
      const d = aprDonnees();
      return { ordre: d.classes.map(x => x.id), dormant: d.autres.concat(d.classes).find(x => x.id === 'a3').tags.map(t => t.k), html, xss: window.__xss || 0,
        bouton: !!document.querySelector('[onclick="aprOuvrir()"]') };
    });
    assert.deepEqual(r.ordre, ['a1', 'a2']);
    assert.ok(r.dormant.includes('dormant'));
    assert.match(r.html, /🥇/); assert.match(r.html, /À réveiller/); assert.doesNotMatch(r.html, /<img src=x/);
    assert.equal(r.xss, 0); assert.equal(r.bouton, true);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
