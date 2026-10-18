/* Caisse : validations, écarts et fonds d'ouverture à justifier présentés en onglets. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('trois tableaux en onglets : compteurs, bascule, choix conservé, onglets vides masqués', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async () => {
      const attendre = () => new Promise(f => setTimeout(f, 0));
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; APP._caSuivi = null;
      DATA.caisses = [{ id: 'c1', nom: 'Caisse A' }];
      DATA.caisse_sessions = [
        { id: 's1', caisse_id: 'c1', date: '2026-10-01', statut: 'cloturee', fond_ouverture: 0, fond_cloture_theorique: 1000, fond_cloture_reel: 1000, ecart: 0, ouverte_le: '2026-10-01T08:00:00Z', cloturee_le: '2026-10-01T18:00:00Z' },
        { id: 's2', caisse_id: 'c1', date: '2026-10-02', statut: 'cloturee', fond_ouverture: 1500, fond_cloture_theorique: 1500, fond_cloture_reel: 1400, ecart: -100, ouverte_le: '2026-10-02T08:00:00Z', cloturee_le: '2026-10-02T18:00:00Z' }];
      DATA.caisse_mouvements = [{ id: 'm1', caisse_id: 'c1', session_id: 's2', type: 'sortie', montant: 50, requiert_validation: true, date: '2026-10-02T10:00:00', numero: 'BS-1' }];
      document.body.insertAdjacentHTML('beforeend', '<div id="caisse-suivi"><div id="caisse-suivi-tabs"></div><div id="caisse-validation-box"></div><div id="caisse-ecarts-box"></div><div id="caisse-ruptures-box"></div></div>');
      const vis = id => document.getElementById(id).style.display !== 'none';
      const etat = () => ({ onglets: [...document.querySelectorAll('#caisse-suivi-tabs .tab-btn')].map(b => b.dataset.cs + ':' + b.textContent.replace(/\D/g, '')), actif: (document.querySelector('#caisse-suivi-tabs .tab-btn.active') || {}).dataset?.cs, vis: ['caisse-validation-box', 'caisse-ecarts-box', 'caisse-ruptures-box'].map(vis), barre: vis('caisse-suivi-tabs') });
      const o = {};
      caisseRenderValidations(); caisseRenderEcarts(); await attendre(); o.init = etat();
      document.querySelector('#caisse-suivi-tabs [data-cs="rupture"]').click(); o.bascule = etat();
      caisseRenderEcarts(); await attendre(); o.conserve = etat().actif;
      DATA.caisse_mouvements = []; DATA.caisse_sessions[1].fond_ouverture = 1000; caisseRenderValidations(); caisseRenderEcarts(); await attendre(); o.seul = etat();
      return o;
    });
    assert.deepEqual(r.init, { onglets: ['val:1', 'ecart:1', 'rupture:1'], actif: 'val', vis: [true, false, false], barre: true });
    assert.deepEqual(r.bascule.vis, [false, false, true]);
    assert.equal(r.bascule.actif, 'rupture');
    assert.equal(r.conserve, 'rupture');
    assert.deepEqual(r.seul, { onglets: ['ecart:1'], actif: 'ecart', vis: [false, true, false], barre: false });
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
