const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Régression : les écritures SANS division n'appartenaient à aucune entité et sortaient de la consolidation
   sans avertissement (chiffre d'affaires 165 000 F au lieu de 15,7 M F sur les données du groupe).
   Elles sont désormais regroupées sur une ligne « Non affecté (sans division) », ajoutée en dernier. */

test('Consolidation : les ventes sans division entrent dans le chiffre d\'affaires consolidé', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Division 1' }];
      DATA.ecritures = [
        E('a1', '2025-01-01', '512', '101', 5000000, { division: 'd1' }),
        E('v1', '2025-03-01', '512', '707', 57000, { division: 'd1' }),      // vente affectée
        E('v2', '2025-04-01', '512', '701', 14500000),                         // vente SANS division
        E('c1', '2025-05-01', '641', '512', 300000),                           // charge SANS division
      ];
      const K = consoCalcul(2025);
      return { ca: K.conso.XB, rn: K.conso.XI, noms: K.lignes.map(function (l) { return l.nom; }), na: K.nonAffecte && K.nonAffecte.nb };
    });
    assert.equal(r.ca, 14557000, 'CA = 57 000 (affecté) + 14 500 000 (sans division)');
    assert.equal(r.rn, 14557000 - 300000, 'résultat net : la charge sans division est prise en compte');
    assert.equal(r.noms[r.noms.length - 1], 'Non affecté (sans division)', 'ligne ajoutée EN DERNIER');
    assert.equal(r.na, 2, 'nombre d\'écritures sans division signalé');
  } finally { await app.fermer(); }
});

test('Consolidation : sans écriture sans division, aucune ligne « Non affecté » n\'est ajoutée', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Division 1' }, { id: 'd2', nom: 'Division 2' }];
      DATA.ecritures = [
        E('a1', '2025-01-01', '512', '101', 1000000, { division: 'd1' }),
        E('a2', '2025-01-01', '512', '101', 1000000, { division: 'd2' }),
      ];
      const K = consoCalcul(2025);
      return { lignes: K.lignes.length, na: K.nonAffecte };
    });
    assert.equal(r.lignes, 2);
    assert.equal(r.na, null);
  } finally { await app.fermer(); }
});

test('Consolidation : le bilan reste équilibré avec la ligne « Non affecté »', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Division 1' }];
      DATA.ecritures = [
        E('a1', '2025-01-01', '512', '101', 3000000, { division: 'd1' }),
        E('b1', '2025-02-01', '512', '451', 400000),                       // sans division
        E('c1', '2025-02-02', '462', '512', 100000),                       // sans division
        E('d1', '2025-03-01', '641', '422', 80000),                        // sans division
      ];
      const K = consoCalcul(2025);
      return { bz: K.conso.BZ, dz: K.conso.DZ };
    });
    assert.ok(Math.abs(r.bz - r.dz) < 0.5, 'actif ' + r.bz + ' ≠ passif ' + r.dz);
  } finally { await app.fermer(); }
});

test('Consolidation : l\'historique sans division antérieur à l\'à-nouveau du groupe n\'est pas compté deux fois', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Division 1' }];
      DATA.ecritures = [
        E('h1', '2024-06-01', '512', '419', 100),                                                     // historique 2024, sans division
        E('an', '2025-01-01', '512', '419', 100, { division: 'd1', type: 'a_nouveau', journal: 'AN' }), // à-nouveau 2025 : reprend ces 100
        E('m1', '2025-02-01', '512', '419', 50),                                                      // mouvement 2025, sans division
      ];
      const K = consoCalcul(2025);
      const row = K.lignes[K.lignes.length - 1];
      return { nom: row.nom, treso: row.B.BT };
    });
    assert.equal(r.nom, 'Non affecté (sans division)');
    assert.equal(r.treso, 50, 'seul le mouvement 2025 est compté dans « Non affecté » (le reste est dans l\'à-nouveau)');
  } finally { await app.fermer(); }
});

test('Consolidation : « Non affecté » n\'est pas traité comme une filiale (goodwill, minoritaires)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Mère' }];
      DATA.ecritures = [
        E('a1', '2025-01-01', '512', '101', 1000000, { division: 'd1' }),
        E('s1', '2025-02-01', '512', '701', 500000),
      ];
      const K = consoCalcul(2025);
      return { titres: K.elim.titres.map(function (t) { return t.fille; }), gw: K.conso.goodwill, mino: K.conso.minoritaires, mere: K.mere && K.mere.nom };
    });
    assert.deepEqual(r.titres, [], 'aucune « filiale » : « Non affecté » est exclu');
    assert.equal(r.mino, 0);
    assert.equal(r.mere, 'Mère', 'la société mère reste une vraie entité');
  } finally { await app.fermer(); }
});

test('Vue d\'une division : les écritures sans division n\'y sont pas ajoutées', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'Division 1' }];
      DATA.ecritures = [
        E('v1', '2025-03-01', '512', '707', 57000, { division: 'd1' }),
        E('v2', '2025-04-01', '512', '701', 14500000),
      ];
      return { ca: _lfCalc2(2025, 'd1').R.XB };
    });
    assert.equal(r.ca, 57000);
  } finally { await app.fermer(); }
});
