/* Reçus de versement : îlot et lot(s) du souscripteur. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('reçu modal et reçu officiel : îlot, lot unique, lots multiples (terrain), valeurs absentes, échappement', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(function () {
    window.toast = function () {};
    DATA.params = { societe: 'ZMS' }; DATA.programmes = [{ id: 'g1', nom: 'Résidence' }];
    DATA.lots = [{ id: 'a', numero: '12', ilot: 'B4', type: 'F3', programme_id: 'g1' }, { id: 'b', numero: '13', ilot: 'B4', programme_id: 'g1' }, { id: 'c', numero: '14', ilot: 'C1', programme_id: 'g1' }, { id: 'x', numero: '<i>9</i>', programme_id: 'g1' }];
    DATA.clients = [{ id: 'c1', nom: 'BENDE', prenoms: 'M', tel: '01', programme_id: 'g1', lot_id: 'a', lot_ids: ['a'], montant_total: 1000 },
      { id: 'c2', nom: 'KONE', prenoms: 'A', tel: '02', programme_id: 'g1', lot_id: 'a', lot_ids: ['a', 'b', 'c'], montant_total: 1000 },
      { id: 'c3', nom: 'SANS', prenoms: 'I', tel: '03', programme_id: 'g1', lot_id: 'x', lot_ids: ['x'], ilot: 'D2', montant_total: 1000 },
      { id: 'c4', nom: 'RIEN', prenoms: 'Z', tel: '04', programme_id: 'g1', montant_total: 1000 }];
    DATA.versements = ['c1', 'c2', 'c3', 'c4'].map(function (c, i) { return { id: 'v' + i, client_id: c, montant: 100, date: '2026-10-01', type: 'versement', ref: 'R' + i }; });
    var out = {}, texte = function (h) { var d = document.createElement('div'); d.innerHTML = h; return d; };
    DATA.versements.forEach(function (v, i) { showRecu(v); out['m' + i] = document.getElementById('recu-body').textContent.replace(/\s+/g, ' '); });
    out.m2html = document.getElementById('recu-body').innerHTML;
    var cap = []; window.genererEtatPDF = function (o) { cap.push(o.contenu); };
    DATA.versements.forEach(function (v) { etatRecuVersement(v.id); });
    out.o = cap.map(function (h) { return texte(h).textContent.replace(/\s+/g, ' '); }); out.o3html = cap[2];
    return out;
  });
  assert.match(r.m0, /Îlot :B4/); assert.match(r.m0, /Lot :Lot 12 – F3/);
  assert.match(r.m1, /Îlot :B4, C1/); assert.match(r.m1, /Lots :Lot 12 – F3 ; Lot 13 ; Lot 14/);
  assert.match(r.m2, /Îlot :D2/); assert.doesNotMatch(r.m2html, /<i>9<\/i>/);
  assert.match(r.m3, /Îlot :—/); assert.match(r.m3, /Lot :—/);
  assert.match(r.o[0], /ÎlotB4/); assert.match(r.o[0], /LotLot 12 – F3/);
  assert.match(r.o[1], /ÎlotB4, C1/); assert.match(r.o[1], /LotsLot 12 – F3 ; Lot 13 ; Lot 14/);
  assert.match(r.o[2], /ÎlotD2/); assert.doesNotMatch(r.o3html, /<i>9<\/i>/);
  assert.match(r.o[3], /Îlot—Lot—/);
  assert.deepEqual(app.etat.erreursPage, []);
});
