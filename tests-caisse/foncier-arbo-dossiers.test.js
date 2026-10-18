/* Liste des dossiers : arborescence dossier global → titres individuels (déployer / réduire). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('arborescence : global + titres individuels groupés, réduire/déployer, orphelin, pagination par racines', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', programme_id: 'g1', statut: 'tf_definitif' }, { id: 'p2', ref: 'PARC-2', programme_id: 'g1' }];
    DATA.lots = [{ id: 'l1', numero: 'L1', parcelle_id: 'p1' }, { id: 'l2', numero: 'L2', parcelle_id: 'p1' }];
    DATA.clients = [{ id: 'c1', nom: 'Aminata Koné', lot_id: 'l1' }, { id: 'c2', nom: 'Jean Yao', lot_id: 'l2' }];
    DATA.users = [{ id: 'u1', nom: 'Resp', login: 'rf', role: 'admin' }]; window.userPeutSurStore = () => true; window.syncToSupabase = () => {}; APP.currentUser = { id: 'u1', nom: 'Resp', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'missions_foncieres'].forEach(s => { DATA[s] = []; }); APP._fcFiltreListe = {}; APP._fcPages = {}; APP._fcArbo = {};
    const g = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    const i1 = (await fcOuvrirDossierIndividuel({ lot_id: 'l1', responsable_id: 'u1' })).dossier, i2 = (await fcOuvrirDossierIndividuel({ lot_id: 'l2', responsable_id: 'u1' })).dossier;
    const seul = (await fcOuvrirDossier({ parcelle_id: 'p2', type: 'acd', responsable_id: 'u1' })).dossier;
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-liste-corps"></div>');
    const o = {}, lignes = () => [...document.querySelectorAll('#fc-liste-corps tbody tr')], vis = () => lignes().filter(t => t.style.display !== 'none').length;
    o.parent = [fcParentGlobal(i1) === g.id, fcParentGlobal(g) === '', fcParentGlobal(seul) === ''];
    fcRenderListeCorps(); let h = document.getElementById('fc-liste-corps').innerHTML;
    o.rendu = [lignes().length, vis(), document.querySelectorAll('tr[data-fcparent="' + g.id + '"]').length, /🌳 2 titres individuels/.test(h), /Tout déployer/.test(h), /Tout réduire/.test(h)];
    const ordre = lignes().map(t => t.className); o.ordre = [ordre.indexOf('fc-parent') < ordre.indexOf('fc-enfant'), ordre.filter(c => c === 'fc-enfant').length];
    fcArboBascule(g.id); o.reduit = [vis(), lignes().length, document.querySelector('tr[data-fcglob] .fc-arb-fl').textContent, fcArboReduit(g.id)];
    fcRenderListeCorps(); o.persiste = [vis(), document.querySelector('tr[data-fcglob] .fc-arb-fl').textContent];
    fcArboTout(true); o.deploye = [vis(), document.querySelector('tr[data-fcglob] .fc-arb-fl').textContent];
    fcArboTout(false); o.toutReduit = vis();
    fcArboTout(true);
    APP._fcFiltreListe = { q: 'Yao' }; fcRenderListeCorps(); o.orphelin = [lignes().length, document.querySelectorAll('tr[data-fcparent]').length, document.querySelectorAll('tr[data-fcglob]').length, /Tout déployer/.test(document.getElementById('fc-liste-corps').innerHTML)];
    APP._fcFiltreListe = { q: 'PARC-2' }; fcRenderListeCorps(); o.sansEnfants = [lignes().length, /Tout déployer/.test(document.getElementById('fc-liste-corps').innerHTML)];
    return o;
  });
  assert.deepEqual(r.parent, [true, true, true]);
  assert.deepEqual(r.rendu, [4, 4, 2, true, true, true]);
  assert.deepEqual(r.ordre, [true, 2]);
  assert.deepEqual(r.reduit, [2, 4, '▸', true]);
  assert.deepEqual(r.persiste, [2, '▸']);
  assert.deepEqual(r.deploye, [4, '▾']); assert.equal(r.toutReduit, 2);
  assert.deepEqual(r.orphelin, [1, 0, 0, false]);
  assert.deepEqual(r.sansEnfants, [1, false]);
  assert.deepEqual(app.etat.erreursPage, []);
});
