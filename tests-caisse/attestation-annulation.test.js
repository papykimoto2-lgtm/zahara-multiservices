/* Attestation de solde : annulation d'une validation faite par erreur, puis nouvelle soumission au DG. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    window.syncToSupabase = function () {}; window.toast = function (m) { (window.__toasts = window.__toasts || []).push(m); };
    window.attSoldeSolde = function () { return { solde: true, prix: 1000000, verse: 1000000, dateSolde: '2026-01-01' }; };
    window.attSoldeHtml = function (c, o) { return '<html>ATT ' + o.numero + '</html>'; };
    window.attLierJuridique = async function () { return null; }; window.attSoldeRafraichirUI = function () {};
    window.hasRole = function (r) { return r === 'admin'; };
    APP.currentUser = { id: 'dg', nom: 'DG', role: 'admin' };
    DATA.validations = []; DATA.clients = [{ id: 'c1', nom: 'BENDE', prenoms: 'X', dossier: 'D-1', attestation_solde: { numero: 'ATS-2026-001', statut: 'brouillon', date_brouillon: '2026-10-01', publie_portail: false } }];
    await attSoldeDemander('c1');
    var v = DATA.validations[0]; await valDecide(v.id, 'valide');
    var c = DATA.clients[0]; c.attestation_solde.publie_portail = true; c.attestation_solde.wa_envoye_le = '2026-10-14';
    return { statut: c.attestation_solde.statut };
  });
}

test('validée par erreur : annulation avec motif → brouillon, même numéro, retirée du portail, journal conservé', async () => {
  const app = await ouvrirApp(); const av = await preparer(app.page);
  assert.equal(av.statut, 'valide');
  const r = await app.page.evaluate(async function () {
    window.prompt = function () { return 'Validée par erreur'; };
    await attSoldeAnnulerValidation('c1');
    var a = DATA.clients[0].attestation_solde, v = DATA.validations[0];
    return { statut: a.statut, numero: a.numero, publie: a.publie_portail, html: a.html || null, valide_par: a.valide_par || null, annul: a.annulations, vstatut: v.statut, vmotif: v.motif, nbVal: DATA.validations.length };
  });
  assert.equal(r.statut, 'brouillon'); assert.equal(r.numero, 'ATS-2026-001'); assert.equal(r.publie, false); assert.equal(r.html, null); assert.equal(r.valide_par, null);
  assert.equal(r.annul.length, 1); assert.equal(r.annul[0].motif, 'Validée par erreur'); assert.equal(r.annul[0].valide_par, 'DG'); assert.equal(r.annul[0].publie_portail, true);
  assert.equal(r.vstatut, 'annule'); assert.match(r.vmotif, /Validée par erreur/); assert.equal(r.nbVal, 1, 'la validation n\'est jamais effacée');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('après annulation : « Soumettre au DG » renvoie la même attestation en validation, puis elle peut être validée', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    window.prompt = function () { return 'erreur'; };
    await attSoldeAnnulerValidation('c1');
    var bouton = attSoldeCellule('c1');
    await attSoldeDemander('c1');
    var a = DATA.clients[0].attestation_solde, attente = DATA.validations.filter(function (v) { return v.statut === 'en_attente'; });
    var statutApresDemande = a.statut, numero = a.numero, trace = a.annulations && a.annulations.length;
    await valDecide(attente[0].id, 'valide');
    return { bouton: bouton, statutApresDemande: statutApresDemande, numero: numero, nbAttente: attente.length, final: DATA.clients[0].attestation_solde.statut, trace: DATA.clients[0].attestation_solde.annulations.length, total: DATA.validations.length };
  });
  assert.match(r.bouton, /Soumettre au DG/); assert.equal(r.statutApresDemande, 'en_attente'); assert.equal(r.numero, 'ATS-2026-001'); assert.equal(r.nbAttente, 1);
  assert.equal(r.final, 'valide'); assert.equal(r.trace, 1, 'la trace de l\'annulation reste sur l\'attestation'); assert.equal(r.total, 2);
});

test('garde-fous : motif obligatoire, hiérarchie seulement, rien à annuler hors statut « validée »', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var out = {};
    window.prompt = function () { return '   '; }; await attSoldeAnnulerValidation('c1'); out.sansMotif = DATA.clients[0].attestation_solde.statut;
    window.prompt = function () { return null; }; await attSoldeAnnulerValidation('c1'); out.annule = DATA.clients[0].attestation_solde.statut;
    window.prompt = function () { return 'x'; }; window.hasRole = function () { return false; }; await attSoldeAnnulerValidation('c1'); out.sansDroit = DATA.clients[0].attestation_solde.statut;
    window.hasRole = function (r) { return r === 'admin'; }; DATA.clients[0].attestation_solde.statut = 'en_attente'; await attSoldeAnnulerValidation('c1'); out.enAttente = DATA.clients[0].attestation_solde.statut;
    return out;
  });
  assert.deepEqual(r, { sansMotif: 'valide', annule: 'valide', sansDroit: 'valide', enAttente: 'en_attente' });
});

test('le bouton « Annuler la validation » n\'apparaît que sur une attestation validée', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var a = DATA.clients[0].attestation_solde, h1 = attSoldeCellule('c1'); a.statut = 'en_attente'; var h2 = attSoldeCellule('c1'); a.statut = 'brouillon'; var h3 = attSoldeCellule('c1');
    return [/Annuler la validation/.test(h1), /Annuler la validation/.test(h2), /Annuler la validation/.test(h3)];
  });
  assert.deepEqual(r, [true, false, false]);
});
