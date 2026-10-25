const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Jeu 2025 : capital, deux souscripteurs (A solde, B avance), ventes, charges — tout visé. */
function jeu() {
  const v = { valide_le: '2025-12-30T10:00:00Z', valide_par: 'Resp', statut_ecr: 'valide' };
  DATA.ecritures = [
    Object.assign(E('cap','2025-01-05','512','101',1000000), v),
    Object.assign({ id: 'vA', date: '2025-02-01', libelle: 'Vente A', lignes: [{ compte: '4111', sens: 'D', montant: 500000, tiers_id: 'cliA' }, { compte: '701', sens: 'C', montant: 500000 }] }, v),
    Object.assign({ id: 'pA', date: '2025-03-01', libelle: 'Versement A', lignes: [{ compte: '512', sens: 'D', montant: 200000 }, { compte: '4111', sens: 'C', montant: 200000, tiers_id: 'cliA' }] }, v),
    Object.assign({ id: 'pB', date: '2025-03-02', libelle: 'Avance B', lignes: [{ compte: '512', sens: 'D', montant: 80000 }, { compte: '4111', sens: 'C', montant: 80000, tiers_id: 'cliB' }] }, v),
    Object.assign(E('ch','2025-06-01','641','512',150000), v),
    Object.assign(E('hao','2025-07-01','512','821',40000), v),
  ];
}

test('clôture : à-nouveaux par tiers, résultat sur le compte du plan (121), pièces visées, Bilan N+1 équilibré', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      await cloturerExercice(2025, '');
      annee(2026); buildBilan();
      const B = calcBilan(2026, '');
      const an = DATA.ecritures.filter(function (e) { return e.journal === 'AN'; });
      const lignes411 = [].concat.apply([], an.map(function (e) { return e.lignes; })).filter(function (l) { return l.compte === '4111'; });
      return { clos: exerciceEstClos('2025-06-01'), equilibre: B.equilibre, ecart: B.ecart, res2026: B.resultat, creances: B.creances, diverses: B.diverses,
        tiers: lignes411.map(function (l) { return l.tiers_id + ':' + l.sens + l.montant; }).sort(),
        compteResultat: an.some(function (e) { return e.lignes.some(function (l) { return l.compte === '121'; }); }),
        visees: an.concat(DATA.ecritures.filter(function (e) { return e.journal === 'CLO'; })).every(function (e) { return !!e.valide_le; }),
        liaison: an.reduce(function (t, e) { return t + e.lignes.reduce(function (s, l) { return s + (l.compte === '890' ? (l.sens === 'D' ? 1 : -1) * l.montant : 0); }, 0); }, 0) };
    }, jeu.toString());
    assert.equal(r.clos, true);
    assert.equal(r.equilibre, true, 'écart ' + r.ecart);
    assert.deepEqual(r.tiers, ['cliA:D300000', 'cliB:C80000']);   /* chaque souscripteur garde son solde, sans compensation */
    assert.equal(r.creances, 300000);
    assert.equal(r.diverses, 80000);
    assert.equal(r.compteResultat, true);
    assert.equal(r.visees, true);
    assert.equal(r.res2026, 0);   /* le résultat 2025 est reporté, il n'est plus recompté en 2026 */
    assert.equal(r.liaison, 0);   /* le compte de liaison 890 se solde à zéro */
  } finally { await app.fermer(); }
});

test('clôture : refusée tant qu\'une pièce est au brouillard ou déséquilibrée', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      DATA.ecritures.push(E('brouillon','2025-08-01','641','512',10));       /* non visée */
      await cloturerExercice(2025, '');
      const apresBrouillon = exerciceEstClos('2025-06-01');
      const m1 = window.__toasts.slice();
      DATA.ecritures[DATA.ecritures.length - 1].valide_le = '2025-12-31';
      DATA.ecritures[DATA.ecritures.length - 1].lignes[1].montant = 9;       /* déséquilibrée */
      await cloturerExercice(2025, '');
      return { apresBrouillon: apresBrouillon, apresDesequ: exerciceEstClos('2025-06-01'), toasts: window.__toasts };
    }, jeu.toString());
    assert.equal(r.apresBrouillon, false);
    assert.equal(r.apresDesequ, false);
    assert.ok(r.toasts.some(function (t) { return /brouillard/.test(t); }));
    assert.ok(r.toasts.some(function (t) { return /déséquilibrée/.test(t); }));
  } finally { await app.fermer(); }
});

test('clôture : un exercice déjà clos ne se clôture pas deux fois (pas de doublon d\'à-nouveaux)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      await cloturerExercice(2025, '');
      const nb1 = DATA.ecritures.length;
      await cloturerExercice(2025, '');
      return { nb1: nb1, nb2: DATA.ecritures.length, toasts: window.__toasts };
    }, jeu.toString());
    assert.equal(r.nb2, r.nb1);
    assert.ok(r.toasts.some(function (t) { return /déjà clôturé/.test(t); }));
  } finally { await app.fermer(); }
});

test('réouverture : refusée si l\'exercice suivant est clos ; autorisée dans l\'ordre inverse', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      await cloturerExercice(2025, '');
      DATA.params.cloture_2026 = true;                       /* 2026 clos à son tour */
      await rouvrirExercice(2025, '');
      const refusee = exerciceEstClos('2025-06-01');
      const nbAN = DATA.ecritures.filter(function (e) { return e.journal === 'AN'; }).length;
      DATA.params.cloture_2026 = false;
      await rouvrirExercice(2025, '');
      return { refusee: refusee, nbAN: nbAN, rouvert: !exerciceEstClos('2025-06-01'),
        reste: DATA.ecritures.filter(function (e) { return e.journal === 'AN' || e.journal === 'CLO'; }).length };
    }, jeu.toString());
    assert.equal(r.refusee, true);
    assert.ok(r.nbAN > 0);
    assert.equal(r.rouvert, true);
    assert.equal(r.reste, 0);
  } finally { await app.fermer(); }
});

test('clôture : le compte de résultat suit le plan — 131/139 si le plan est SYSCOHADA, créés si le plan n\'en a aucun', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      APP.planComptable = APP.planComptable.filter(function (c) { return ['121', '129', '131', '139'].indexOf(c.code) === -1; });
      const avant = APP.planComptable.some(function (c) { return c.code === '131'; });
      await cloturerExercice(2025, '');
      const an = DATA.ecritures.filter(function (e) { return e.journal === 'AN'; });
      return { avant: avant, sur131: an.some(function (e) { return e.lignes.some(function (l) { return l.compte === '131'; }); }),
        auPlan: APP.planComptable.some(function (c) { return c.code === '131' && !c._horsPlan; }), eq: (annee(2026), calcBilan(2026, '').equilibre) };
    }, jeu.toString());
    assert.equal(r.avant, false);
    assert.equal(r.sur131, true);
    assert.equal(r.auPlan, true);   /* 131 créé au plan : plus de compte « hors plan » */
    assert.equal(r.eq, true);
  } finally { await app.fermer(); }
});

test('Bilan 2026 après clôture 2025 : les soldes ne sont pas comptés deux fois (historique + à-nouveaux)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      const avant = calcBilan(2025, '');
      await cloturerExercice(2025, '');
      const apres = calcBilan(2026, '');
      return { tresoAvant: avant.tresoActif, tresoApres: apres.tresoActif, actifAvant: avant.totalActif, actifApres: apres.totalActif };
    }, jeu.toString());
    assert.equal(r.tresoApres, r.tresoAvant);
    assert.equal(r.actifApres, r.actifAvant);
  } finally { await app.fermer(); }
});

test('données importées (FEC) : le compte auxiliaire du fichier sert de tiers ; un journal d\'à-nouveaux importé n\'est pas compté deux fois', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      /* 2024 : vente à CLI1 ; 2025 : à-nouveau importé (journal RAN) qui reprend la créance, puis un règlement */
      DATA.ecritures = [
        { id: 'i1', date: '2024-03-01', libelle: 'Vente', journal: 'VE', lignes: [{ compte: '4111', sens: 'D', montant: 500, compte_aux: 'CLI1' }, { compte: '701', sens: 'C', montant: 500 }] },
        { id: 'i2', date: '2025-01-01', libelle: 'RAN', journal: 'RAN', lignes: [{ compte: '4111', sens: 'D', montant: 500, compte_aux: 'CLI1' }, { compte: '890', sens: 'C', montant: 500 }] },
        { id: 'i3', date: '2025-02-01', libelle: 'Règlement', journal: 'BQ', lignes: [{ compte: '521', sens: 'D', montant: 200 }, { compte: '4111', sens: 'C', montant: 200, compte_aux: 'CLI1' }] }];
      const B = calcBilan(2025, '');
      return { creances: B.creances, eq: B.equilibre };
    });
    assert.equal(r.creances, 300);   /* 500 − 200, et non 1 000 − 200 */
  } finally { await app.fermer(); }
});

test('clôture : refusée si un bilan d\'ouverture existe déjà pour l\'exercice suivant (pas d\'ouverture en double)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      DATA.ecritures.push({ id: 'bo1', date: '2026-01-01', reference: 'BO-2026', journal: 'AN', type: 'a_nouveau', libelle: 'Bilan d\'ouverture 2026',
        lignes: [{ compte: '512', sens: 'D', montant: 100 }, { compte: '890', sens: 'C', montant: 100 }], valide_le: '2026-01-02' });
      const avant = DATA.ecritures.length;
      await cloturerExercice(2025, '');
      return { clos: exerciceEstClos('2025-06-01'), nb: DATA.ecritures.length - avant, toasts: window.__toasts };
    }, jeu.toString());
    assert.equal(r.clos, false);
    assert.equal(r.nb, 0);
    assert.ok(r.toasts.some(function (t) { return /bilan d'ouverture BO-2026/.test(t) && /EN DOUBLE/.test(t); }));
  } finally { await app.fermer(); }
});

test('Clôture & FEC : le champ « Périmètre » est rempli et garde la division choisie', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'd1', nom: 'MENCO IMMO' }, { id: 'd2', nom: 'MENCO AGRO' }];
      DATA.ecritures = [Object.assign(E('a', '2025-03-01', '512', '101', 100), { division: 'd2' }), E('b', '2025-03-02', '512', '101', 50)];
      annee(2025);
      renderClotureFEC();
      const sel = function () { return document.getElementById('filter-division-cloture'); };
      const options = [].map.call(sel().options, function (o) { return o.text; });
      sel().value = 'd2'; sel().onchange();                    /* l'utilisateur choisit une division */
      return { options: options, apres: sel().value, resume: document.getElementById('cloture-fec-content').textContent.match(/(\d+) écriture\(s\)/)[1] };
    });
    assert.deepEqual(r.options, ['— Toutes divisions (consolidé) —', 'MENCO IMMO', 'MENCO AGRO']);
    assert.equal(r.apres, 'd2');       /* la sélection survit au rendu */
    assert.equal(r.resume, '1');       /* et filtre bien l'export : 1 écriture pour cette division */
  } finally { await app.fermer(); }
});
