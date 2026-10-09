const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Une session ouverte avec une entrée validée (+5000) et une sortie en attente (−2000). */
function donnees() {
  DATA.caisse_sessions = [{ id: 's1', caisse_id: 'c1', date: '2026-10-09', statut: 'ouverte', fond_ouverture: 1000,
    ouverte_par: 'T', ouverte_par_id: 'u1', ouverte_le: new Date(Date.now() - 50 * 3600000).toISOString() }];
  DATA.caisse_mouvements = [
    { id: 'm1', session_id: 's1', caisse_id: 'c1', type: 'entree', montant: 5000, requiert_validation: false, valide: true, numero: 'E1', motif: 'x' },
    { id: 'm2', session_id: 's1', caisse_id: 'c1', type: 'sortie', montant: 2000, requiert_validation: true, valide: false, numero: 'S1', motif: 'virement interne' }];
}

test('clôture : le comptage n\'est pas prérempli et une clôture sans montant est refusée', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (d) {
      eval('(' + d + ')')();
      caisseClôturerModal('c1');
      const vide = document.getElementById('ccl-fond-reel').value;
      document.getElementById('ccl-motif-attente').value = 'sortie en attente';
      await caisseCloturer();
      return { vide: vide, statut: DATA.caisse_sessions[0].statut };
    }, donnees.toString());
    assert.equal(r.vide, '');
    assert.equal(r.statut, 'ouverte');
  } finally { await app.fermer(); }
});

test('clôture : les mouvements en attente sont listés, exigent une précision, et l\'écart est donné des deux façons', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (d) {
      eval('(' + d + ')')();
      caisseClôturerModal('c1');
      const recap = document.getElementById('ccl-recap').textContent;
      const inp = document.getElementById('ccl-fond-reel');
      inp.value = '4000'; caisseUpdateEcartPreview();
      const apercu = document.getElementById('ccl-ecart').textContent;
      document.getElementById('ccl-motif-attente').value = '';
      await caisseCloturer();
      const sansMotif = DATA.caisse_sessions[0].statut;
      document.getElementById('ccl-motif-attente').value = 'sortie remise à la caisse principale';
      await caisseCloturer();
      const s = DATA.caisse_sessions[0];
      return { recap: recap, apercu: apercu, sansMotif: sansMotif, statut: s.statut, theo: s.fond_cloture_theorique, ecart: s.ecart, siValide: s.fond_cloture_si_valide };
    }, donnees.toString());
    assert.match(r.recap, /en attente de validation/);
    assert.match(r.recap, /2\s?000/);
    assert.match(r.apercu, /Écart si tout est validé/);
    assert.equal(r.sansMotif, 'ouverte');
    assert.equal(r.statut, 'cloturee');
    assert.equal(r.theo, 6000);
    assert.equal(r.ecart, -2000);
    assert.equal(r.siValide, 4000);
  } finally { await app.fermer(); }
});

test('validation après clôture : le solde théorique et l\'écart de la session sont recalculés', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (d) {
      eval('(' + d + ')')();
      caisseClôturerModal('c1');
      document.getElementById('ccl-fond-reel').value = '4000';
      document.getElementById('ccl-motif-attente').value = 'attente';
      await caisseCloturer();
      DATA.caisse_mouvements[1].valide = true;
      await caisseRecalculerSiCloturee(DATA.caisse_mouvements[1]);
      const s = DATA.caisse_sessions[0];
      return { theo: s.fond_cloture_theorique, ecart: s.ecart, motif: s.recalcule_motif };
    }, donnees.toString());
    assert.equal(r.theo, 4000);
    assert.equal(r.ecart, 0);
    assert.match(r.motif, /validé après la clôture/);
  } finally { await app.fermer(); }
});

test('session ancienne : alerte au-delà de 24 h et dans la fenêtre de clôture', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (d) {
      eval('(' + d + ')')();
      caisseClôturerModal('c1');
      return { anciennes: caisseSessionsAnciennes(24).length, banniere: caisseBanniereAnciennes().indexOf('plus de 24 h') !== -1,
        modal: document.getElementById('ccl-recap').textContent.indexOf('ouverte depuis') !== -1 };
    }, donnees.toString());
    assert.equal(r.anciennes, 1);
    assert.equal(r.banniere, true);
    assert.equal(r.modal, true);
  } finally { await app.fermer(); }
});
