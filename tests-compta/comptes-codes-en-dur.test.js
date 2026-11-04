const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Comptes codés en dur : trésorerie par mode de paiement, TVA (due, crédit, non déductible), liaison d'ouverture, régularisations. */

test('trésorerie par mode : le compte par défaut paramétré est utilisé, l\'ancien code sert de repli', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      const cd = DATA.params.comptes_defaut;
      const avant = [_cptTresoSouple('especes'), _cptTresoSouple('mobile_money'), _cptTresoSouple('virement')];
      delete cd.treso_caisse; delete cd.treso_mobile; delete cd.treso_banque;
      const repli = [_cptTresoSouple('especes'), _cptTresoSouple('mobile_money'), _cptTresoSouple('virement'), _cptTresoSouple('cheque')];
      Object.assign(cd, { treso_caisse: '57110001', treso_mobile: '52500000', treso_banque: '52111000' });
      const param = [_cptTresoSouple('especes'), _cptTresoSouple('mobile_money'), _cptTresoSouple('virement'), _cptTresoSouple('cheque')];
      return { avant, repli, param };
    });
    assert.deepEqual(r.repli, ['571', '531', '521', '521']);
    assert.deepEqual(r.param, ['57110001', '52500000', '52111000', '52111000']);
  } finally { await app.fermer(); }
});

test('règlement d\'une commission : crédite le compte de trésorerie paramétré selon le mode', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      Object.assign(DATA.params.comptes_defaut, { treso_caisse: '57110001', treso_mobile: '52500000', treso_banque: '52111000', comm_com_provision: '401' });
      DATA.commissions = []; DATA.clients = [];
      const res = {};
      for (const mode of ['especes', 'mobile_money', 'virement']) {
        const c = { id: 'c_' + mode, statut: 'payee', type_beneficiaire: 'commercial', beneficiaire: 'X', montant_comm: 1000, date_paiement: '2026-03-01' };
        DATA.commissions.push(c);
        await comptabiliserPaiementCommission(c, mode);
        const e = DATA.ecritures.find(function (x) { return x.id === c.ecriture_paiement_id; });
        res[mode] = e && e.compte_credit;
      }
      return res;
    });
    assert.deepEqual(r, { especes: '57110001', mobile_money: '52500000', virement: '52111000' });
  } finally { await app.fermer(); }
});

async function prepTva(page, cd) {
  await page.evaluate(function (cd) {
    Object.assign(DATA.params.comptes_defaut, cd);
    DATA.ecritures = [E('v', '2026-03-10', '4111', '4431', 1800), E('a1', '2026-03-12', '4451', '4011', 180), E('a2', '2026-03-13', '4452', '4011', 180)];
    DATA.params.tva_cfg = { prorata: 50, regime: 'RNI', declarations: [] };
    ouvrirDeclarationTVA();
    document.getElementById('tva-mois').value = '2026-03'; document.getElementById('tva-prorata').value = '50'; renderDeclarationTVA();
  }, cd);
}
const comptesLiq = () => {
  const e = DATA.ecritures.find(function (x) { return x.source === 'liquidation_tva'; });
  return ecrLignes(e).map(function (l) { return l.sens + l.compte; }).sort();
};

test('liquidation de TVA : comptes par défaut 4441 / 4449 / 6461, ou ceux du paramétrage', async () => {
  const app = await ouvrirApp();
  try {
    await prepTva(app.page, {});
    const defaut = await app.page.evaluate(async function (f) { await passerEcritureTVA(); return eval('(' + f + ')')(); }, comptesLiq.toString());
    assert.ok(defaut.indexOf('C4441') !== -1 || defaut.indexOf('D4449') !== -1, defaut.join(','));
    assert.ok(defaut.indexOf('D6461') !== -1);
  } finally { await app.fermer(); }
  const app2 = await ouvrirApp();
  try {
    await prepTva(app2.page, { tva_due: '44410000', tva_credit: '44490000', tva_non_deductible: '64610000' });
    const param = await app2.page.evaluate(async function (f) { await passerEcritureTVA(); return eval('(' + f + ')')(); }, comptesLiq.toString());
    assert.ok(param.indexOf('C44410000') !== -1 || param.indexOf('D44490000') !== -1, param.join(','));
    assert.ok(param.indexOf('D64610000') !== -1);
    assert.ok(param.every(function (x) { return !/(4441|4449|6461)$/.test(x); }), param.join(','));
  } finally { await app2.fermer(); }
});

test('régularisations : comptes paramétrables (476, 477, 408, 418, 428 et TVA 4455 / 4435)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      const defaut = Object.keys(CUTOFF_TYPES).map(function (k) { return CUTOFF_TYPES[k].cpt; });
      Object.assign(DATA.params.comptes_defaut, { regul_cca: '47600000', regul_fae: '41800000', tva_fae: '44350000' });
      const param = Object.keys(CUTOFF_TYPES).map(function (k) { return CUTOFF_TYPES[k].cpt; });
      const L = _cutoffLignes({ type: 'fae', montant: 1000, tva: 180, compte: '706', libelle: 'FAE' }, false).map(function (l) { return l.compte; });
      return { defaut, param, L };
    });
    assert.deepEqual(r.defaut, ['476', '477', '408', '418', '428']);
    assert.deepEqual(r.param, ['47600000', '477', '408', '41800000', '428']);
    assert.ok(r.L.indexOf('41800000') !== -1 && r.L.indexOf('44350000') !== -1, r.L.join(','));
  } finally { await app.fermer(); }
});

test('compte de liaison d\'ouverture : un solde sur 890 n\'est plus pris pour un impôt sur le résultat dans la liasse', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.ecritures = [E('o1', '2026-01-01', '521', '890', 1000)];       /* bilan d'ouverture déséquilibré : 890 porte 1000 */
      const l = _lfCalc2(2026, ''), p = calcBilan(2026);
      return { xi: l.R.XI + 0, rs: l.R.RS + 0, res: p.resultat + 0, ecart: Math.round(l.B.BZ - l.B.DZ) };
    });
    assert.equal(r.xi + 0, 0);
    assert.equal(r.rs + 0, 0);
    assert.equal(r.res, 0);
    assert.equal(r.ecart, 0);
  } finally { await app.fermer(); }
});

test('liaison d\'ouverture paramétrée : le bilan d\'ouverture poste sur le compte choisi', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.params.comptes_defaut.liaison_ouverture = '58900000';
      DATA.ecritures = [];
      _boLignes = [{ compte: '521', sens: 'D', montant: 1000 }, { compte: '101', sens: 'C', montant: 1000 }];
      document.getElementById('bo-date').value = '2026-01-01';
      const sel = document.getElementById('bo-annee'); if (![].some.call(sel.options, function (o) { return o.value === '2026'; })) { const o = document.createElement('option'); o.value = '2026'; o.textContent = '2026'; sel.appendChild(o); } sel.value = '2026';
      await saveBilanOuverture();
      const bo = DATA.ecritures.filter(function (e) { return e.reference === 'BO-2026'; });
      return bo.map(function (e) { return e.compte_debit + '/' + e.compte_credit; }).sort();
    });
    assert.ok(r.length > 0);
    r.forEach(function (x) { const c = x.split('/'); assert.ok(c.indexOf('58900000') !== -1 && c.indexOf('890') === -1, x); });
  } finally { await app.fermer(); }
});

test('comptes système et formulaire : suivent les paramètres, et l\'enregistrement conserve les nouveaux champs', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.params.comptes_defaut.tva_due = '44410000'; DATA.params.comptes_defaut.liaison_ouverture = '58900000';
      const codes = comptesSystemeRequis().map(function (c) { return c.code; });
      loadComptesDefaut();
      const rempli = document.getElementById('cd-tva-due').value + '/' + document.getElementById('cd-liaison-ouverture').value;
      document.getElementById('cd-tva-credit').value = '44490000'; document.getElementById('cd-regul-cap').value = '42800000';
      await saveComptesDefaut();
      const cd = DATA.params.comptes_defaut;
      return { codes, rempli, tva_due: cd.tva_due, tva_credit: cd.tva_credit, regul_cap: cd.regul_cap, liaison: cd.liaison_ouverture };
    });
    assert.ok(r.codes.indexOf('44410000') !== -1 && r.codes.indexOf('4441') === -1);
    assert.ok(r.codes.indexOf('58900000') !== -1 && r.codes.indexOf('890') === -1);
    assert.equal(r.rempli, '44410000/58900000');
    assert.deepEqual([r.tva_due, r.tva_credit, r.regul_cap, r.liaison], ['44410000', '44490000', '42800000', '58900000']);
  } finally { await app.fermer(); }
});
