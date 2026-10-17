/* Étapes issues de la procédure d'immatriculation fournie (17/10/2026) : repérées en rouge dans le dossier et dans les modèles. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('dossier immatriculation urbaine : étapes et phases de la procédure en rouge, étapes générales non marquées', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }];
    DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }];
    DATA.lots = []; DATA.clients = [];
    DATA.users = [{ id: 'u1', nom: 'R', login: 'r' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'u1', nom: 'R', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'immatriculation_urbaine', responsable_id: 'u1' })).dossier;
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>');
    fcRenderDetail(d.id);
    const rouges = document.querySelectorAll('#fc-detail span[style*="#c0392b"][title*="procédure"]').length;
    const urb = d.etapes.filter(e => /^urb_/.test(e.code)).length;
    return { urb, rouges, phases: [].filter.call(document.querySelectorAll('#fc-detail tr[data-fcphh]'), t => /^U/.test(t.getAttribute('data-fcphh')) && t.querySelector('span[style*="#c0392b"]')).length };
  });
  assert.ok(r.urb > 40);
  assert.ok(r.rouges >= r.urb, 'chaque étape de la procédure est en rouge');
  assert.ok(r.phases >= 5);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('dossier standard (ACD) : seules les étapes qui correspondent à la procédure fournie sont en rouge, phases A-E non rouges', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = [{ id: 'u1', nom: 'R', login: 'r' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'u1', nom: 'R', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>');
    fcRenderDetail(d.id);
    const lignes = [].map.call(document.querySelectorAll('#fc-detail tr.fc-proc'), t => t.getAttribute('data-fcph'));
    const attendues = d.etapes.filter(e => FC_CORRESP_PROC[e.code]).length;
    const titres = [].map.call(document.querySelectorAll('#fc-detail tr.fc-proc span[title]'), x => x.getAttribute('title')).join('|');
    return { rouges: lignes.length, attendues, titres, phasesRouges: [].filter.call(document.querySelectorAll('#fc-detail tr[data-fcphh]'), t => t.querySelector('span[style*="#c0392b"]')).length,
             libres: d.etapes.filter(e => !FC_CORRESP_PROC[e.code]).length, total: document.querySelectorAll('#fc-detail tr[data-fcph]').length };
  });
  assert.ok(r.attendues >= 5); assert.equal(r.rouges, r.attendues);
  assert.match(r.titres, /Correspond à une étape de la procédure d'immatriculation fournie/);
  assert.equal(r.phasesRouges, 0); assert.ok(r.total > r.rouges, 'les autres étapes restent non marquées');
  assert.deepEqual(app.etat.erreursPage, []);
});
