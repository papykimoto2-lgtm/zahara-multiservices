const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Régression : la division d'un versement ne venait que de client.lot_id. Un souscripteur sans lot principal
   (multi-lots, programme seul) produisait des versements sans division, sortis des divisions. */
function jeu() {
  DATA.programmes = [{ id: 'p1', division_id: 'd1' }, { id: 'p2', division_id: 'd2' }];
  DATA.lots = [{ id: 'l1', programme_id: 'p1' }, { id: 'l2', programme_id: 'p2' }];
}

test('Division du versement : lot principal prioritaire', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function (j) { eval('(' + j + ')')(); return _divisionClientVersement({ lot_id: 'l1', lot_ids: ['l2'], programme_id: 'p2' }); }, jeu.toString());
    assert.equal(r, 'd1');
  } finally { await app.fermer(); }
});

test('Division du versement : sans lot principal, premier lot supplémentaire', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function (j) { eval('(' + j + ')')(); return _divisionClientVersement({ lot_ids: ['l2'] }); }, jeu.toString());
    assert.equal(r, 'd2');
  } finally { await app.fermer(); }
});

test('Division du versement : sans aucun lot, programme du souscripteur', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function (j) { eval('(' + j + ')')(); return _divisionClientVersement({ programme_id: 'p1' }); }, jeu.toString());
    assert.equal(r, 'd1');
  } finally { await app.fermer(); }
});

test('Division du versement : souscripteur sans rattachement → vide, pas d\'erreur', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function (j) { eval('(' + j + ')')(); return [_divisionClientVersement({}), _divisionClientVersement(null)]; }, jeu.toString());
    assert.deepEqual(r, ['', '']);
  } finally { await app.fermer(); }
});

test('Écriture de versement : porte la division même sans lot principal', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (j) {
      eval('(' + j + ')')();
      DATA.params = DATA.params || {};
      DATA.params.comptes_defaut = Object.assign({}, DATA.params.comptes_defaut, { client_lots: '419' });
      DATA.clients = [{ id: 'c1', nom: 'X', programme_id: 'p1' }];
      const e = await genererEcritureVersement({ id: 'v1', client_id: 'c1', date: '2026-03-01', montant: 1000, mode: 'especes', type: 'apport' });
      return e.division;
    }, jeu.toString());
    assert.equal(r, 'd1');
  } finally { await app.fermer(); }
});
