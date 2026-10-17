/* Dossier foncier › Étapes : arborescence par phase (replier / déplier, tout déployer / tout réduire, état conservé). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('phases repliables, tout réduire / déployer, état conservé au rafraîchissement', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }];
    DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }];
    DATA.lots = []; DATA.clients = [];
    DATA.users = [{ id: 'u1', nom: 'R', login: 'r' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'u1', nom: 'R', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div>');
    fcRenderDetail(d.id);
    const vis = () => [].filter.call(document.querySelectorAll('#fc-detail tr[data-fcph]'), t => t.style.display !== 'none').length;
    const total = document.querySelectorAll('#fc-detail tr[data-fcph]').length;
    const phases = document.querySelectorAll('#fc-detail tr[data-fcphh]').length;
    const out = { total, phases, ouvert: vis() };
    fcPhasesTout(d.id, false); out.reduit = vis();
    fcPhasesTout(d.id, true); out.deploye = vis();
    const ph0 = document.querySelector('#fc-detail tr[data-fcphh]').getAttribute('data-fcphh');
    const n0 = document.querySelectorAll('#fc-detail tr[data-fcph="' + ph0 + '"]').length;
    fcPhaseBascule(d.id, ph0); out.unePhase = total - vis(); out.n0 = n0;
    fcRenderDetail(d.id);   // rafraîchissement : l'état persiste
    out.apres = vis();
    out.flèche = document.querySelector('#fc-detail tr[data-fcphh="' + ph0 + '"] .fc-ph-fl').textContent;
    return out;
  });
  assert.ok(r.phases >= 2); assert.equal(r.ouvert, r.total); assert.equal(r.reduit, 0); assert.equal(r.deploye, r.total);
  assert.equal(r.unePhase, r.n0); assert.equal(r.apres, r.total - r.n0); assert.equal(r.flèche, '▸');
  assert.deepEqual(app.etat.erreursPage, []);
});
