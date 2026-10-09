const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Deux caisses ouvertes : c1 (source, 1 000 000) et c2 (destinataire). */
async function amorcer(page) {
  await page.evaluate(function () {
    const o = new Date().toISOString();
    DATA.caisses = [{ id: 'c1', nom: 'CENTRALE', compte: '571' }, { id: 'c2', nom: 'AGRO', compte: '572' }];
    DATA.caisse_sessions = [
      { id: 's0', caisse_id: 'c2', date: '2026-09-03', statut: 'cloturee', fond_ouverture: 0, fond_cloture_theorique: 0, fond_cloture_reel: 0, ecart: 0, ouverte_le: '2026-09-03T08:00:00Z', cloturee_le: '2026-09-03T17:00:00Z' },
      { id: 's1', caisse_id: 'c1', date: o.slice(0, 10), statut: 'ouverte', fond_ouverture: 1000000, ouverte_par: 'T', ouverte_par_id: 'u1', ouverte_le: o },
      { id: 's2', caisse_id: 'c2', date: o.slice(0, 10), statut: 'ouverte', fond_ouverture: 0, ouverte_par: 'T', ouverte_par_id: 'u1', ouverte_le: o }];
    DATA.caisse_mouvements = [];
    DATA.demandes_reappro = [{ id: 'd1', numero: 'REAP-T1', statut: 'validee', caisse_id: 'c2', montant_demande: 100000, montant_accorde: 100000, demande_par: 'X', valide_par: 'Y' }];
    window.reapRender = function () {};
    window.caisseSnapshotAvantMasse = async function () {};
  });
}

test('service d\'une demande de réapprovisionnement : refusé si le numéro de bon existe déjà, accepté sinon', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      DATA.caisse_mouvements = [{ id: 'dup', session_id: 's2', caisse_id: 'c2', type: 'entree', montant: 1, numero: 'BE-DUP', requiert_validation: false, valide: true }];
      const prochain = window.caisseProchainNumero;
      window.caisseProchainNumero = async function () { return 'BE-DUP'; };
      document.getElementById('rsv-id').value = 'd1';
      document.getElementById('rsv-source').innerHTML = '<option value="c1">CENTRALE</option>'; document.getElementById('rsv-source').value = 'c1';
      document.getElementById('rsv-justif').value = '';
      await reapServirConfirmer();
      const refus = { statut: DATA.demandes_reappro[0].statut, n: DATA.caisse_mouvements.length };
      window.caisseProchainNumero = prochain;
      await reapServirConfirmer();
      return { refus: refus, statut: DATA.demandes_reappro[0].statut, n: DATA.caisse_mouvements.length };
    });
    assert.deepEqual(r.refus, { statut: 'validee', n: 1 });   /* rien n'a été créé, la demande reste à servir */
    assert.equal(r.statut, 'servie');
    assert.equal(r.n, 3);                                      /* bon d'entrée + bon de sortie liés */
  } finally { await app.fermer(); }
});

test('import CSV : une ligne datée d\'avant le démarrage part en reprise d\'historique, une ligne du jour dans la session ouverte', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const jour = new Date().toISOString().slice(0, 10);
      document.getElementById('cim-caisse-id').value = 'c2';
      window._cimRows = [
        { valide: true, ligneNum: 2, brut: 'a', l: { date: '2026-02-10', entree: 0, sortie: 12000, piece: 'P1', libelle: 'Carburant février' } },
        { valide: true, ligneNum: 3, brut: 'b', l: { date: jour, entree: 50000, sortie: 0, piece: 'P2', libelle: 'Appro du jour' } }];
      await caisseImportCSVConfirmer();
      const anc = DATA.caisse_mouvements.find(function (m) { return m.motif === 'Carburant février'; });
      const auj = DATA.caisse_mouvements.find(function (m) { return m.motif === 'Appro du jour'; });
      return { ancSession: anc && anc.session_id, ancReprise: anc && anc.reprise_historique, aujSession: auj && auj.session_id, aujReprise: auj && auj.reprise_historique,
        validation: anc && anc.requiert_validation, soldeOuverte: caisseSoldeSession(DATA.caisse_sessions.find(function (s) { return s.id === 's2'; })) };
    });
    assert.equal(r.ancSession, 'hist_c2');
    assert.equal(r.ancReprise, true);
    assert.equal(r.aujSession, 's2');
    assert.equal(r.aujReprise, undefined);
    assert.equal(r.validation, true);
    assert.equal(r.soldeOuverte, 0);        /* la ligne de reprise ne touche pas le solde du tiroir ; celle du jour attend sa validation */
  } finally { await app.fermer(); }
});

test('import CSV : une ligne refusée par les contrôles de saisie n\'est pas créée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      window.caisseGardeNouveauMouvement = function () { return 'refus de test'; };
      document.getElementById('cim-caisse-id').value = 'c2';
      window._cimRows = [{ valide: true, ligneNum: 2, brut: 'a', l: { date: new Date().toISOString().slice(0, 10), entree: 1000, sortie: 0, piece: 'P9', libelle: 'Ligne refusée' } }];
      await caisseImportCSVConfirmer();
      return DATA.caisse_mouvements.length;
    });
    assert.equal(r, 0);
  } finally { await app.fermer(); }
});

test('virement : avertissement si la caisse destinataire a une demande ouverte que ce virement ne solde pas', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const virement = function (montant) {
      document.getElementById('ct-source-id').value = 'c1';
      const sel = document.getElementById('ct-destination'); sel.innerHTML = '<option value="c2">AGRO</option>'; sel.value = 'c2';
      document.getElementById('ct-date').value = new Date().toISOString().slice(0, 10); document.getElementById('ct-motif').value = 'appro';
      document.getElementById('ct-montant').value = montant;
    };
    app.etat.confirm = false;
    const refus = await app.page.evaluate(async function (f) { eval('(' + f + ')')('55000'); await caisseTransfererFonds(); return DATA.caisse_mouvements.length; }, virement.toString());
    assert.equal(refus, 0);
    assert.ok(app.etat.dialogues.some(function (d) { return /demande\(s\) de réapprovisionnement encore ouverte/.test(d); }));
    app.etat.confirm = true;
    const accepte = await app.page.evaluate(async function (f) { eval('(' + f + ')')('55000'); await caisseTransfererFonds(); return { n: DATA.caisse_mouvements.length, statut: DATA.demandes_reappro[0].statut }; }, virement.toString());
    assert.equal(accepte.n, 2);
    assert.equal(accepte.statut, 'validee');   /* un virement indépendant ne solde pas la demande */
    app.etat.dialogues.length = 0;
    const lie = await app.page.evaluate(async function (f) { eval('(' + f + ')')('100000'); await caisseTransfererFonds(); return DATA.demandes_reappro[0].statut; }, virement.toString());
    assert.equal(lie, 'servie');
    assert.ok(!app.etat.dialogues.some(function (d) { return /ne correspond à aucune/.test(d); }));   /* pas de double avertissement quand le lien est proposé */
  } finally { await app.fermer(); }
});
