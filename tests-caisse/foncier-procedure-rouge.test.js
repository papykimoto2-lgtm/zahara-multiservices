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

test('dossier général (ACD classique) : aucune étape en rouge', async () => {
  const app = await ouvrirApp();
  const n = await app.page.evaluate(async () => {
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = [{ id: 'u1', nom: 'R', login: 'r' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'u1', nom: 'R', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>');
    fcRenderDetail(d.id);
    return document.querySelectorAll('#fc-detail span[title*="procédure d\'immatriculation"]').length;
  });
  assert.equal(n, 0);
});
