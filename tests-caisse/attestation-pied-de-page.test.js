/* Attestation de solde : pied de page d'entreprise construit depuis Paramètres › Entreprise. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const PARAMS = { societe: 'ZMS Sarl', adresse: 'Abidjan Cocody Angré 2 Plateau 7ème Tranche\n01 BP 6264 ABIDJAN 01', rccm: 'CI-ABJ-03-2020-M-11200', dgi: '1729048 Q', tel: '27 22 52 32 11', cel: '01 50 06 06 02', email: 'zamuser12@gmail.com' };

async function html(page, params, opts) {
  return page.evaluate(function (a) {
    window.attSoldeSolde = function () { return { solde: true, prix: 1000000, verse: 1000000, dateSolde: '2026-01-01', vs: [], frais: 0 }; };
    DATA.params = a.params; var c = { id: 'c1', nom: 'BENDE', prenoms: 'X', dossier: 'D-1' };
    var h = attSoldeHtml(c, Object.assign({ numero: 'ATS-2026-001', date: '2026-10-14' }, a.opts || {}));
    var d = new DOMParser().parseFromString(h, 'text/html'), pied = d.querySelector('.pied');
    return { present: !!pied, lignes: pied ? [].slice.call(pied.children).map(function (x) { return x.textContent; }) : [], dernier: d.body.lastElementChild && d.body.lastElementChild.className, css: /\.pied\{/.test(h) && /@media print\{.*\.pied\{position:absolute/.test(h) };
  }, { params: params, opts: opts });
}

test('pied de page complet comme le modèle : société + siège / RCCM et CC / BP, TEL, CEL, E-MAIL', async () => {
  const app = await ouvrirApp(); const r = await html(app.page, PARAMS);
  assert.equal(r.present, true);
  assert.deepEqual(r.lignes, [
    'ZMS Sarl Siège Social : Abidjan Cocody Angré 2 Plateau 7ème Tranche',
    'N° RCCM : CI-ABJ-03-2020-M-11200 – CC : 1729048 Q',
    '01 BP 6264 ABIDJAN 01 – TEL : 27 22 52 32 11   CEL : 01 50 06 06 02   E-MAIL : zamuser12@gmail.com'
  ]);
  assert.equal(r.dernier, 'pied', 'le pied de page termine le document'); assert.equal(r.css, true, 'fixé en bas de chaque page à l\'impression');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('éléments non renseignés omis, rien d\'inventé ; paramètres vides : aucun pied de page', async () => {
  const app = await ouvrirApp();
  let r = await html(app.page, { societe: 'Zahara', tel: '07 00 00 00 00' });
  assert.deepEqual(r.lignes, ['Zahara', 'TEL : 07 00 00 00 00']);
  r = await html(app.page, { societe: 'Zahara', adresse: 'Cocody', email: 'a@b.ci' });
  assert.deepEqual(r.lignes, ['Zahara Siège Social : Cocody', 'E-MAIL : a@b.ci']);
  r = await html(app.page, {}); assert.equal(r.present, false);
});

test('présent aussi sur la version indicative et sur le projet ; texte HTML des paramètres jamais interprété', async () => {
  const app = await ouvrirApp();
  let r = await html(app.page, PARAMS, { indicatif: true, motif: 'x' }); assert.equal(r.present, true);
  r = await html(app.page, PARAMS, { projet: true }); assert.equal(r.present, true);
  const x = await app.page.evaluate(function () {
    window.attSoldeSolde = function () { return { solde: true, prix: 1, verse: 1, dateSolde: '2026-01-01', vs: [], frais: 0 }; };
    DATA.params = { societe: 'A<img src=x onerror=alert(1)>', adresse: '<script>alert(2)</script>' };
    var h = attSoldeHtml({ id: 'c', nom: 'N' }, { numero: 'X' }), d = new DOMParser().parseFromString(h, 'text/html');
    return { inj: d.querySelectorAll('.pied img, .pied script, .pied [onerror]').length, texte: d.querySelector('.pied').textContent };
  });
  assert.equal(x.inj, 0); assert.match(x.texte, /<img src=x/);
});

test('Paramètres : le champ Mobile (CEL) est enregistré et rechargé', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async function () {
    window.syncToSupabase = function () {};
    window.hasRole = function () { return true; };
    var champ = document.getElementById('param-cel'); if (!champ) return { champ: false };
    champ.value = '01 50 06 06 02'; await saveParams();
    var saved = DATA.params.cel; champ.value = ''; loadParamFields();
    return { champ: true, saved: saved, recharge: document.getElementById('param-cel').value };
  });
  assert.equal(r.champ, true); assert.equal(r.saved, '01 50 06 06 02'); assert.equal(r.recharge, '01 50 06 06 02');
});

test('attestation déjà validée (document figé sans pied) : le pied est ajouté à l\'affichage, sans toucher au texte validé ni au document enregistré', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function (params) {
    DATA.params = params;
    var figee = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{}</style></head><body><h1>ATTESTATION DE SOLDE</h1><p>Texte validé</p></body></html>';
    var a = { statut: 'valide', html: figee }, avant = a.html, h = attSoldeHtmlFinal(a), d = new DOMParser().parseFromString(h, 'text/html');
    var deja = attSoldeHtmlFinal({ html: h });
    DATA.params = {}; var sansParam = attSoldeHtmlFinal({ html: figee });
    return { pied: d.querySelectorAll('.pied').length, texte: d.body.textContent.indexOf('Texte validé') !== -1, stocke: a.html === avant, idempotent: deja === h, sansParam: sansParam === figee, css: /\.pied\{position:absolute/.test(h), lignes: d.querySelector('.pied').children.length };
  }, PARAMS);
  assert.equal(r.pied, 1); assert.equal(r.texte, true); assert.equal(r.stocke, true); assert.equal(r.idempotent, true); assert.equal(r.sansParam, true); assert.equal(r.css, true); assert.equal(r.lignes, 3);
});

test('identité du promoteur : la division du programme (ZMS Sarl) prévaut sur la société du groupe ; « ImmoSuite ERP » n\'est jamais imprimé', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    window.attSoldeSolde = function () { return { solde: true, prix: 1000000, verse: 1000000, dateSolde: '2026-01-01', vs: [], frais: 0 }; };
    DATA.params = { societe: 'ImmoSuite ERP', tel: '00 00', email: 'groupe@x.ci', ville: 'Abidjan' };
    DATA.divisions = [{ id: 'dz', nom: 'Zahara', raisonSociale: 'ZMS Sarl', rccm: 'CI-ABJ-03-2020-M-11200', ncc: '1729048 Q', siegeSocial: 'Abidjan Cocody Angré 2 Plateau 7ème Tranche\n01 BP 6264 ABIDJAN 01', tel: '27 22 52 32 11', email: 'zamuser12@gmail.com' }];
    DATA.programmes = [{ id: 'pz', nom: 'P', division_id: 'dz' }, { id: 'pg', nom: 'G' }];
    var avec = attSoldeHtml({ id: 'c1', nom: 'BENDE', programme_id: 'pz' }, { numero: 'N' }), sans = attSoldeHtml({ id: 'c2', nom: 'X', programme_id: 'pg' }, { numero: 'N' });
    var d = new DOMParser().parseFromString(avec, 'text/html'), d2 = new DOMParser().parseFromString(sans, 'text/html');
    var figee = '<html><head></head><body><p>Nous, ImmoSuite ERP</p></body></html>';
    var final = attSoldeHtmlFinal({ html: figee }, { id: 'c1', programme_id: 'pz' });
    return { nous: (d.body.textContent.match(/Nous, ([^,]*),/) || [])[1], immo: /ImmoSuite/.test(avec), rccm: /CI-ABJ-03-2020-M-11200/.test(d.body.textContent), pied: [].slice.call(d.querySelectorAll('.pied > div')).map(function (x) { return x.textContent; }),
      nousSans: (d2.body.textContent.match(/Nous, ([^,]*),/) || [])[1], immoSans: /ImmoSuite/.test(sans), piedFinal: new DOMParser().parseFromString(final, 'text/html').querySelector('.pied').textContent.indexOf('ZMS Sarl Siège Social') !== -1 };
  });
  assert.equal(r.nous, 'ZMS Sarl'); assert.equal(r.immo, false); assert.equal(r.rccm, true);
  assert.deepEqual(r.pied, ['ZMS Sarl Siège Social : Abidjan Cocody Angré 2 Plateau 7ème Tranche', 'N° RCCM : CI-ABJ-03-2020-M-11200 – CC : 1729048 Q', '01 BP 6264 ABIDJAN 01 – TEL : 27 22 52 32 11   E-MAIL : zamuser12@gmail.com']);
  assert.equal(r.nousSans, 'le promoteur', 'sans division ni raison sociale renseignée : jamais « ImmoSuite ERP »'); assert.equal(r.immoSans, false); assert.equal(r.piedFinal, true);
});

test('sans division : la raison sociale des Paramètres est utilisée', async () => {
  const app = await ouvrirApp();
  const nous = await app.page.evaluate(function () {
    window.attSoldeSolde = function () { return { solde: true, prix: 1, verse: 1, dateSolde: '2026-01-01', vs: [], frais: 0 }; };
    DATA.params = { societe: 'Zahara Multi Services' }; DATA.divisions = []; DATA.programmes = [];
    var d = new DOMParser().parseFromString(attSoldeHtml({ id: 'c', nom: 'N' }, { numero: 'N' }), 'text/html'); return (d.body.textContent.match(/Nous, ([^,]*),/) || [])[1];
  });
  assert.equal(nous, 'Zahara Multi Services');
});

test('attestation validée avec « ImmoSuite ERP » : l\'identification du promoteur est corrigée à l\'affichage, le reste du texte validé et le document enregistré sont inchangés', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    window.attSoldeSolde = function () { return { solde: true, prix: 5000000, verse: 5000000, dateSolde: '2026-01-01', vs: [], frais: 0 }; };
    DATA.params = { societe: 'ImmoSuite ERP' };
    DATA.divisions = [{ id: 'dz', nom: 'Zahara', raisonSociale: 'ZMS Sarl', rccm: 'CI-ABJ-03-2020-M-11200', ncc: '1729048 Q', siegeSocial: 'Abidjan Cocody Angré 2 Plateau 7ème Tranche\n01 BP 6264 ABIDJAN 01', tel: '27 22 52 32 11', email: 'z@x.ci' }];
    DATA.programmes = [{ id: 'pz', division_id: 'dz' }];
    var c = { id: 'c1', nom: 'BENDE', programme_id: 'pz' };
    var figee = attSoldeHtml(c, { numero: 'ATS-1', date: '2026-10-14', signataire: 'DG' });   // reconstitue un document figé avec le nom par défaut
    DATA.divisions = []; var ancien = attSoldeHtml(c, { numero: 'ATS-1', date: '2026-10-14', signataire: 'DG' }).replace('le promoteur', 'ImmoSuite ERP').replace('<strong style="font-size:15px;"></strong>', '<strong style="font-size:15px;">ImmoSuite ERP</strong>').replace('<div class="art">La société, promoteur immobilier.</div>', '<div class="art">ImmoSuite ERP, promoteur immobilier.</div>');
    DATA.divisions = [{ id: 'dz', nom: 'Zahara', raisonSociale: 'ZMS Sarl', rccm: 'CI-ABJ-03-2020-M-11200', ncc: '1729048 Q', siegeSocial: 'Abidjan Cocody Angré 2 Plateau 7ème Tranche\n01 BP 6264 ABIDJAN 01', tel: '27 22 52 32 11', email: 'z@x.ci' }];
    var a = { statut: 'valide', html: ancien }, avant = a.html, h = attSoldeHtmlFinal(a, c), d = new DOMParser().parseFromString(h, 'text/html');
    return { immo: /ImmoSuite/.test(h), entete: d.querySelector('.ref strong').textContent, promoteur: d.querySelector('h3 + .art').textContent, montant: /Solde restant dû : 0 FCFA/.test(h), stocke: a.html === avant, pied: !!d.querySelector('.pied'), avantImmo: /ImmoSuite ERP/.test(avant) };
  });
  assert.equal(r.avantImmo, true, 'le document figé contient bien le nom par défaut'); assert.equal(r.immo, false); assert.equal(r.entete, 'ZMS Sarl');
  assert.match(r.promoteur, /^ZMS Sarl, RCCM CI-ABJ-03-2020-M-11200, N° CC 1729048 Q, promoteur immobilier, siège : Abidjan Cocody Angré 2 Plateau 7ème Tranche, 01 BP 6264 ABIDJAN 01\.$/);
  assert.equal(r.montant, true); assert.equal(r.stocke, true); assert.equal(r.pied, true);
});
