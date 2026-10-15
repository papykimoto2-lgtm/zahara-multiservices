/* Foncier Connect — liste des dossiers en cartes sur mobile (SUP2). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('liste des dossiers : cartes empilées sur mobile, tableau sur ordinateur', async () => {
  const app = await ouvrirApp(); const page = app.page;
  await page.evaluate(async () => {
    window.syncToSupabase = function () {}; window.toast = function () {}; window.dbPut = async function () { return true; };
    DATA.programmes = [{ id: 'g1', nom: 'R', division_id: 'dv1' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', programme_id: 'g1', statut: 'tf_definitif' }];
    DATA.users = [{ id: 'u1', nom: 'Resp', login: 'rf', role: 'admin' }];
    ['dossiers_fonciers', 'evenements_fonciers'].forEach(function (s) { DATA[s] = []; });
    APP.currentUser = { id: 'u1', nom: 'Resp', role: 'admin' };
    await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' });
    var h = document.createElement('div'); h.id = 'fc-liste-corps'; h.style.width = '100%'; document.body.appendChild(h);
    fcRenderListeCorps();
  });
  const lire = () => page.evaluate(() => {
    var tr = document.querySelector('#fc-liste-corps tbody tr'), th = document.querySelector('#fc-liste-corps thead');
    return { tr: getComputedStyle(tr).display, thead: getComputedStyle(th).display, labels: Array.from(tr.querySelectorAll('td[data-label]')).map(function (t) { return t.getAttribute('data-label'); }), larg: tr.getBoundingClientRect().width, vp: window.innerWidth };
  });
  await page.setViewportSize({ width: 390, height: 800 });
  const m = await lire();
  assert.equal(m.tr, 'block'); assert.equal(m.thead, 'none');
  assert.deepEqual(m.labels, ['Référence', 'Parcelle', 'Procédure', 'Statut', 'Étape courante', 'Responsable', 'Échéance']);
  assert.ok(m.larg <= m.vp, 'carte dans l’écran');
  await page.setViewportSize({ width: 1280, height: 800 });
  const b = await lire(); assert.equal(b.tr, 'table-row'); assert.notEqual(b.thead, 'none');
  assert.deepEqual(app.etat.erreursPage, []);
});
