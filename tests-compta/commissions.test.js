const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const commission = function (statut, extra) {
  return Object.assign({ id: 'c1', type_beneficiaire: 'commercial', beneficiaire: 'MENAN', client_id: 'cli1', client_nom: 'SAHARIAN', type_versement: 'souscription',
    montant_base: 500000, montant_comm: 50000, taux: 10, statut: statut, date_versement: '2026-02-20', versement_id: 'v1' }, extra || {});
};

test('commission annulée : aucune écriture n\'est générée, ni par la ligne ni par « Comptabiliser toutes »', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      DATA.commissions = [eval('(' + f + ')')('annulee', { ecriture_id: undefined })];
      await comptabiliserCommission(DATA.commissions[0], false);
      const apresLigne = DATA.ecritures.length;
      await comptabiliserToutesCommissions();
      return { apresLigne: apresLigne, apresToutes: DATA.ecritures.length, ecritureId: DATA.commissions[0].ecriture_id || null,
               badge: badgeComptaComm(DATA.commissions[0]), toasts: window.__toasts };
    }, commission.toString());
    assert.equal(r.apresLigne, 0);
    assert.equal(r.apresToutes, 0);
    assert.equal(r.ecritureId, null);
    assert.match(r.badge, /Annulée/);
    assert.ok(r.toasts.some(function (t) { return /Toutes les commissions sont déjà comptabilisées/.test(t); }), 'rien à comptabiliser');
  } finally { await app.fermer(); }
});

test('commission annulée : le badge ne ment pas même si le lien d\'écriture est conservé, et le paiement est refusé', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      const c = eval('(' + f + ')')('annulee', { ecriture_id: 'mt8kwrqpkxcx4', ecriture_ref: 'COMM-8202-0001' });
      DATA.commissions = [c];
      window.prompt = function () { return '1'; };
      await payerCommission('c1');
      return { statut: c.statut, badge: badgeComptaComm(c), ecr: DATA.ecritures.length, toasts: window.__toasts };
    }, commission.toString());
    assert.equal(r.statut, 'annulee');
    assert.match(r.badge, /Annulée/);
    assert.equal(r.ecr, 0);
    assert.ok(r.toasts.some(function (t) { return /annulée : paiement impossible/.test(t); }));
  } finally { await app.fermer(); }
});

test('commission à payer : toujours comptabilisée normalement', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      DATA.params.comptes_defaut = Object.assign(DATA.params.comptes_defaut, { comm_com_charge: '622', comm_com_provision: '467' });
      DATA.clients = [{ id: 'cli1', nom: 'SAHARIAN', programme_id: '' }]; DATA.programmes = [];
      const c = eval('(' + f + ')')('a_payer');
      DATA.commissions = [c];
      await comptabiliserCommission(c, true);
      return { ecriture: !!c.ecriture_id, nb: DATA.ecritures.length, debit: DATA.ecritures[0] && DATA.ecritures[0].compte_debit, credit: DATA.ecritures[0] && DATA.ecritures[0].compte_credit };
    }, commission.toString());
    assert.equal(r.ecriture, true);
    assert.equal(r.nb, 1);
    assert.equal(r.debit, '622');
    assert.equal(r.credit, '467');
  } finally { await app.fermer(); }
});
