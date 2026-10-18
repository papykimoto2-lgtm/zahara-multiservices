/* Revue des écarts : fonds d'ouverture à justifier et alerte quotidienne des responsables. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

function amorcer(page) {
  return page.evaluate(() => {
    APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    DATA.caisses = [{ id: 'c1', nom: 'Caisse A' }];
    DATA.caisse_sessions = [
      { id: 's1', caisse_id: 'c1', date: '2026-10-01', statut: 'cloturee', fond_ouverture: 1000, fond_cloture_theorique: 1000, fond_cloture_reel: 1000, ecart: 0, ouverte_le: '2026-10-01T08:00:00Z', cloturee_le: '2026-10-01T18:00:00Z' },
      { id: 's2', caisse_id: 'c1', date: '2026-10-02', statut: 'cloturee', fond_ouverture: 4000, fond_cloture_theorique: 4000, fond_cloture_reel: 3500, ecart: -500, ouverte_par: 'Awa', ouverte_le: '2026-10-02T08:00:00Z', cloturee_le: '2026-10-02T18:00:00Z' },
      { id: 's3', caisse_id: 'c1', date: '2026-10-03', statut: 'cloturee', fond_ouverture: 3000, fond_cloture_theorique: 3000, fond_cloture_reel: 3000, ecart: 0, fond_ouverture_motif: 'Versement banque', ouverte_le: '2026-10-03T08:00:00Z', cloturee_le: '2026-10-03T18:00:00Z' }
    ];
    DATA.caisse_mouvements = []; window.syncToSupabase = () => {}; window.exigerDroit = () => true;
    try { localStorage.removeItem('caisse_alerte_dir'); } catch (e) {}
  });
}

test('fonds d\'ouverture à justifier : détection, justification, disparition de la liste', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async () => {
      const l = caisseRupturesAJustifier(), o = {};
      o.avant = l.map(x => [x.session.id, x.diff]);
      document.body.insertAdjacentHTML('beforeend', '<div id="caisse-ecarts-box"></div>'); caisseRenderEcarts();
      o.html = [/Fonds d'ouverture à justifier/.test(document.getElementById('caisse-ruptures-box').innerHTML), /Écarts de caisse à régulariser/.test(document.getElementById('caisse-ecarts-box').innerHTML)];
      window.prompt = () => ''; await caisseJustifierRupture('s2'); o.vide = !DATA.caisse_sessions[1].rupture_justification;
      window.prompt = () => 'Apport du gérant'; await caisseJustifierRupture('s2');
      o.apres = [caisseRupturesAJustifier().length, DATA.caisse_sessions[1].rupture_justification.texte, DATA.caisse_sessions[1].rupture_justification.par];
      return o;
    });
    assert.deepEqual(r.avant, [['s2', 3000]]);
    assert.deepEqual(r.html, [true, true]);
    assert.equal(r.vide, true);
    assert.deepEqual(r.apres, [0, 'Apport du gérant', 'Directeur']);
  } finally { await app.fermer(); }
});

test('alerte quotidienne : une fois par jour, responsables seulement', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(() => {
      const t = []; window.toast = (m) => t.push(m);
      const a1 = caisseAlerteQuotidienne(), a2 = caisseAlerteQuotidienne();
      APP.currentUser = { id: 'cai', nom: 'Caissière', role: 'caissiere' }; window.caisseRoleAdminLike = () => roleEstCaissiere() ? false : true; const a3 = caisseAlerteQuotidienne();
      return [a1, a2, a3, t.length, /1 écart\(s\) non régularisé\(s\)/.test(t[0] || ''), /1 fond\(s\) d'ouverture à justifier/.test(t[0] || '')];
    });
    assert.deepEqual(r, [{ ecarts: 1, ruptures: 1, net: -500 }, null, null, 1, true, true]);
  } finally { await app.fermer(); }
});
