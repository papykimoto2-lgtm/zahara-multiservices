/* Correctifs écarts de caisse (revue du 18/10/2026) : validation après clôture, rattachement, solde négatif, bons antidatés. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

function amorcer(page, ouverte) {
  return page.evaluate(function (ouverte) {
    const auj = new Date().toISOString().slice(0, 10), clot = new Date(Date.now() - 3 * 3600000).toISOString();
    DATA.caisses = [{ id: 'c1', nom: 'Caisse A' }];
    DATA.caisse_sessions = [{ id: 's1', caisse_id: 'c1', date: auj, statut: 'cloturee', fond_ouverture: 1000, fond_cloture_theorique: 1000, fond_cloture_reel: 1000, ecart: 0, ouverte_le: new Date(Date.now() - 8 * 3600000).toISOString(), cloturee_le: clot }];
    if (ouverte) DATA.caisse_sessions.push({ id: 's2', caisse_id: 'c1', date: auj, statut: 'ouverte', fond_ouverture: 1000, ouverte_par: 'T', ouverte_le: new Date(Date.now() - 3600000).toISOString() });
    DATA.caisse_mouvements = [{ id: 'm1', session_id: 's1', caisse_id: 'c1', type: 'sortie', montant: 400, requiert_validation: true, valide: false, numero: 'S1', motif: 'Transport' }];
    window.syncToSupabase = () => {};
  }, !!ouverte);
}

test('validé après clôture avec une session ouverte : rattaché à la session ouverte, session close inchangée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, true);
    const r = await app.page.evaluate(async () => {
      const m = DATA.caisse_mouvements[0]; m.valide = true; m.valide_le = new Date().toISOString();
      await caisseRecalculerSiCloturee(m);
      const s1 = DATA.caisse_sessions[0], s2 = DATA.caisse_sessions[1];
      return [m.session_id, m.session_precedente, !!m.valide_apres_cloture, s1.fond_cloture_theorique, s1.ecart, caisseSoldeSession(s2)];
    });
    assert.deepEqual(r, ['s2', 's1', true, 1000, 0, 600]);
  } finally { await app.fermer(); }
});

test('validé après clôture, tiroir compté AVEC l\'argent : la session close est recalculée (écart résorbé)', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, true);
    const r = await app.page.evaluate(async () => {
      const s1 = DATA.caisse_sessions[0]; s1.fond_cloture_reel = 600; s1.ecart = -400;
      const m = DATA.caisse_mouvements[0]; m.valide = true; m.valide_le = new Date().toISOString();
      await caisseRecalculerSiCloturee(m);
      return [m.session_id, s1.fond_cloture_theorique, s1.ecart, /déjà présent/.test(s1.recalcule_motif)];
    });
    assert.deepEqual(r, ['s1', 600, 0, true]);
  } finally { await app.fermer(); }
});

test('mouvement en attente de session : rattaché à la prochaine ouverture', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, false);
    const r = await app.page.evaluate(async () => {
      const m = DATA.caisse_mouvements[0]; m.valide = true; m.valide_le = new Date().toISOString();
      await caisseRecalculerSiCloturee(m);
      const avant = [m.session_id, m.en_attente_session];
      const s2 = { id: 's2', caisse_id: 'c1', date: new Date().toISOString().slice(0, 10), statut: 'ouverte', fond_ouverture: 1000 }; DATA.caisse_sessions.push(s2);
      const n = await caisseRattacherEnAttente(s2);
      return [avant, n, m.session_id, m.en_attente_session === undefined, caisseSoldeSession(s2)];
    });
    assert.deepEqual(r, [['', true], 1, 's2', true, 600]);
  } finally { await app.fermer(); }
});

test('bon antidaté : détecté par rapport au jour de la session ouverte', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, true);
    const r = await app.page.evaluate(() => {
      const auj = DATA.caisse_sessions[1].date, hier = new Date(Date.now() - 86400000 * 5).toISOString().slice(0, 10);
      return [caisseBonAntidate('c1', hier), caisseBonAntidate('c1', auj), caisseBonAntidate('cX', hier)];
    });
    assert.deepEqual(r, [true, false, false]);
  } finally { await app.fermer(); }
});

test('validation d\'une sortie au-delà du solde disponible : refusée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, true);
    const r = await app.page.evaluate(async () => {
      APP.currentUser = { id: 'v', nom: 'Valideur', role: 'admin' }; window.confirm = () => true; window.exigerDroit = () => true; window.exigerPlafond = () => true;
      const m = { id: 'm9', session_id: 's2', caisse_id: 'c1', type: 'sortie', montant: 5000, requiert_validation: true, valide: false, numero: 'S9', motif: 'Gros achat', cree_par_id: 'autre' };
      DATA.caisse_mouvements.push(m);
      await caisseValiderDecaissement('m9');
      return [m.valide, caisseSoldeSession(DATA.caisse_sessions[1])];
    });
    assert.deepEqual(r, [false, 1000]);
  } finally { await app.fermer(); }
});
