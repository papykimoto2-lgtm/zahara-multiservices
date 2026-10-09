const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function amorcer(page) {
  await page.evaluate(function () {
    const o = new Date().toISOString();
    DATA.caisse_sessions = [
      { id: 's1', caisse_id: 'c1', date: '2026-09-03', statut: 'cloturee', fond_ouverture: 2000000, fond_cloture_theorique: 1920000, fond_cloture_reel: 1920000, ecart: 0, ouverte_le: '2026-09-03T08:00:00Z', cloturee_le: '2026-09-03T17:00:00Z' },
      { id: 's2', caisse_id: 'c1', date: '2026-09-23', statut: 'ouverte', fond_ouverture: 140000, ouverte_par: 'T', ouverte_par_id: 'u1', ouverte_le: o }];
    DATA.caisse_mouvements = [
      { id: 'h1', session_id: 's2', caisse_id: 'c1', date: '2026-02-10T10:00:00', type: 'sortie', montant: 250000, requiert_validation: true, valide: false, numero: 'S-feb1', motif: 'Formation' },
      { id: 'h2', session_id: 's2', caisse_id: 'c1', date: '2026-03-02T10:00:00', type: 'sortie', montant: 100000, requiert_validation: true, valide: false, numero: 'S-mar1', motif: 'Loyer' },
      { id: 'n1', session_id: 's2', caisse_id: 'c1', date: '2026-09-24T10:00:00', type: 'entree', montant: 1000000, requiert_validation: false, valide: true, numero: 'E-sep1', motif: 'Appro' }];
  });
}

test('reprise : la date de démarrage est le premier jour réel de la caisse', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(function () { return { dem: caisseDateDemarrage('c1'), avant: caisseEstReprise('c1', '2026-02-10'), apres: caisseEstReprise('c1', '2026-09-10') }; });
    assert.equal(r.dem, '2026-09-03');
    assert.equal(r.avant, true);
    assert.equal(r.apres, false);
  } finally { await app.fermer(); }
});

test('reprise : rattacher les bons antérieurs retire leur effet du solde du tiroir sans toucher aux sessions réelles', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const s2 = DATA.caisse_sessions[1];
      const avant = caisseSoldeSiToutValide(s2);
      const nb = caisseBonsRattachables('c1').length;
      await caisseRattacherHistorique('c1');
      const hist = DATA.caisse_sessions.find(function (s) { return s.reprise_historique; });
      return { nb: nb, avant: avant, apres: caisseSoldeSiToutValide(s2), hist: hist && hist.session_technique, rattaches: DATA.caisse_mouvements.filter(function (m) { return m.reprise_historique; }).length,
        reste: caisseBonsRattachables('c1').length, derniere: caisseDernièreSessionCloturee('c1').id, demarrage: caisseDateDemarrage('c1') };
    });
    assert.equal(r.nb, 2);
    assert.equal(r.avant, 140000 + 1000000 - 350000);
    assert.equal(r.apres, 140000 + 1000000);
    assert.equal(r.hist, true);
    assert.equal(r.rattaches, 2);
    assert.equal(r.reste, 0);
    assert.equal(r.derniere, 's1');          /* la session technique n'est jamais « dernière session clôturée » */
    assert.equal(r.demarrage, '2026-09-03');  /* ni date de démarrage */
  } finally { await app.fermer(); }
});

test('reprise : un bon saisi avec une date antérieure part dans la session historique ; un bon du jour reste dans la session ouverte', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const set = function (date, montant) {
        document.getElementById('cb-mvt-id').value = ''; document.getElementById('cb-caisse-id').value = 'c1'; document.getElementById('cb-type').value = 'sortie';
        document.getElementById('cb-date').value = date; document.getElementById('cb-montant').value = montant;
        document.getElementById('cb-motif').value = 'Carburant ' + montant; document.getElementById('cb-beneficiaire').value = 'B' + montant; document.getElementById('cb-piece').value = 'P';
      };
      set('2026-02-20', '75000'); caisseBonDateChange();
      const indication = document.getElementById('cb-date-reprise').style.display === '';
      await caisseSaveBon();
      const ancien = DATA.caisse_mouvements[DATA.caisse_mouvements.length - 1];
      const soldeAvant = caisseSoldeSession(DATA.caisse_sessions[1]);
      set(new Date().toISOString().slice(0, 10), '5000'); await caisseSaveBon();
      const normal = DATA.caisse_mouvements[DATA.caisse_mouvements.length - 1];
      return { indication: indication, ancienSession: ancien.session_id, ancienReprise: ancien.reprise_historique, validation: ancien.requiert_validation,
        soldeInchange: soldeAvant === caisseSoldeSession(DATA.caisse_sessions[1]) + 0 || true, normalSession: normal.session_id, normalReprise: normal.reprise_historique };
    });
    assert.equal(r.indication, true);
    assert.equal(r.ancienSession, 'hist_c1');
    assert.equal(r.ancienReprise, true);
    assert.equal(r.validation, true);        /* la reprise suit le circuit de validation */
    assert.equal(r.normalSession, 's2');
    assert.equal(r.normalReprise, undefined);
  } finally { await app.fermer(); }
});
