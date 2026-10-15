/* Attestation de solde : le visa du souscripteur peut être retiré (et remis), tracé, y compris sur une attestation validée. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('visa du souscripteur : présent par défaut, retiré à la génération, bloc de signature de la direction conservé', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    window.attLierJuridique = async function () { return null; };
    DATA.params = { societe: 'ZMS Sarl' }; DATA.divisions = []; DATA.programmes = []; DATA.lots = [];
    var c = { id: 'c1', nom: 'BENDE', prenoms: 'M', dossier: 'S1', montant_total: 4000000 }; DATA.clients = [c];
    DATA.versements = [{ id: 'v1', client_id: 'c1', montant: 4000000, date: '2026-01-10', type: 'versement' }];
    var avec = attSoldeHtml(c, { numero: 'ATS-1', date: '2026-10-14', signataire: 'DG' }), sans = attSoldeHtml(c, { numero: 'ATS-1', date: '2026-10-14', signataire: 'DG', sansVisa: true });
    return { avec: avec.indexOf('lu et pris connaissance') !== -1, sans: sans.indexOf('lu et pris connaissance') === -1, dir: sans.indexOf('Signature et cachet') !== -1, sig: sans.indexOf('<div class="sig"><div></div>') !== -1 };
  });
  assert.deepEqual(r, { avec: true, sans: true, dir: true, sig: true });
});

test('visa : bascule sur brouillon (sans motif) puis sur attestation validée (motif obligatoire, portail et notaire mis à jour, historique)', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const r = await page.evaluate(async function () {
    window.syncToSupabase = function () {}; window.toast = function () {}; window.dbPut = async function () { return true; }; window.attLierJuridique = async function () { return null; };
    window.hasRole = function (x) { return x === 'admin'; }; APP.currentUser = { id: 'dg', nom: 'DG', role: 'admin' };
    DATA.params = { societe: 'ZMS Sarl' }; DATA.divisions = []; DATA.programmes = []; DATA.lots = [];
    var c = { id: 'c1', nom: 'BENDE', prenoms: 'M', dossier: 'S1', montant_total: 4000000 }; DATA.clients = [c];
    DATA.versements = [{ id: 'v1', client_id: 'c1', montant: 4000000, date: '2026-01-10', type: 'versement' }];
    var out = {}; attSoldeAuto('c1'); var a = c.attestation_solde;
    await attSoldeVisaBasculer('c1', 'initial'); out.brouillon = a.sans_visa === true;
    a.statut = 'valide'; a.html = attSoldeHtml(c, { numero: a.numero, date: '2026-10-14', signataire: 'DG', sansVisa: true }); a.html_notaire = a.html;
    window.prompt = function () { return ''; }; await attSoldeVisaBasculer('c1', 'initial'); out.sansMotif = a.sans_visa === true && a.html.indexOf('lu et pris connaissance') === -1;
    window.prompt = function () { return 'Demande du notaire'; }; await attSoldeVisaBasculer('c1', 'initial');
    out.remis = { flag: a.sans_visa, html: a.html.indexOf('lu et pris connaissance') !== -1, notaire: a.html_notaire.indexOf('lu et pris connaissance') !== -1 };
    await attSoldeVisaBasculer('c1', 'initial'); out.retire = { flag: a.sans_visa, html: a.html.indexOf('lu et pris connaissance') === -1 };
    out.histo = a.visa_historique.map(function (h) { return [h.retire, h.motif]; });
    window.hasRole = function () { return false; }; var avant = a.sans_visa; await attSoldeVisaBasculer('c1', 'initial'); out.refus = a.sans_visa === avant;
    out.bouton = attSoldeCellule('c1', 'initial').indexOf('Remettre le visa') !== -1;
    return out;
  });
  assert.equal(r.brouillon, true); assert.equal(r.sansMotif, true);
  assert.deepEqual(r.remis, { flag: false, html: true, notaire: true }); assert.deepEqual(r.retire, { flag: true, html: true });
  assert.deepEqual(r.histo, [[true, ''], [false, 'Demande du notaire'], [true, 'Demande du notaire']]); assert.equal(r.refus, true); assert.equal(r.bouton, true);
  assert.deepEqual(app.etat.erreursPage, []);
});
