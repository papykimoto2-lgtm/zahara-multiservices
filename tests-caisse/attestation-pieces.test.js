/* Attestation de solde : le DG consulte les pièces justificatives (versements, reçus, bons de caisse, écritures) avant de valider. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function amorcer(page) {
  return page.evaluate(async function () {
    window.syncToSupabase = function () {}; window.toast = function () {};
    window.attLierJuridique = async function () { return null; }; window.attSoldeRafraichirUI = function () {};
    window.hasRole = function (r) { return r === 'admin'; };
    APP.currentUser = { id: 'dg', nom: 'DG', role: 'admin' };
    DATA.programmes = [{ id: 'p1', nom: 'Programme Test' }];
    DATA.clients = [{ id: 'c1', nom: 'BENDE', prenoms: 'X', dossier: 'D-1', programme_id: 'p1', montant_total: 1000000, attestation_solde: { numero: 'ATS-2026-001', statut: 'brouillon', date_brouillon: '2026-10-01' } }];
    DATA.versements = [
      { id: 'v1', client_id: 'c1', ref: 'REC-1', date: '2026-09-01', montant: 600000, mode: 'especes', objet: 'Valeur initiale logement', type: 'apport' },
      { id: 'v2', client_id: 'c1', ref: 'REC-2', date: '2026-09-10', montant: 400000, mode: 'virement', reference: '', objet: 'Valeur initiale logement', type: 'mensualite' }];
    DATA.caisse_mouvements = [{ id: 'm1', versement_id: 'v1', numero: 'BE-571-1', requiert_validation: true, valide: false }];
    DATA.ecritures = [{ id: 'ecr_vrs_v1' }];
    DATA.validations = [];
    await attSoldeDemander('c1');
  });
}

test('pièces : les versements retenus sont présentés avec leur preuve et les anomalies sont signalées', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(function () {
      var c = DATA.clients[0], D = attSoldePiecesDonnees(c, 'initial'), h = attSoldePiecesHtml(c, 'initial');
      return { n: D.lignes.length, anomalies: D.anomalies, caisse: D.lignes[0].caisse, ecr: D.lignes.map(function (l) { return l.ecriture; }), pb2: D.lignes[1].problemes,
        h: { recu: /REC-1/.test(h), bon: /BE-571-1 — en attente de validation/.test(h), alerte: /2 versement\(s\) à vérifier/.test(h), solde: /est soldé/.test(h) } };
    });
    assert.equal(r.n, 2); assert.equal(r.anomalies, 2);
    assert.equal(r.caisse, 'BE-571-1 — en attente de validation');
    assert.deepEqual(r.ecr, ['oui', 'manquante']);
    assert.ok(r.pb2.indexOf('Aucune référence (chèque, virement…)') !== -1 && r.pb2.indexOf('Écriture comptable introuvable') !== -1);
    assert.deepEqual(r.h, { recu: true, bon: true, alerte: true, solde: true });
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});

test('pièces : validation sans consultation → confirmation demandée ; refus = rien ne change ; après consultation, aucune demande', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    app.etat.confirm = false;
    const refus = await app.page.evaluate(async function () { var v = DATA.validations[0]; await valDecide(v.id, 'valide'); return [v.statut, DATA.clients[0].attestation_solde.statut]; });
    assert.deepEqual(refus, ['en_attente', 'en_attente']);
    assert.ok(app.etat.dialogues.some(function (d) { return /pièces justificatives/.test(d); }));
    app.etat.confirm = true; app.etat.dialogues.length = 0;
    const apres = await app.page.evaluate(async function () {
      window.open = function () { return { document: { write: function () {}, close: function () {} } }; };
      attSoldePieces('c1', 'initial');
      var v = DATA.validations[0]; await valDecide(v.id, 'valide'); return v.statut;
    });
    assert.equal(apres, 'valide');
    assert.ok(!app.etat.dialogues.some(function (d) { return /pièces justificatives/.test(d); }), 'pas de demande après consultation');
  } finally { await app.fermer(); }
});
