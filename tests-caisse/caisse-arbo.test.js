/* Tableaux de la caisse en arborescence : Caisse ▸ Mois, repliables, état mémorisé. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('arborescence Caisse ▸ Mois : écarts et fonds à justifier, déployer/réduire, état conservé', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(() => {
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; APP._caArbo = {};
      DATA.caisses = [{ id: 'c1', nom: 'Caisse A' }, { id: 'c2', nom: 'Caisse B' }];
      DATA.caisse_sessions = [];
      for (let i = 0; i < 20; i++) { const j = String(1 + (i % 28)).padStart(2, '0'), m = i < 10 ? '09' : '10';
        DATA.caisse_sessions.push({ id: 's' + i, caisse_id: i % 2 ? 'c2' : 'c1', date: '2026-' + m + '-' + j, statut: 'cloturee', fond_ouverture: 0, fond_cloture_theorique: 1000, fond_cloture_reel: 900, ecart: -100, ouverte_le: '2026-' + m + '-' + j + 'T0' + (i % 9) + ':00:00Z', cloturee_le: '2026-' + m + '-' + j + 'T18:00:00Z' }); }
      DATA.caisse_mouvements = [];
      document.body.insertAdjacentHTML('beforeend', '<div id="caisse-ecarts-box"></div>'); caisseRenderEcarts();
      const box = document.getElementById('caisse-ecarts-box'), arbo = box.querySelector('[data-caarbo="ecart"]'), o = {};
      const n1 = () => [...arbo.querySelectorAll(':scope > details')], n2 = () => [...arbo.querySelectorAll('details details')];
      o.structure = [n1().length, n2().length, box.querySelectorAll('[data-caarbo="ecart"] tbody tr').length, /Caisse A/.test(n1()[0].querySelector('summary').textContent), /octobre 2026/.test(box.textContent), /net -1\s000 F/.test(n1()[0].querySelector('summary').textContent)];
      o.replie = n1().every(d => !d.open);
      caisseArboTout('ecart', true); o.deploye = [...arbo.querySelectorAll('details')].every(d => d.open);
      caisseRenderEcarts(); o.conserve = [...document.querySelectorAll('[data-caarbo="ecart"] details')].every(d => d.open);
      o.ruptures = !!document.querySelector('#caisse-ruptures-box [data-caarbo="rupture"]');
      return o;
    });
    assert.deepEqual(r.structure, [2, 4, 20, true, true, true]);
    assert.equal(r.replie, true); assert.equal(r.deploye, true); assert.equal(r.conserve, true); assert.equal(r.ruptures, true);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});

test('arborescence des mouvements en attente : regroupés par caisse avec totaux entrées/sorties', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(() => {
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; APP._caArbo = {}; window.userPeut = () => true;
      DATA.caisses = [{ id: 'c1', nom: 'Caisse A' }];
      DATA.caisse_sessions = [{ id: 's1', caisse_id: 'c1', date: '2026-10-18', statut: 'ouverte', fond_ouverture: 5000 }];
      DATA.caisse_mouvements = [
        { id: 'm1', session_id: 's1', caisse_id: 'c1', type: 'sortie', montant: 300, requiert_validation: true, valide: false, date: '2026-10-18', numero: 'S1', motif: 'Transport' },
        { id: 'm2', session_id: 's1', caisse_id: 'c1', type: 'entree', montant: 1000, requiert_validation: true, valide: false, date: '2026-10-18', numero: 'E1', motif: 'Versement' }];
      document.body.insertAdjacentHTML('beforeend', '<div id="caisse-validation-box"></div>'); caisseRenderValidations();
      const box = document.getElementById('caisse-validation-box');
      return [!!box.querySelector('[data-caarbo="val"]'), box.querySelectorAll('[data-caarbo="val"] tbody tr').length, /↑ 1\s000 F · ↓ 300 F/.test(box.querySelector('[data-caarbo="val"] summary').textContent), !!box.querySelector('button[onclick*="caisseValiderDecaissement"]')];
    });
    assert.deepEqual(r, [true, 2, true, true]);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
