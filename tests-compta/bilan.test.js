const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Chaque jeu est équilibré écriture par écriture : le Bilan doit donc l'être aussi, par construction. */
const JEUX = {
  'ventes, charges et résultat (signe du résultat)': [['a','2025-01-05','512','101',1000000],['b','2025-03-01','4111','701',500000],['c','2025-04-01','512','4111',200000],['d','2025-06-01','641','512',150000]],
  'TVA récupérable 4452 (compte posté par les achats)': [['a','2025-01-01','512','101',1000],['b','2025-02-01','244','401',1000],['c','2025-02-01','4452','401',180]],
  'amortissements 28 (dotation D681 / C2841)': [['a','2025-01-01','244','101',1000],['b','2025-12-31','681','2841',100]],
  'virement interne en cours 585': [['a','2025-01-01','512','101',1000],['b','2025-12-31','585','512',100]],
  'classe 8, reprises 79 et résultat 131 déjà porté': [['a','2025-01-01','512','101',1000],['b','2025-02-01','512','821',300],['c','2025-02-02','512','791',50],['d','2025-03-01','131','512',10]],
  'avance client (créditeur) et fournisseur débiteur': [['a','2025-01-01','512','101',1000],['b','2025-02-01','512','4111',400],['c','2025-02-02','409','512',50]],
};
for (const nom of Object.keys(JEUX)) {
  test('Bilan équilibré — ' + nom, async () => {
    const app = await ouvrirApp();
    try {
      const r = await app.page.evaluate(function (jeu) {
        DATA.ecritures = jeu.map(function (x) { return E(x[0], x[1], x[2], x[3], x[4]); });
        annee(2025);
        buildBilan();
        const B = calcBilan(2025, '');
        return { equilibre: B.equilibre, ecart: B.ecart, texte: document.getElementById('bilan-equilibre').textContent };
      }, JEUX[nom]);
      assert.equal(r.equilibre, true, 'écart ' + r.ecart);
      assert.match(r.texte, /Bilan équilibré/);
    } finally { await app.fermer(); }
  });
}

test('Bilan : le résultat de l\'exercice a le bon signe (bénéfice positif, perte négative)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.ecritures = [E('a','2025-01-05','512','101',1000000), E('b','2025-03-01','4111','701',500000), E('d','2025-06-01','641','512',150000)];
      const ben = calcBilan(2025, '').resultat;
      DATA.ecritures = [E('a','2025-01-05','512','101',1000000), E('d','2025-06-01','641','512',150000)];
      const perte = calcBilan(2025, '').resultat;
      return { ben: ben, perte: perte };
    });
    assert.equal(r.ben, 350000);
    assert.equal(r.perte, -150000);
  } finally { await app.fermer(); }
});

test('Bilan : non-compensation des tiers (client créditeur d\'un côté, débiteur de l\'autre)', async () => {
  const app = await ouvrirApp();
  try {
    const B = await app.page.evaluate(function () {
      DATA.ecritures = [
        { id: 'a', date: '2025-01-01', libelle: 'vente A', lignes: [{ compte: '4111', sens: 'D', montant: 300, tiers_id: 'A' }, { compte: '701', sens: 'C', montant: 300 }] },
        { id: 'b', date: '2025-01-02', libelle: 'avance B', lignes: [{ compte: '521', sens: 'D', montant: 500 }, { compte: '4111', sens: 'C', montant: 500, tiers_id: 'B' }] }];
      const x = calcBilan(2025, '');
      return { creances: x.creances, diverses: x.diverses, eq: x.equilibre };
    });
    assert.equal(B.creances, 300);   /* A doit 300 */
    assert.equal(B.diverses, 500);   /* B a versé 500 d'avance : dette, pas compensée */
    assert.equal(B.eq, true);
  } finally { await app.fermer(); }
});

test('Bilan : l\'état imprimé reprend exactement le calcul de l\'écran', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.ecritures = [E('a','2025-01-05','512','101',1000000), E('b','2025-03-01','4111','701',500000)];
      annee(2025);
      let html = '';
      window.genererEtatPDF = function (o) { html = o.contenu; };
      window._comptaYear = function () { return '2025'; };
      etatBilan();
      const B = calcBilan(2025, '');
      return { html: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), actif: B.totalActif };
    });
    assert.match(r.html, /Bilan équilibré/);
    assert.ok(r.html.indexOf(new Intl.NumberFormat('fr-FR').format(1500000).replace(/ /g, ' ')) !== -1 || /1.500.000|1 500 000|1500000/.test(r.html));
  } finally { await app.fermer(); }
});

test('Bilan d\'ouverture déséquilibré : l\'écart porté par le compte de liaison 890 est montré, pas absorbé par le résultat', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.ecritures = [E('bo1','2025-01-01','512','890',1000), E('v','2025-02-01','4111','701',300)];
      annee(2025); buildBilan();
      const B = calcBilan(2025, ''), R = _calcResultat('2025');
      return { liaison: B.liaison, resultat: B.resultat, eq: B.equilibre, isCR: R.isComptab, html: document.getElementById('bilan-box').textContent };
    });
    assert.equal(r.liaison, 1000);
    assert.equal(r.resultat, 300);
    assert.equal(r.eq, true);
    assert.equal(r.isCR, 0);   /* 890 n'est jamais pris pour l'impôt sur le résultat (89) */
    assert.match(r.html, /compte de liaison 890/);
  } finally { await app.fermer(); }
});
