/* Éditeur « Modèles de mission » : pastilles par type, cartes repliables, résumé en direct. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('éditeur de modèles de mission : pastilles, cartes repliées, résumé en direct, tout déployer', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    DATA.params.fc_modeles_mission = undefined; DATA.users = [{ id: 'u1', nom: 'Dir', role: 'admin' }]; APP.currentUser = { id: 'u1', nom: 'Dir', role: 'admin' }; window.syncToSupabase = () => {};
    document.body.insertAdjacentHTML('beforeend', '<div id="fi-root"></div>'); APP._fmmType = 'geometre'; fcRenderIntervenants();
    const o = {}, cartes = () => document.querySelectorAll('#fmm-corps .fmm-l');
    o.pastilles = document.querySelectorAll('#fi-root button[aria-pressed]').length === Object.keys(FC_TYPES_INTERVENANT).length;
    o.cartes = [cartes().length, [...cartes()].every(d => !d.open), /⏱ 21 j/.test(cartes()[0].querySelector('.fmm-r').innerHTML)];
    fcModelesMissionTout(true); o.deploye = [...cartes()].every(d => d.open); fcModelesMissionTout(false); o.replie = [...cartes()].every(d => !d.open);
    const c = cartes()[0]; c.querySelector('.f-lib').value = 'Bornage express'; c.querySelector('.f-delai').value = '7'; fcMajResumeModele(c);
    o.resume = [/Bornage express/.test(c.querySelector('.fmm-r').innerHTML), /⏱ 7 j/.test(c.querySelector('.fmm-r').innerHTML)];
    fcModeleMissionType('notaire'); o.type = [APP._fmmType, document.querySelectorAll('#fmm-corps .fmm-l').length];
    document.getElementById('fmm-corps').insertAdjacentHTML('beforeend', fcLigneModeleMissionHtml({})); o.nouveauOuvert = [...cartes()].pop().open;
    return o;
  });
  assert.equal(r.pastilles, true); assert.deepEqual(r.cartes, [5, true, true]); assert.equal(r.deploye, true); assert.equal(r.replie, true);
  assert.deepEqual(r.resume, [true, true]); assert.deepEqual(r.type, ['notaire', 4]); assert.equal(r.nouveauOuvert, true);
  assert.deepEqual(app.etat.erreursPage, []);
});
