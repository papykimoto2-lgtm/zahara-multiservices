/* Cas réel (dossier foncier) : un lot sans prix remettait le contrat à 0 FCFA, l'attestation affichait « 0 FCFA, aucun
   versement » parce que les versements étaient libellés « Valeur initiale terrain ». Trois garde-fous. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    window.syncToSupabase = function () {}; window.toast = function (m) { (window.__toasts = window.__toasts || []).push(m); };
    window.userPeutSurStore = function () { return true; };
    window.hasRole = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'DG', role: 'admin' };
    DATA.params = Object.assign(DATA.params || {}, { societe: 'SOC TEST' });
    DATA.lots = [{ id: 'L0', numero: '115', nature: 'terrain', prix: 0, surface: 700 }, { id: 'L1', numero: '116', nature: 'terrain', prix: 5000000, surface: 700 }];
    DATA.programmes = [];
    DATA.clients = [{ id: 'c1', nom: 'ATHANGBA', prenoms: 'Harold', dossier: 'SS304', tel: '07 00 00 00 01', montant_total: 17000000, nature_bien: 'terrain', lot_id: 'L1', statut: 'actif', date_souscription: '2022-08-30', apport: 0, duree: 15 }];
    DATA.versements = [
      { id: 'v1', client_id: 'c1', date: '2022-08-30', montant: 1000000, objet: 'Valeur initiale terrain', type: 'mensualite' },
      { id: 'v2', client_id: 'c1', date: '2026-11-23', montant: 16000000, objet: 'Valeur initiale terrain', type: 'mensualite' }];
    DATA.validations = [];
    return true;
  });
}

test('1. un lot sans prix ne vide plus le montant du contrat (fiche existante) ; nouvelle souscription : champ vide', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var champ = document.getElementById('c-montant-total');
    var sel = document.getElementById('c-lot'); sel.innerHTML = '<option value=""></option><option value="L0">L0</option><option value="L1">L1</option>';
    var o = {};
    APP.editingId = 'c1'; champ.value = '17000000'; sel.value = 'L0'; onClientLotChange(); o.existantSansPrix = champ.value;
    sel.value = 'L1'; onClientLotChange(); o.existantAvecPrix = champ.value;
    APP.editingId = null; champ.value = '9999'; sel.value = 'L0'; onClientLotChange(); o.nouveauSansPrix = champ.value;
    return o;
  });
  assert.equal(r.existantSansPrix, '17000000', 'le montant saisi est conservé'); assert.equal(r.existantAvecPrix, '5000000', 'un lot avec prix reste appliqué');
  assert.equal(r.nouveauSansPrix, '', 'nouvelle souscription : champ vidé (le garde-fou de création le signale)');
});

test('1b. enregistrer une fiche avec un contrat à 0 alors que 17 000 000 F et des versements existent : confirmation, refus = rien n\'est écrit', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  app.etat.confirm = false;
  const r = await app.page.evaluate(async function () {
    DATA.employes = [{ id: 'e1', nom: 'COM', prenoms: 'Test', poste: 'commercial' }];
    openClientModal('c1');
    var sel = document.getElementById('c-commercial'); sel.innerHTML = '<option value="e1">e1</option>'; sel.value = 'e1';   /* exigé avant tout enregistrement */
    document.getElementById('c-montant-total').value = '';
    await saveClient();
    return DATA.clients[0].montant_total;
  });
  assert.equal(r, 17000000, 'montant inchangé après refus');
  assert.ok(app.etat.dialogues.some((d) => /passe de .*à 0/.test(d) && /2 versement/.test(d)), 'dialogue explicite : ' + JSON.stringify(app.etat.dialogues));
});

test('2. versements « Valeur initiale terrain » : listés, comptés, libellé « terrain » ; date de solde = dernier versement', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var c = DATA.clients[0], S = attSoldeSolde(c, 'initial');
    var h = attSoldeHtml(c, { numero: 'ATS-2026-0107', date: '2026-11-25', kind: 'initial', projet: true });
    return { solde: S.solde, verse: S.verse, nb: S.vs.length, dateSolde: S.dateSolde,
      aucun: /Aucun versement enregistré/.test(h), titre: /Tableau d'amortissement — Valeur initiale terrain/.test(h), ligne: /Valeur initiale du terrain/.test(h),
      logement: /Valeur initiale du logement/.test(h), mont: /17 000 000|17 000 000|17 000 000/.test(h) };
  });
  assert.equal(r.solde, true); assert.equal(r.verse, 17000000); assert.equal(r.nb, 2); assert.equal(r.dateSolde, '2026-11-23');
  assert.equal(r.aucun, false, 'plus de « Aucun versement enregistré »'); assert.equal(r.titre, true); assert.equal(r.ligne, true); assert.equal(r.logement, false); assert.equal(r.mont, true);
});

test('2b. un logement garde le libellé « logement »', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var c = Object.assign({}, DATA.clients[0], { nature_bien: 'logement', lot_id: '' });
    DATA.versements.forEach(function (v) { v.objet = 'Valeur initiale logement'; });
    var h = attSoldeHtml(c, { numero: 'ATS-2026-0001', date: '2026-11-25', kind: 'initial', projet: true });
    return { titre: /Tableau d'amortissement — Valeur initiale logement/.test(h), aucun: /Aucun versement enregistré/.test(h) };
  });
  assert.equal(r.titre, true); assert.equal(r.aucun, false);
});

test('3. prix du contrat à 0 : aperçu et variante refusés avec la marche à suivre ; un document déjà validé reste consultable', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var ouverts = 0; window.open = function () { ouverts++; return { document: { write: function () {}, close: function () {} } }; };
    var c = DATA.clients[0]; c.attestation_solde = { numero: 'ATS-2026-0107', statut: 'en_attente', demandeur: 'X', date_demande: '2026-11-24', publie_portail: false };
    c.montant_total = 0; window.__toasts = [];
    attSoldeApercu('c1', 'initial'); var apresBrouillon = ouverts;
    ATT_VAR_CLIENT = 'c1'; var dom = document.getElementById('att-var-motif'); 
    c.attestation_solde = { numero: 'ATS-2026-0108', statut: 'valide', html: '<html><body>FIGE</body></html>', valide_par: 'DG', valide_le: '2026-11-01' };
    attSoldeApercu('c1', 'initial'); var apresValide = ouverts;
    return { apresBrouillon: apresBrouillon, apresValide: apresValide, msg: (window.__toasts || []).join(' | ') };
  });
  assert.equal(r.apresBrouillon, 0, 'aucune fenêtre pour un brouillon à prix 0'); assert.match(r.msg, /montant du contrat .* 0 FCFA/);
  assert.equal(r.apresValide, 1, 'le document déjà validé (texte figé) reste consultable');
  assert.deepEqual(app.etat.erreursPage, []);
});
