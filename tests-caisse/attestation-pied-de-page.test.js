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
