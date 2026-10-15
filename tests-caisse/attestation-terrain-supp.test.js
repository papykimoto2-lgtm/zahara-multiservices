/* Attestation de solde : le terrain supplémentaire est un supplément ultérieur (ligne distincte, hors prix initial). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  await page.evaluate(function () {
    window.syncToSupabase = function () {}; window.toast = function (m) { (window.__t = window.__t || []).push(m); }; window.dbPut = async function () { return true; };
    window.clientLierDossierJuridique = async function () { return null; }; window.exigerDroit = function () { return true; }; window.hasRole = function () { return true; };
    APP.currentUser = { id: 'dg', nom: 'DG', role: 'admin' };
    DATA.params = { societe: 'ZMS Sarl' }; DATA.audit_log = [];
    DATA.lots = [{ id: 'l1', numero: '12' }];
    DATA.clients = [{ id: 'c1', nom: 'BENDE', prenoms: 'Michel', dossier: 'SS675', montant_total: 7000000, lot_id: 'l1', lot_ids: ['l1'],
      demandes_modification: [{ id: 't1', description: 'Terrasse', date: '2026-03-01', facture: true, montant_facture: 1500000 }],
      terrains_supplementaires: [{ id: 'ts1', date: '2026-04-01', surface_m2: 40, prix_m2: 25000, montant: 1000000, lot_libelle: '12' }] },
      { id: 'c2', nom: 'KONE', dossier: 'SS1', montant_total: 4000000,
        terrains_supplementaires: [{ id: 'ts2', date: '2026-05-01', montant: 500000 }] }];
    DATA.versements = [{ id: 'v1', client_id: 'c1', montant: 7000000, date: '2026-01-10', type: 'versement' }, { id: 'v2', client_id: 'c2', montant: 4000000, date: '2026-01-10', type: 'versement' }];
    DATA.dossiersJuridiques = [];
  });
}

test('prix initial exclut le terrain supplémentaire ; la valeur finale et le détail l\'incluent', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var P = attSoldePrix(DATA.clients[0]), P2 = attSoldePrix(DATA.clients[1]);
    return { initial: P.initial, total: P.total, natures: P.modifs.map(function (m) { return m.nature; }), lib: P.modifs[1].libelle, appl2: attSoldeApplicable(DATA.clients[1], 'finale'), initial2: P2.initial,
      soldeIni: attSoldeSolde(DATA.clients[0], 'initial').prix, soldeFin: attSoldeSolde(DATA.clients[0], 'finale').prix };
  });
  assert.equal(r.initial, 4500000); assert.equal(r.total, 7000000);
  assert.deepEqual(r.natures, ['Travaux modificatifs', 'Terrain supplémentaire']);
  assert.match(r.lib, /40 m² × .*25.?000 FCFA\/m² — lot 12/);
  assert.equal(r.appl2, true); assert.equal(r.initial2, 3500000);
  assert.equal(r.soldeIni, 4500000); assert.equal(r.soldeFin, 7000000);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('facturation : motif obligatoire, montant du contrat augmenté, audit ; « déjà inclus » ne double pas le montant', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var set = function (id, v) { document.getElementById(id).value = v; }, out = {};
    APP.editingId = 'c2'; ouvrirTerrainSupplementaire();
    set('ts2-surface', '20'); set('ts2-prix-m2', '30000'); ts2Recalculer(); out.montantAuto = document.getElementById('ts2-montant').value;
    set('ts2-motif', ''); await confirmerTerrainSupplementaire(); out.sansMotif = DATA.clients[1].terrains_supplementaires.length;
    set('ts2-motif', 'Parcelle contiguë demandée'); await confirmerTerrainSupplementaire();
    var c = DATA.clients[1]; out.nb = c.terrains_supplementaires.length; out.total = c.montant_total; out.supp = c.superficie_supplementaire;
    out.audit = DATA.audit_log.filter(function (e) { return e.entite_id === 'c2'; }).length; out.initial = attSoldePrix(c).initial;
    ouvrirTerrainSupplementaire(); set('ts2-montant', '100000'); set('ts2-motif', 'Rattrapage'); document.getElementById('ts2-deja').checked = true; await confirmerTerrainSupplementaire();
    out.totalApresDeja = DATA.clients[1].montant_total; out.initialApresDeja = attSoldePrix(DATA.clients[1]).initial;
    return out;
  });
  assert.equal(r.montantAuto, '600000'); assert.equal(r.sansMotif, 1);
  assert.equal(r.nb, 2); assert.equal(r.total, 4600000); assert.equal(r.supp, 20); assert.equal(r.audit, 1); assert.equal(r.initial, 3500000);
  assert.equal(r.totalApresDeja, 4600000); assert.equal(r.initialApresDeja, 3500000 - 100000 + 0);
  assert.deepEqual(app.etat.erreursPage, []);
});
