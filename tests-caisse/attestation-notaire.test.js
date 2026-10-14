/* Attestations de solde : désignation du notaire et transmission explicite vers son espace Intervenant. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(function () {
    window.syncToSupabase = function () {}; window.toast = function (m) { (window.__toasts = window.__toasts || []).push(m); };
    window.attLierJuridique = async function () { return null; }; window.attSoldeRafraichirUI = function () {};
    window.hasRole = function () { return true; };
    var futur = new Date(Date.now() + 30 * 86400000).toISOString();
    DATA.intervenants_fonciers = [
      { id: 'n1', type: 'notaire', nom_organisation: 'Étude Me Koffi', statut_relation: 'actif', email: 'n@x.ci', code_acces_hash: 'h', code_expiration: futur },
      { id: 'n2', type: 'notaire', nom_organisation: 'Étude Me Yao', statut_relation: 'actif', email: 'y@x.ci' },
      { id: 'g1', type: 'geometre', nom_organisation: 'Cabinet Géo', statut_relation: 'actif' },
      { id: 'n3', type: 'notaire', nom_organisation: 'Étude archivée', statut_relation: 'archive' }];
    DATA.clients = [{ id: 'c1', nom: 'BENDE', prenoms: 'X', dossier: 'D-1',
      attestation_solde: { numero: 'ATS-2026-0028', statut: 'valide', valide_le: '2026-10-14', html: '<html>ATT A ImmoSuite ERP</html>' },
      attestation_solde_finale: { numero: 'ATF-2026-0001', statut: 'brouillon' } }];
  });
}

test('seuls les notaires actifs sont proposés ; la zone n\'apparaît qu\'avec une attestation validée', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var c = DATA.clients[0], z = attSoldeNotaireZone(c);
    var sans = JSON.parse(JSON.stringify(c)); sans.attestation_solde.statut = 'brouillon';
    return { ids: attNotairesActifs().map(function (i) { return i.id; }), zone: z, vide: attSoldeNotaireZone(sans), btnAvant: attSoldeCellule('c1', 'initial') };
  });
  assert.deepEqual(r.ids, ['n1', 'n2']); assert.match(r.zone, /Étude Me Koffi/); assert.doesNotMatch(r.zone, /Cabinet Géo|archivée/); assert.equal(r.vide, '');
  assert.doesNotMatch(r.btnAvant, /⚖️/, 'pas de bouton tant qu\'aucun notaire n\'est désigné');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('désigner, transmettre (texte corrigé figé), retirer ; transmission refusée sans notaire', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var out = {}, c = DATA.clients[0], a = c.attestation_solde;
    attSoldeNotaire('c1', true, 'initial'); out.sansNotaire = !!a.transmis_notaire;
    attNotaireChoisir('c1', 'g1'); out.mauvaisType = c.notaire_intervenant_id || '';
    attNotaireChoisir('c1', 'n1'); out.notaire = c.notaire_intervenant_id; out.btn = attSoldeCellule('c1', 'initial');
    attSoldeNotaire('c1', true, 'initial'); out.transmis = a.transmis_notaire; out.le = !!a.transmis_notaire_le; out.html = a.html_notaire; out.htmlFige = a.html;
    attSoldeNotaire('c1', false, 'initial'); out.retire = [a.transmis_notaire, a.html_notaire];
    attSoldeNotaire('c1', true, 'finale'); out.brouillon = !!(c.attestation_solde_finale.transmis_notaire);
    return out;
  });
  assert.equal(r.sansNotaire, false); assert.equal(r.mauvaisType, ''); assert.equal(r.notaire, 'n1'); assert.match(r.btn, /⚖️/);
  assert.equal(r.transmis, true); assert.equal(r.le, true); assert.doesNotMatch(r.html, /ImmoSuite ERP/); assert.match(r.htmlFige, /ImmoSuite ERP/, 'le texte validé reste intact');
  assert.deepEqual(r.retire, [false, undefined]); assert.equal(r.brouillon, false, 'un brouillon ne se transmet pas');
});

test('changer ou retirer le notaire retire les transmissions ; annuler la validation aussi', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var out = {}, c = DATA.clients[0], a = c.attestation_solde;
    attNotaireChoisir('c1', 'n1'); attSoldeNotaire('c1', true, 'initial');
    attNotaireChoisir('c1', 'n2'); out.apresChangement = [a.transmis_notaire, a.html_notaire, c.notaire_intervenant_id];
    attSoldeNotaire('c1', true, 'initial'); attNotaireChoisir('c1', ''); out.apresRetrait = [a.transmis_notaire, c.notaire_intervenant_id];
    attNotaireChoisir('c1', 'n1'); attSoldeNotaire('c1', true, 'initial');
    window.prompt = function () { return 'erreur'; }; DATA.validations = []; await attSoldeAnnulerValidation('c1', 'initial');
    out.apresAnnulation = [a.statut, a.transmis_notaire, a.html_notaire, a.html];
    return out;
  });
  assert.deepEqual(r.apresChangement, [false, undefined, 'n2']); assert.deepEqual(r.apresRetrait, [false, '']);
  assert.deepEqual(r.apresAnnulation, ['brouillon', undefined, undefined, undefined]);
});

test('avertit si le notaire désigné n\'a pas d\'accès portail actif', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(function () {
    var c = DATA.clients[0]; attNotaireChoisir('c1', 'n1'); var avec = attSoldeNotaireZone(c);
    attNotaireChoisir('c1', 'n2'); return { avec: avec, sans: attSoldeNotaireZone(c) };
  });
  assert.doesNotMatch(r.avec, /n'a pas d'accès portail actif/); assert.match(r.sans, /n'a pas d'accès portail actif/);
});
