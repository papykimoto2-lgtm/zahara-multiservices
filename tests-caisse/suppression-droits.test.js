const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* La suppression est réservée à admin et manager. Un rôle « admin-like » sans ce droit (comptable) doit voir un REFUS,
   jamais un faux message de réussite, et rien ne doit être modifié avant ce refus (ex. demande d'achat remise en « validée »). */
async function amorcer(page, role) {
  await page.evaluate(function (role) {
    APP.currentUser = Object.assign({}, APP.currentUser || {}, { id: 'u9', nom: 'Test', role: role });
    DATA.caisses = [{ id: 'cx', nom: 'CAISSE X', caissiere_ids: [] }];
    DATA.caisse_sessions = [{ id: 'sx', caisse_id: 'cx', date: '2026-10-01', statut: 'cloturee', fond_ouverture: 0, cloturee_le: '2026-10-01T18:00:00Z' }];
    DATA.caisse_mouvements = [{ id: 'mx', session_id: 'sx', caisse_id: 'cx', type: 'entree', montant: 5000, numero: 'BE-1', date: '2026-10-01', da_id: 'da1' }];
    DATA.fiches_engagement_depense = [{ id: 'da1', statut: 'decaissee', mouvement_caisse_id: 'mx' }];
    DATA.ecritures = DATA.ecritures || [];
    window.__msgs = []; window.toast = function (m) { window.__msgs.push(String(m)); };
    window.confirm = function () { return true; };
  }, role);
}

test('comptable : supprimer une caisse est refusé, sans faux message de réussite', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, 'comptable');
    const r = await app.page.evaluate(async function () {
      await caisseSupprimerCaisse('cx');
      return { msgs: window.__msgs, caisse: DATA.caisses.length, mvts: DATA.caisse_mouvements.length, sess: DATA.caisse_sessions.length };
    });
    assert.equal(r.caisse, 1); assert.equal(r.mvts, 1); assert.equal(r.sess, 1);
    assert.ok(!r.msgs.some(function (m) { return /supprimée|vidée/.test(m); }), 'aucun faux succès : ' + JSON.stringify(r.msgs));
    assert.ok(r.msgs.some(function (m) { return /réservée|ne permet pas/.test(m); }));
  } finally { await app.fermer(); }
});

test('comptable : supprimer un mouvement est refusé et ne touche pas à la demande d\'achat liée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, 'comptable');
    const r = await app.page.evaluate(async function () {
      await caisseSupprimerMouvement('mx');
      var da = DATA.fiches_engagement_depense[0];
      return { msgs: window.__msgs, mvts: DATA.caisse_mouvements.length, daStatut: da.statut, daMvt: da.mouvement_caisse_id || null };
    });
    assert.equal(r.mvts, 1); assert.equal(r.daStatut, 'decaissee'); assert.equal(r.daMvt, 'mx');
    assert.ok(!r.msgs.some(function (m) { return /Mouvement supprimé/.test(m); }));
  } finally { await app.fermer(); }
});

test('comptable : _caisseDelMvt refuse avant tout effet de bord (renvoie false)', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, 'comptable');
    const r = await app.page.evaluate(async function () {
      var res = await _caisseDelMvt(DATA.caisse_mouvements[0]);
      return { res: res, daStatut: DATA.fiches_engagement_depense[0].statut, mvts: DATA.caisse_mouvements.length };
    });
    assert.equal(r.res, false); assert.equal(r.daStatut, 'decaissee'); assert.equal(r.mvts, 1);
  } finally { await app.fermer(); }
});

test('administrateur : la suppression d\'une caisse fonctionne toujours', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, 'admin');
    const r = await app.page.evaluate(async function () {
      await caisseSupprimerCaisse('cx');
      return { msgs: window.__msgs, caisse: DATA.caisses.length, mvts: DATA.caisse_mouvements.length, sess: DATA.caisse_sessions.length };
    });
    assert.equal(r.caisse, 0); assert.equal(r.mvts, 0); assert.equal(r.sess, 0);
    assert.ok(r.msgs.some(function (m) { return /supprimée/.test(m); }), JSON.stringify(r.msgs));
  } finally { await app.fermer(); }
});

test('boutons « Vider » et « Supprimer la caisse » : visibles pour l\'administrateur seulement', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page, 'comptable');
    const compta = await app.page.evaluate(function () { caisseRenderListe(); return document.getElementById('caisse-liste').innerHTML; });
    await amorcer(app.page, 'admin');
    const admin = await app.page.evaluate(function () { caisseRenderListe(); return document.getElementById('caisse-liste').innerHTML; });
    assert.ok(!/caisseSupprimerCaisse|caisseViderCaisse/.test(compta), 'comptable : boutons masqués');
    assert.ok(/caisseSupprimerCaisse/.test(admin) && /caisseViderCaisse/.test(admin), 'admin : boutons présents');
  } finally { await app.fermer(); }
});
