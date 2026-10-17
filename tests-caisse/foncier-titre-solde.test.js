/* Titre individuel : réservé aux souscripteurs ayant soldé ; valeur du bien et montant versé affichés. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.params.fc_titre_solde_requis = true;
    DATA.programmes = [{ id: 'g1', nom: 'Résidence' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', programme_id: 'g1', statut: 'tf_definitif' }];
    DATA.lots = [{ id: 'l1', numero: 'L1', parcelle_id: 'p1' }, { id: 'l2', numero: 'L2', parcelle_id: 'p1' }];
    DATA.clients = [{ id: 'c1', nom: 'Soldé', lot_id: 'l1', montant_total: 1000000 }, { id: 'c2', nom: 'En cours', lot_id: 'l2', montant_total: 2000000 }];
    DATA.versements = [{ id: 'v1', client_id: 'c1', montant: 1000000, type: 'apport', date: '2026-01-01' }, { id: 'v2', client_id: 'c2', montant: 500000, type: 'mensualite', date: '2026-01-01' }];
    DATA.users = [{ id: 'u1', nom: 'Resp', login: 'rf' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(function (s) { DATA[s] = []; });
    window.syncToSupabase = function () {};
    await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' });
  });
}

test('seul le souscripteur soldé obtient un titre', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r2 = await app.page.evaluate(() => fcOuvrirDossierIndividuel({ lot_id: 'l2' }));
  assert.equal(r2.ok, false); assert.equal(r2.non_solde, true);
  assert.equal((await app.page.evaluate(() => fcOuvrirDossierIndividuel({ lot_id: 'l1' }))).ok, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('ouverture en lot : uniquement les soldés ; valeur et versé exposés', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => { const o = await fcOuvrirIndividuelsEnLot('p1'); return { o, l: fcLotsDeParcelle('p1').map(x => [fcLibelleLot(x.lot), x.solde, x.valeur, x.verse]), s: fcSyntheseOperation('p1') }; });
  assert.equal(r.o.ouverts, 1); assert.equal(r.o.echecs.length, 0);
  assert.deepEqual(r.l, [['L1', true, 1000000, 1000000], ['L2', false, 2000000, 500000]]);
  assert.equal(r.s.non_soldes, 1);
});

test('panneau : colonnes valeur / versé et reste à solder', async () => {
  const app = await ouvrirApp(); const { g } = { g: null }; await preparer(app.page);
  const h = await app.page.evaluate(() => fcPanneauTitresIndividuels(fcDossierGlobal('p1')));
  assert.match(h, /Valeur du bien/); assert.match(h, /Montant versé/); assert.match(h, /à solder/); assert.match(h, /Créer le titre/);
});
