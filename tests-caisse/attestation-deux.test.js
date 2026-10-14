/* Attestation de solde : DEUX attestations pour le notaire — prix initial et valeur finale (avec modifications de construction). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  await page.evaluate(function () {
    window.syncToSupabase = function () {}; window.toast = function () {}; window.attLierJuridique = async function () { return null; }; window.hasRole = function () { return true; };
    APP.currentUser = { id: 'dg', nom: 'DG', role: 'admin' };
    DATA.params = { societe: 'ZMS Sarl', ville: 'Abidjan' }; DATA.divisions = []; DATA.programmes = []; DATA.validations = [];
    DATA.clients = [
      { id: 'c1', nom: 'BENDE', prenoms: 'Michel', dossier: 'SS675', montant_total: 7000000,
        demandes_modification: [{ id: 't1', description: 'Ajout d\'une terrasse <img src=x onerror=alert(1)>', date: '2026-03-01', facture: true, montant_facture: 1500000, cout_estime: 1500000, statut: 'realise' },
                                { id: 't2', description: 'Cloison non facturée', date: '2026-03-05', facture: false, montant_facture: 0, cout_estime: 300000 }],
        regularisations_surface: [{ id: 'r1', date: '2026-03-10', ecart_m2: 10, prix_m2: 50000, montant: 500000 }] },
      { id: 'c2', nom: 'KONE', prenoms: 'Ali', dossier: 'SS1', montant_total: 4000000 }
    ];
    DATA.versements = [
      { id: 'v1', client_id: 'c1', montant: 3000000, date: '2026-01-10', type: 'versement', mode: 'Virement', ref: 'V1' },
      { id: 'v2', client_id: 'c1', montant: 2500000, date: '2026-02-10', type: 'versement', mode: 'Virement', ref: 'V2' },
      { id: 'v3', client_id: 'c1', montant: 1500000, date: '2026-04-01', type: 'versement', mode: 'Virement', ref: 'V3' },
      { id: 'f1', client_id: 'c1', montant: 100000, date: '2026-01-01', type: 'frais_souscription' },
      { id: 'w1', client_id: 'c2', montant: 4100000, date: '2026-02-01', type: 'versement', mode: 'Espèces', ref: 'W1' }
    ];
  });
}

test('décomposition du prix : prix initial = contrat − modifications facturées − régularisation de surface (non facturées ignorées)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var P = attSoldePrix(DATA.clients[0]), P2 = attSoldePrix(DATA.clients[1]);
    return { initial: P.initial, total: P.total, somme: P.sommeModifs, nb: P.modifs.length, natures: P.modifs.map(function (m) { return m.nature; }), initial2: P2.initial, nb2: P2.modifs.length, appl: [attSoldeApplicable(DATA.clients[0], 'finale'), attSoldeApplicable(DATA.clients[1], 'finale')] };
  });
  assert.equal(r.initial, 5000000); assert.equal(r.total, 7000000); assert.equal(r.somme, 2000000); assert.equal(r.nb, 2);
  assert.deepEqual(r.natures, ['Travaux modificatifs', 'Régularisation de surface']);
  assert.equal(r.initial2, 4000000); assert.equal(r.nb2, 0); assert.deepEqual(r.appl, [true, false]);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('imputation : les versements soldent d\'abord le prix initial (attestation A), puis les modifications (attestation B)', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var c = DATA.clients[0]; var out = {};
    DATA.versements = DATA.versements.filter(function (v) { return v.id !== 'v3'; });   // 5,5 M versés : prix initial soldé, modifications non soldées
    var a = attSoldeSolde(c, 'initial'), b = attSoldeSolde(c, 'finale');
    out.apres2 = { aSolde: a.solde, aVerse: a.verse, aDate: a.dateSolde, aVs: a.vs.map(function (v) { return [v.montant_impute, !!v.partiel]; }), bSolde: b.solde, bVerse: b.verse };
    DATA.versements.push({ id: 'v3', client_id: 'c1', montant: 1500000, date: '2026-04-01', type: 'versement' });
    var b2 = attSoldeSolde(c, 'finale'), a2 = attSoldeSolde(c, 'initial');
    out.apres3 = { bSolde: b2.solde, bVerse: b2.verse, bDate: b2.dateSolde, bVs: b2.vs.length, aVerse: a2.verse };
    var s2 = attSoldeSolde(DATA.clients[1], 'initial'); out.sansModif = { solde: s2.solde, verse: s2.verse, vs: s2.vs.length };
    return out;
  });
  assert.deepEqual(r.apres2, { aSolde: true, aVerse: 5000000, aDate: '2026-02-10', aVs: [[3000000, false], [2000000, true]], bSolde: false, bVerse: 5500000 });
  assert.deepEqual(r.apres3, { bSolde: true, bVerse: 7000000, bDate: '2026-04-01', bVs: 3, aVerse: 5000000 });
  assert.deepEqual(r.sansModif, { solde: true, verse: 4100000, vs: 1 }, 'sans modification : comportement inchangé (versé total, surplus compris)');
});

test('préparation automatique : brouillon A au solde du prix initial, brouillon B au solde de la valeur finale ; numéros ATS / ATF distincts', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var c = DATA.clients[0], out = {}, tous = DATA.versements.slice();
    DATA.versements = tous.filter(function (v) { return v.id !== 'v3'; }); attSoldeAuto('c1');
    out.apres2 = { a: c.attestation_solde && c.attestation_solde.statut, b: !!c.attestation_solde_finale, numA: c.attestation_solde && c.attestation_solde.numero };
    DATA.versements = tous; attSoldeAuto('c1');
    out.apres3 = { b: c.attestation_solde_finale && c.attestation_solde_finale.statut, numB: c.attestation_solde_finale && c.attestation_solde_finale.numero };
    attSoldeAuto('c2'); out.c2 = { a: !!DATA.clients[1].attestation_solde, b: !!DATA.clients[1].attestation_solde_finale };
    return out;
  });
  assert.equal(r.apres2.a, 'brouillon'); assert.equal(r.apres2.b, false); assert.match(r.apres2.numA, /^ATS-\d{4}-0001$/);
  assert.equal(r.apres3.b, 'brouillon'); assert.match(r.apres3.numB, /^ATF-\d{4}-0001$/);
  assert.deepEqual(r.c2, { a: true, b: false }, 'sans modification : une seule attestation, comme avant');
});

test('document A : prix initial, mention de l\'attestation distincte ; document B : décomposition, valeur finale, tous les versements ; HTML des libellés inerte', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var c = DATA.clients[0], A = attSoldeHtml(c, { numero: 'ATS-1', date: '2026-10-14', kind: 'initial' }), B = attSoldeHtml(c, { numero: 'ATF-1', date: '2026-10-14', kind: 'finale' });
    var dA = new DOMParser().parseFromString(A, 'text/html'), dB = new DOMParser().parseFromString(B, 'text/html'), tA = dA.body.textContent, tB = dB.body.textContent;
    return { aTitre: dA.querySelector('h1').textContent, aSub: dA.querySelector('.sub').textContent, aPrix: /fixé à 5 000 000 FCFA/.test(tA.replace(/ | /g, ' ')), aDistincte: /attestation de solde distincte/.test(tA), aTotal: /Total imputé sur le prix initial/.test(tA), aPartiel: /le solde est imputé sur les modifications/.test(tA), aDecomp: /Décomposition/.test(tA),
      bTitre: dB.querySelector('h1').textContent, bDecomp: /Décomposition de la valeur du bien/.test(tB), bLignes: [].slice.call(dB.querySelectorAll('h3 + table tbody tr')).length, bPrixInit: /Prix initial du bien/.test(tB), bFinale: /Valeur finale du bien/.test(tB), bTotal: /fixé à 7 000 000 FCFA/.test(tB.replace(/ | /g, ' ')), bVers: /Total versé \(prix initial et modifications\)/.test(tB), bTerrasse: /Ajout d'une terrasse/.test(tB), bSurface: /Régularisation de surface/.test(tB), bNonFact: /Cloison/.test(tB),
      xss: dB.querySelectorAll('img, [onerror]').length };
  });
  assert.match(r.aTitre, /^ATTESTATION DE SOLDE$/); assert.match(r.aSub, /prix initial de vente/); assert.equal(r.aPrix, true); assert.equal(r.aDistincte, true); assert.equal(r.aTotal, true); assert.equal(r.aPartiel, true); assert.equal(r.aDecomp, false);
  assert.match(r.bTitre, /VALEUR FINALE DU BIEN/); assert.equal(r.bDecomp, true); assert.equal(r.bLignes >= 4, true); assert.equal(r.bPrixInit && r.bFinale && r.bTotal && r.bVers && r.bTerrasse && r.bSurface, true);
  assert.equal(r.bNonFact, false, 'une modification non facturée n\'est pas dans l\'attestation'); assert.equal(r.xss, 0);
});

test('circuit DG de l\'attestation B : demande, validation (type propre), document figé, annulation — sans toucher à l\'attestation A', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var c = DATA.clients[0]; attSoldeAuto('c1');
    // A validée
    await attSoldeDemander('c1', 'initial'); var vA = DATA.validations.filter(function (v) { return v.type === 'attestation_solde'; })[0]; await valDecide(vA.id, 'valide');
    var out = { aStatut: c.attestation_solde.statut };
    await attSoldeDemander('c1', 'finale');
    var vB = DATA.validations.filter(function (v) { return v.type === 'attestation_solde_finale'; })[0];
    out.vB = { libelle: vB.libelle, montant: vB.montant, statut: vB.statut, label: valTypeLabel(vB.type) };
    await valDecide(vB.id, 'valide'); out.vBApres = vB.statut;
    out.bStatut = c.attestation_solde_finale.statut; out.bHtml = /VALEUR FINALE DU BIEN/.test(c.attestation_solde_finale.html); out.aHtmlInitial = !/VALEUR FINALE/.test(c.attestation_solde.html);
    window.prompt = function () { return 'erreur'; }; await attSoldeAnnulerValidation('c1', 'finale');
    out.apresAnnul = { b: c.attestation_solde_finale.statut, a: c.attestation_solde.statut, vB: vB.statut, vA: vA.statut };
    var cellA = attSoldeCellule('c1', 'initial'), cellB = attSoldeCellule('c1', 'finale');
    out.cell = { aAvecModif: /Avec modif/.test(cellA), bBrouillon: /Soumettre au DG/.test(cellB), bFinaleArg: /attSoldeDemander\('c1','finale'\)/.test(cellB) };
    return out;
  });
  assert.equal(r.aStatut, 'valide'); assert.equal(r.vB.statut, 'en_attente'); assert.equal(r.vBApres, 'valide'); assert.match(r.vB.libelle, /^Attestation de solde \(valeur finale\) ATF-/); assert.equal(r.vB.montant, 7000000); assert.match(r.vB.label, /valeur finale/);
  assert.equal(r.bStatut, 'valide'); assert.equal(r.bHtml, true); assert.equal(r.aHtmlInitial, true);
  assert.deepEqual(r.apresAnnul, { b: 'brouillon', a: 'valide', vB: 'annule', vA: 'valide' });
  assert.equal(r.cell.bBrouillon, true); assert.equal(r.cell.bFinaleArg, true);
});

test('registre juridique, dossier et zone de la fiche : les deux attestations apparaissent ; une seule si le contrat n\'a aucune modification', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var L = attRegistreLignes(), zone1 = attSoldeZoneClient('c1'), zone2 = attSoldeZoneClient('c2');
    return { types1: L.filter(function (x) { return x.clientId === 'c1'; }).map(function (x) { return x.type + ':' + x.statut; }).sort(), types2: L.filter(function (x) { return x.clientId === 'c2'; }).map(function (x) { return x.type; }),
      zone1: [/valeur finale/i.test(zone1), /Quitus du prix initial/.test(zone1)], zone2finale: /valeur finale/i.test(zone2) };
  });
  assert.deepEqual(r.types1, ['solde:a_etablir', 'solde_finale:a_etablir']); assert.deepEqual(r.types2, ['solde']);
  assert.deepEqual(r.zone1, [true, true]); assert.equal(r.zone2finale, false);
});
