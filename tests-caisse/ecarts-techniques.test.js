/* Écarts TECHNIQUES : un écart dû à un défaut du logiciel corrigé depuis n'est ni un manquant ni un excédent.
   Il se qualifie (cause + correctif + auteur + date), ne se comptabilise jamais et sort des écarts réels. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function amorcer(page) {
  await page.evaluate(function () {
    const mk = function (id, ec) { return { id: id, caisse_id: 'c1', date: '2026-09-1' + id.slice(-1), statut: 'cloturee', fond_ouverture: 0, fond_cloture_theorique: 1000, fond_cloture_reel: 1000 + ec, ecart: ec }; };
    DATA.caisse_sessions = [mk('sA', 7043945), mk('sB', -1000000), mk('sC', -5000)];
    DATA.caisse_mouvements = [{ id: 'm1', session_id: 'sC', caisse_id: 'c1', type: 'sortie', montant: 5000, requiert_validation: true, valide: false }];
    DATA.ecritures = [];
    window.caisseSyncEtAlerter = async function () { return true; };
    window.__toasts = []; const t = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); try { t(m); } catch (e) {} };
  });
}
const MOTIF = 'Fond d\'ouverture hérité d\'une clôture avant correction';
const REF = 'Correctif du 08/08/2026 — fond d\'ouverture';

test('qualifier un écart technique : tracé, hors écarts réels, aucune écriture comptable', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    app.etat.prompts.push(MOTIF, REF);
    const r = await app.page.evaluate(async function () {
      const avant = _caisseEcartsEnAttente().length, aff = caisseEcartNonRegularise();
      await caisseQualifierEcartTechnique('sA');
      const s = DATA.caisse_sessions.find(function (x) { return x.id === 'sA'; });
      caisseRenderEcarts();
      return { avant: avant, apres: _caisseEcartsEnAttente().length, tech: _caisseEcartsTechniques().length, ecr: DATA.ecritures.length,
        trace: s.ecart_technique, reel: caisseEcartReel(s), nonReg: [aff, caisseEcartNonRegularise()],
        html: document.getElementById('caisse-ecarts-box').textContent.replace(/\s+/g, ' ') };
    });
    assert.equal(r.avant, 3);
    assert.equal(r.apres, 2);
    assert.equal(r.tech, 1);
    assert.equal(r.ecr, 0);
    assert.equal(r.trace.montant, 7043945);
    assert.equal(r.trace.motif, MOTIF);
    assert.equal(r.trace.reference_correctif, REF);
    assert.equal(r.trace.par, 'Comptable Test');
    assert.ok(r.trace.le);
    assert.equal(r.reel, 0);
    assert.equal(r.nonReg[0] - r.nonReg[1], 7043945);            /* le cumul des écarts réels baisse du montant technique */
    assert.match(r.html, /Écarts techniques/);
    assert.match(r.html, /Correctif du 08\/08\/2026/);
  } finally { await app.fermer(); }
});

test('écart technique : cause et correctif obligatoires', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    app.etat.prompts.push('court');                         /* < 10 caractères : refusé avant la 2e question */
    app.etat.prompts.push(MOTIF, '');                       /* correctif vide */
    const r = await app.page.evaluate(async function () {
      await caisseQualifierEcartTechnique('sA');
      await caisseQualifierEcartTechnique('sA');
      return { tech: !!DATA.caisse_sessions[0].ecart_technique, toasts: window.__toasts };
    });
    assert.equal(r.tech, false);
    assert.ok(r.toasts.some(function (t) { return /au moins 10 caractères/.test(t); }));
    assert.ok(r.toasts.some(function (t) { return /référence du correctif est obligatoire/.test(t); }));
  } finally { await app.fermer(); }
});

test('écart technique : jamais comptabilisé, ni seul ni par la régularisation en masse', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    app.etat.prompts.push(MOTIF, REF);
    await app.page.evaluate(async function () { await caisseQualifierEcartTechnique('sA'); });
    app.etat.prompts.push('REGULARISER', 'Perte constatée, pièces conservées');
    const r = await app.page.evaluate(async function () {
      const direct = await genererEcritureEcartCaisse(DATA.caisse_sessions[0], 'x');
      await caisseRegulariserEcart('sA');
      await caisseRegulariserTousEcarts();
      return { direct: direct, ecr: DATA.ecritures.map(function (e) { return e.id + ':' + e.montant; }),
        regA: !!DATA.caisse_sessions[0].ecart_regularise, regB: !!DATA.caisse_sessions[1].ecart_regularise, toasts: window.__toasts };
    });
    assert.equal(r.direct, null);
    assert.deepEqual(r.ecr, ['ecr_ecart_sB:1000000']);       /* seul l'écart réel sB (sC est en attente de validation) */
    assert.equal(r.regA, false);
    assert.equal(r.regB, true);
    assert.ok(r.toasts.some(function (t) { return /qualifié de technique/.test(t); }));
  } finally { await app.fermer(); }
});

test('annuler la qualification : l\'écart redevient réel, historique conservé', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    app.etat.prompts.push(MOTIF, REF, 'Cause non confirmée');
    const r = await app.page.evaluate(async function () {
      await caisseQualifierEcartTechnique('sA');
      await caisseAnnulerEcartTechnique('sA');
      const s = DATA.caisse_sessions[0];
      return { tech: !!s.ecart_technique, histo: (s.ecart_technique_historique || []).map(function (h) { return h.annule_motif + '|' + h.motif; }), enAttente: _caisseEcartsEnAttente().length };
    });
    assert.equal(r.tech, false);
    assert.deepEqual(r.histo, ['Cause non confirmée|' + MOTIF]);
    assert.equal(r.enAttente, 3);
  } finally { await app.fermer(); }
});

test('écart déjà régularisé : ne peut plus être qualifié ; rapprochement et état mensuel distinguent les écarts techniques', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    app.etat.prompts.push(MOTIF, REF, MOTIF, REF);
    const r = await app.page.evaluate(async function () {
      DATA.caisse_sessions[1].ecart_regularise = true;
      await caisseQualifierEcartTechnique('sB');
      const refus = !DATA.caisse_sessions[1].ecart_technique;
      await caisseQualifierEcartTechnique('sA');
      const rap = caisseCalculerRapprochement('c1');
      return { refus: refus, somme: rap.sommeEcarts, tech: rap.sommeEcartsTechniques, toasts: window.__toasts };
    });
    assert.equal(r.refus, true);
    assert.equal(r.tech, 7043945);
    assert.equal(r.somme, 7043945 - 1000000 - 5000);
    assert.ok(r.toasts.some(function (t) { return /déjà régularisé/.test(t); }));
  } finally { await app.fermer(); }
});
