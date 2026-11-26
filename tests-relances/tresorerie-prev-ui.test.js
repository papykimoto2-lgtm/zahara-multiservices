const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('trésorerie prévisionnelle : lue dans la vraie compta, ligne manuelle, export neutralisé, XSS inerte', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const j = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      const E = (id, date, lignes) => ({ id, date, libelle: 'T', lignes, valide_le: date });
      DATA.ecritures = [
        E('cap', j(100), [{ compte: '521', sens: 'D', montant: 20000000 }, { compte: '101', sens: 'C', montant: 20000000 }]),
        ...[85, 55, 25].map((n, i) => E('paie' + i, j(n), [{ compte: '641', sens: 'D', montant: 3000000 }, { compte: '521', sens: 'C', montant: 3000000 }])),
        E('fou', j(20), [{ compte: '401', sens: 'D', montant: 1500000 }, { compte: '521', sens: 'C', montant: 1500000 }]),
        E('vir', j(10), [{ compte: '571', sens: 'D', montant: 500000 }, { compte: '521', sens: 'C', montant: 500000 }]),   // virement interne : ignoré
        E('inv', j(30), [{ compte: '241', sens: 'D', montant: 9000000 }, { compte: '521', sens: 'C', montant: 9000000 }])    // investissement : exclu du rythme
      ];
      const ancre = j(200);
      DATA.clients = [{ id: 'c1', nom: 'Awa <img src=x onerror=window.__xss=1>', prenoms: '', tel: '0712345678', montant_total: 6000000, apport: 0, duree: 60, date_debut: ancre, date_souscription: ancre }];
      DATA.versements = [{ id: 'v1', client_id: 'c1', montant: 300000, date: j(15), statut: 'valide', type: 'mensualite' }];
      DATA.caisse_mouvements = []; DATA.params = DATA.params || {};
      const d = tpDonnees();
      tpRendre();
      const html = document.getElementById('treso-prev-box').innerHTML;
      // ligne manuelle
      TP.edit = null; tpLigneOuvrir();
      document.getElementById('tpl-lib').value = '=cmd|calc'; document.getElementById('tpl-mt').value = '2000000';
      document.getElementById('tpl-date').value = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
      tpLigneEnregistrer();
      const apres = tpDonnees();
      return { solde: d.soldeInitial, cats: Object.keys(d.profil).sort(), paieMois: Math.round(d.profil.paie.mensuel), source: d.sourceSorties,
        nbClients: d.nbClients, mesure: d.tauxMesure, html, manuels: apres.manuels.length, xss: window.__xss || 0, htmlAp: document.getElementById('treso-prev-box').innerHTML };
    });
    // 20 M − 9 M (investissement) − 9 M (paie) − 1,5 M (fournisseur) ; le virement 521 → 571 est neutre sur la position
    assert.equal(r.solde, 500000);
    assert.deepEqual(r.cats, ['fournisseurs', 'paie']);                      // investissement et virement exclus
    assert.ok(Math.abs(r.paieMois - 3000000) < 60000, 'paie ≈ 3 M/mois, obtenu ' + r.paieMois);
    assert.equal(r.source, 'grand livre'); assert.equal(r.nbClients, 1);
    assert.match(r.html, /13 semaines/); assert.match(r.html, /Hypothèses/); assert.doesNotMatch(r.html, /<img src=x/);
    assert.equal(r.manuels, 1); assert.match(r.htmlAp, /&#39;?=cmd|=cmd/);
    assert.equal(r.xss, 0);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
