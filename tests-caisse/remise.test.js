const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function amorcer(page) {
  await page.evaluate(function () {
    DATA.caisse_sessions = [{ id: 's1', caisse_id: 'c1', date: new Date().toISOString().slice(0, 10), statut: 'ouverte', fond_ouverture: 500000, ouverte_par: 'Comptable Test', ouverte_par_id: 'u1', ouverte_le: new Date(Date.now() - 2 * 3600000).toISOString() }];
    DATA.caisse_mouvements = [];
    window.__remplir = function (piece, montant) {
      document.getElementById('cb-date').value = new Date().toISOString().slice(0, 10);
      document.getElementById('cb-montant').value = montant || '300000';
      document.getElementById('cb-beneficiaire').value = 'UBA HOLDING';
      document.getElementById('cb-piece').value = piece;
    };
  });
}

test('remise en banque : pièce obligatoire, bon marqué « à confirmer », signalé en bannière', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      caisseRemiseModal('c1', 'banque');
      const motifInitial = document.getElementById('cb-motif').value;
      __remplir('', '300000'); await caisseSaveBon();
      const sansPiece = DATA.caisse_mouvements.length;
      __remplir('BV-2026-118', '300000'); await caisseSaveBon();
      const m = DATA.caisse_mouvements[0];
      return { motifInitial: motifInitial, sansPiece: sansPiece, type: m && m.remise_type, aConfirmer: m && m.remise_a_confirmer, piece: m && m.piece_ref,
        banniere: caisseBanniereRemises().indexOf('Remises à confirmer') !== -1, validation: m && m.requiert_validation, remiseApres: CAISSE_UI._remise };
    });
    assert.match(r.motifInitial, /^Remise en banque/);
    assert.equal(r.sansPiece, 0);
    assert.equal(r.type, 'banque');
    assert.equal(r.aConfirmer, true);
    assert.equal(r.piece, 'BV-2026-118');
    assert.equal(r.banniere, true);
    assert.equal(r.validation, true);          /* la remise suit aussi la validation habituelle */
    assert.equal(r.remiseApres, null);
  } finally { await app.fermer(); }
});

test('remise : un bon ordinaire n\'est jamais marqué comme remise', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      caisseRemiseModal('c1', 'direction'); CAISSE_UI._remise = null;
      caisseOuvrirBonModal('c1', 'sortie');
      document.getElementById('cb-motif').value = 'Carburant'; __remplir('', '5000');
      await caisseSaveBon();
      const m = DATA.caisse_mouvements[0];
      return { n: DATA.caisse_mouvements.length, remise: m && m.remise_type, aConfirmer: m && m.remise_a_confirmer };
    });
    assert.equal(r.n, 1);
    assert.equal(r.remise, undefined);
    assert.equal(r.aConfirmer, undefined);
  } finally { await app.fermer(); }
});

test('remise : la réception est confirmée par une autre personne, avec la référence de la preuve', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    await app.page.evaluate(async function () {
      caisseRemiseModal('c1', 'direction'); __remplir('RECU-77', '250000'); await caisseSaveBon();
    });
    const memePersonne = await app.page.evaluate(async function () {
      const m = DATA.caisse_mouvements[0]; await caisseConfirmerRemise(m.id); return m.remise_a_confirmer;
    });
    assert.equal(memePersonne, true);          /* l'auteur ne peut pas confirmer sa propre remise */
    app.etat.prompts = [''];
    const sansPreuve = await app.page.evaluate(async function () {
      APP.currentUser = { id: 'u2', nom: 'Responsable Direction', role: 'comptable' };
      const m = DATA.caisse_mouvements[0]; await caisseConfirmerRemise(m.id); return m.remise_a_confirmer;
    });
    assert.equal(sansPreuve, true);
    app.etat.prompts = ['Accusé signé DG du 09/10'];
    const r = await app.page.evaluate(async function () {
      const m = DATA.caisse_mouvements[0]; await caisseConfirmerRemise(m.id);
      return { aConfirmer: m.remise_a_confirmer, par: m.remise_confirmee_par, preuve: m.remise_preuve, banniere: caisseBanniereRemises() };
    });
    assert.equal(r.aConfirmer, false);
    assert.equal(r.par, 'Responsable Direction');
    assert.equal(r.preuve, 'Accusé signé DG du 09/10');
    assert.equal(r.banniere, '');
  } finally { await app.fermer(); }
});

test('clôture : un écart doit être expliqué ; aucun motif si le comptage égale le solde « si tout est validé »', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const cloturer = async function (montant, expl) {
        caisseClôturerModal('c1');
        document.getElementById('ccl-fond-reel').value = String(montant); caisseUpdateEcartPreview();
        const visible = document.getElementById('ccl-explication-box').style.display === '';
        document.getElementById('ccl-explication').value = expl || '';
        await caisseCloturer();
        return { visible: visible, statut: DATA.caisse_sessions[0].statut };
      };
      const ecartSansExpl = await cloturer(480000, '');       /* 500 000 attendus : −20 000 */
      const ecartAvecExpl = await cloturer(480000, 'Remise en banque de 20 000 non saisie');
      return { ecartSansExpl: ecartSansExpl, ecartAvecExpl: ecartAvecExpl, explication: DATA.caisse_sessions[0].ecart_explication };
    });
    assert.equal(r.ecartSansExpl.visible, true);
    assert.equal(r.ecartSansExpl.statut, 'ouverte');
    assert.equal(r.ecartAvecExpl.statut, 'cloturee');
    assert.match(r.explication, /Remise en banque/);
    const exact = await app.page.evaluate(async function () {
      DATA.caisse_sessions = [{ id: 's2', caisse_id: 'c1', date: new Date().toISOString().slice(0, 10), statut: 'ouverte', fond_ouverture: 500000, ouverte_par: 'T', ouverte_par_id: 'u1', ouverte_le: new Date(Date.now() - 3600000).toISOString() }];
      DATA.caisse_mouvements = [{ id: 'x', session_id: 's2', caisse_id: 'c1', type: 'sortie', montant: 20000, requiert_validation: true, valide: false, numero: 'S9', motif: 'attente' }];
      caisseClôturerModal('c1');
      document.getElementById('ccl-fond-reel').value = '480000'; caisseUpdateEcartPreview();
      const visible = document.getElementById('ccl-explication-box').style.display === '';
      document.getElementById('ccl-motif-attente').value = 'sortie en attente de validation';
      await caisseCloturer();
      return { visible: visible, statut: DATA.caisse_sessions[0].statut };
    });
    assert.equal(exact.visible, false);        /* l'écart s'explique par le mouvement en attente */
    assert.equal(exact.statut, 'cloturee');
  } finally { await app.fermer(); }
});
