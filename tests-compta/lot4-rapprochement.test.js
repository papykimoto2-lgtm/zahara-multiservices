const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Revue comptabilité, lot 4 : rapprochement bancaire (sens, double pointage, banques), import CSV, régularisation, échappement HTML. */
const prep = function () {
  window.rel = function (id, date, debit, credit, extra) {
    return Object.assign({ id: id, banque: '521', mois: date.slice(0, 7), date: date, ref: 'R' + id, libelle: 'L ' + id, debit: debit, credit: credit, mode: 'virement', type_op: 'divers', rapproche: false, ecriture_id: null }, extra || {});
  };
  window.prepRapp = function () {
    DATA.ecritures = []; DATA.releves_bank = []; DATA.rapprochements = [];
    populateComptesTresorerieSelects();
    document.getElementById('rapproch-periode').value = '2026-03';
    document.getElementById('rapproch-compte').value = '';
  };
};
async function ouvrir() { const app = await ouvrirApp(); await app.page.evaluate(prep); return app; }

test('rapprochement automatique : le sens est obligatoire (entrée banque ↔ débit 521 uniquement)', async () => {
  const app = await ouvrir();
  try {
    const r = await app.page.evaluate(function () {
      prepRapp();
      DATA.ecritures = [E('sortie', '2026-03-05', '601', '521', 100)];            // crédit 521 = sortie
      DATA.releves_bank = [rel('r1', '2026-03-05', 0, 100)];                       // entrée banque
      rapprochAutoScore();
      const mauvais = DATA.releves_bank[0].rapproche;
      DATA.ecritures.push(E('entree', '2026-03-05', '521', '701', 100));
      rapprochAutoScore();
      return { mauvais, bon: DATA.releves_bank[0].rapproche, ecr: DATA.releves_bank[0].ecriture_id };
    });
    assert.equal(r.mauvais, false);
    assert.equal(r.bon, true);
    assert.equal(r.ecr, 'entree');
  } finally { await app.fermer(); }
});

test('une écriture déjà pointée ne l\'est pas une seconde fois (auto et manuel)', async () => {
  const app = await ouvrir();
  try {
    const r = await app.page.evaluate(function () {
      prepRapp();
      DATA.ecritures = [E('e1', '2026-03-05', '521', '701', 100)];
      DATA.releves_bank = [rel('r1', '2026-03-05', 0, 100), rel('r2', '2026-03-05', 0, 100)];
      rapprochAutoScore();
      const n1 = DATA.releves_bank.filter(function (x) { return x.rapproche; }).length;
      DATA.releves_bank.push(rel('r3', '2026-03-06', 0, 100));
      rapprochAutoScore();
      matchManuel('r3');
      return { n1, n2: DATA.releves_bank.filter(function (x) { return x.rapproche; }).length, msg: window.__toasts.join(' | ') };
    });
    assert.equal(r.n1, 1);
    assert.equal(r.n2, 1);
    assert.match(r.msg, /Aucune écriture correspondante/);
  } finally { await app.fermer(); }
});

test('rapprochement par banque : les relevés d\'une autre banque n\'entrent pas dans l\'archive validée', async () => {
  const app = await ouvrir();
  try {
    const r = await app.page.evaluate(async function () {
      prepRapp();
      DATA.releves_bank = [rel('a', '2026-03-05', 0, 100, { banque: '521100' }), rel('b', '2026-03-06', 0, 900, { banque: '521200' })];
      DATA.ecritures = [E('e1', '2026-03-05', '521100', '701', 100)];
      document.getElementById('rapproch-compte').insertAdjacentHTML('beforeend', '<option value="521100">521100</option>');
      document.getElementById('rapproch-compte').value = '521100';
      await validerRapprochement();
      const a = DATA.rapprochements[0];
      return { nb: a.nb_total, solde: a.solde_releve, statut: a.statut };
    });
    assert.equal(r.nb, 1);
    assert.equal(r.solde, 100);
    assert.equal(r.statut, 'equilibre');
  } finally { await app.fermer(); }
});

test('libellés de relevé importés : échappés dans les trois écrans', async () => {
  const app = await ouvrir();
  try {
    const r = await app.page.evaluate(function () {
      prepRapp();
      const mal = '<img src=x onerror="window.__xss=1">';
      DATA.releves_bank = [rel('x', '2026-03-05', 0, 100, { ref: mal, date: '2026-03-05', banque: mal, mode: mal })];
      DATA.ecritures = [E('ex', '2026-03-05', '521', '701', 999, { ref: mal })];
      renderReleveTable(); buildRapprochement(); buildEcarts();
      const h = document.getElementById('tbody-releve-bank').innerHTML + document.getElementById('tbody-bank-rapproch').innerHTML + document.getElementById('tbody-compta-rapproch').innerHTML + document.getElementById('tbody-ecarts-bank').innerHTML + document.getElementById('tbody-ecarts-compta').innerHTML;
      return { img: h.indexOf('<img') !== -1, xss: window.__xss || 0 };
    });
    assert.equal(r.img, false);
    assert.equal(r.xss, 0);
  } finally { await app.fermer(); }
});

test('import CSV : séparateur « ; », dates jj/mm/aaaa, virgule décimale, doublons ignorés, ligne illisible comptée', async () => {
  const app = await ouvrir();
  try {
    await app.page.evaluate(function () {
      prepRapp();
      const sel = document.getElementById('rb-banque'); if (![].some.call(sel.options, function (o) { return o.value === '521'; })) sel.insertAdjacentHTML('beforeend', '<option value="521">521</option>'); sel.value = '521';
    });
    const csv = 'date;ref;libelle;debit;credit\n15/03/2026;V1;"Vir client; DIOMANDE";0;583 333,50\n20/03/2026;C1;Frais tenue;12,5;0\nn’importe quoi\n';
    await app.page.setInputFiles('#rb-import-csv', { name: 'rel.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
    await app.page.waitForTimeout(600);
    const l1 = await app.page.evaluate(function () { return DATA.releves_bank.map(function (x) { return [x.date, x.debit, x.credit, x.libelle]; }); });
    assert.deepEqual(l1, [['2026-03-15', 0, 583333.5, 'Vir client; DIOMANDE'], ['2026-03-20', 12.5, 0, 'Frais tenue']]);
    await app.page.evaluate(function () { document.getElementById('rb-import-csv').value = ''; });
    await app.page.setInputFiles('#rb-import-csv', { name: 'rel.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
    await app.page.waitForTimeout(600);
    const r = await app.page.evaluate(function () { return { n: DATA.releves_bank.length, msg: window.__toasts.slice(-1)[0] }; });
    assert.equal(r.n, 2);
    assert.match(r.msg, /0 ligne\(s\) importée\(s\).*2 doublon\(s\) ignoré\(s\)/);
  } finally { await app.fermer(); }
});

test('régularisation des frais : écriture complète (lignes), référence unique, refusée sur exercice clos', async () => {
  const app = await ouvrir();
  try {
    const r = await app.page.evaluate(async function () {
      prepRapp();
      DATA.params.comptes_defaut = Object.assign({}, DATA.params.comptes_defaut, { frais_bancaires: '627', treso_banque: '521' });
      DATA.releves_bank = [rel('f1', '2026-03-05', 40, 0, { type_op: 'frais_banque' }), rel('f2', '2026-03-05', 40, 0, { type_op: 'frais_banque' }), rel('f3', '2026-03-06', 0, 40, { type_op: 'frais_banque' })];
      await regulariserEcarts();
      const ecr = DATA.ecritures.filter(function (e) { return /^ecr_frais_/.test(e.id); });
      const refs = ecr.map(function (e) { return e.ref; });
      const eq = ecr.every(function (e) { const L = ecrLignes(e); return L.length === 2 && L[0].montant === L[1].montant && L[0].sens !== L[1].sens; });
      DATA.releves_bank.push(rel('f4', '2026-03-07', 40, 0, { type_op: 'frais_banque' }));
      DATA.params.cloture_2026 = true;
      await regulariserEcarts();
      return { n: ecr.length, uniques: new Set(refs).size, eq, apresClos: DATA.ecritures.filter(function (e) { return /^ecr_frais_/.test(e.id); }).length };
    });
    assert.equal(r.n, 2);
    assert.equal(r.uniques, 2);
    assert.equal(r.eq, true);
    assert.equal(r.apresClos, 2);
  } finally { await app.fermer(); }
});
