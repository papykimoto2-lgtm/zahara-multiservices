/* Dossier foncier : le détail est organisé en onglets (une seule section visible), sans perdre les panneaux ni leurs identifiants. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async () => {
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville' }];
    DATA.users = [{ id: 'u1', nom: 'Resp', login: 'r' }];
    window.userPeutSurStore = () => true; window.syncToSupabase = () => {};
    APP.currentUser = { id: 'u1', nom: 'Resp', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-root"></div>');
    fcRender(); fcOuvrirDetail(d.id);
    return d.id;
  });
}

test('le détail du dossier est en onglets : un seul visible, bascule, état conservé au rafraîchissement', async () => {
  const app = await ouvrirApp(); const id = await preparer(app.page);
  const r = await app.page.evaluate((id) => {
    const tabs = [...document.querySelectorAll('#fc-detail [data-fcon]')].map(b => b.getAttribute('data-fcon'));
    const visibles = () => [...document.querySelectorAll('#fc-detail .fc-pane.on')].map(p => p.getAttribute('data-fcpane'));
    const avant = visibles();
    const tableCachee = !!document.querySelector('#fc-detail .fc-pane[data-fcpane="etapes"] table');
    fcOnglet('etapes'); const apres = visibles();
    fcRenderDetail(id); const conserve = visibles();
    return { tabs, avant, apres, conserve, tableCachee, nbEtapes: document.querySelectorAll('#fc-detail .fc-pane[data-fcpane="etapes"] tbody tr').length };
  }, id);
  assert.ok(r.tabs.includes('synthese') && r.tabs.includes('etapes') && r.tabs.includes('suivi'));
  assert.deepEqual(r.avant, ['synthese']); assert.deepEqual(r.apres, ['etapes']); assert.deepEqual(r.conserve, ['etapes']);
  assert.ok(r.tableCachee && r.nbEtapes > 3);
  assert.equal(app.etat.erreursPage.length, 0, app.etat.erreursPage.join('\n'));
});

test('« Ouvrir un dossier » est repliable', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  assert.equal(await app.page.evaluate(() => { const d = [...document.querySelectorAll('#fc-root details')].find(x => /Ouvrir un dossier/.test(x.textContent)); return !!d && !d.open; }), true);
});
