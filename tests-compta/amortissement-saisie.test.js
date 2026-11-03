const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Lot 1 de la revue du module amortissement : calculs aux limites, validation de la saisie, listes, échappement HTML,
   exports CSV, import générique, lien véhicule, droits, périmètre par division. */
async function amorcer(page) {
  await page.evaluate(function () {
    DATA.params.comptes_defaut = Object.assign({}, DATA.params.comptes_defaut, { amort_dotation: '681', fournisseur: '401' });
    DATA.biens_amort = []; DATA.immobilisations = []; DATA.ecritures = []; DATA.divisions = [];
    window.__saisie = function (o) {
      const set = function (id, v) { const e = document.getElementById(id); if (e) e.value = v; };
      set('amort-dossier', o.ref || ''); set('amort-designation', o.des === undefined ? 'Villa test' : o.des); set('amort-valeur', o.val === undefined ? '1200000' : o.val);
      set('amort-date-debut', o.date === undefined ? '2024-01-01' : o.date); set('amort-duree', o.durSel || '20'); set('amort-duree-custom', o.durCustom || '');
      set('amort-valeur-residuelle', o.res === undefined ? '0' : o.res); set('amort-division', o.div || ''); set('amort-methode-input', 'lineaire');
      set('amort-compte-immo', '221'); set('amort-compte-amort', '2812'); set('amort-compte-contrepartie', '481');
    };
  });
}

test('aperçu d\'annuité : le panneau se remplit (avant : parenthèse mal placée, valeur toujours 0)', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(function () {
      __saisie({ val: '1200000', date: '2020-01-01', durSel: '20' });
      document.getElementById('amort-preview-content').innerHTML = 'VIDE';
      calcAmortPreview();
      return document.getElementById('amort-preview-content').textContent;
    });
    assert.ok(!/VIDE/.test(r), 'le panneau doit être rempli');
    assert.match(r, /60[\s  ]?000/);
    assert.match(r, /Fin amortissement : 2039/);
  } finally { await app.fermer(); }
});

test('mise en service en janvier : plus de reliquat d\'1 F sur une année de trop', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      const b = { valeur_origine: 1000, valeur_residuelle: 0, duree: 3, date_debut: '2024-01-01', methode: 'lineaire' };
      return [2024, 2025, 2026, 2027].map(function (a) { return calcAnnuite(b, a); });
    });
    assert.deepEqual(r, [333, 333, 334, 0]);
  } finally { await app.fermer(); }
});

test('cumul borné et durée unique : résiduelle > valeur → cumul 0 ; durée 0, vide ou négative → 25 ans partout', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      return { cumul: calcAmortCumul({ valeur_origine: 1000, valeur_residuelle: 2000, duree: 3, date_debut: '2024-01-01' }, 2030),
               d: [0, '', -3, null, 'x', 7].map(function (d) { return _amortDuree({ duree: d }); }) };
    });
    assert.equal(r.cumul, 0);
    assert.deepEqual(r.d, [25, 25, 25, 25, 25, 7]);
  } finally { await app.fermer(); }
});

test('saisie : valeur négative, résiduelle ≥ valeur, durée invalide, date invalide et doublon sont refusés sans rien écrire', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const essais = [{ val: '-5000' }, { val: '1000000', res: '5000000' }, { val: '1000000', durSel: 'custom', durCustom: '0' }, { val: '1000000', durSel: 'custom', durCustom: '150' },
                      { val: '1000000', date: '2024-13-45' }];
      const refus = [];
      for (const e of essais) { window.__toasts.length = 0; __saisie(e); await saveBienAmort(); refus.push(window.__toasts.join(' ')); }
      const apresRefus = { biens: DATA.biens_amort.length, ecr: DATA.ecritures.length };
      __saisie({ val: '1000000' }); await saveBienAmort(); const ok = DATA.biens_amort.length;
      window.__toasts.length = 0; __saisie({ val: '1000000' }); await saveBienAmort();
      return { refus: refus, apresRefus: apresRefus, ok: ok, apresDoublon: DATA.biens_amort.length, ecr: DATA.ecritures.length, doublon: window.__toasts.join(' ') };
    });
    r.refus.slice(0, 4).forEach(function (m, i) { assert.match(m, /⚠️/, 'essai ' + i + ' : ' + m); });
    assert.match(r.refus[4], /Renseignez|invalide/, 'date impossible : ' + r.refus[4]);   /* le champ date du navigateur vide déjà une date impossible */
    assert.deepEqual(r.apresRefus, { biens: 0, ecr: 0 });
    assert.equal(r.ok, 1); assert.equal(r.apresDoublon, 1); assert.equal(r.ecr, 1);
    assert.match(r.doublon, /déjà enregistré/);
  } finally { await app.fermer(); }
});

test('exercice clos à la date de mise en service : aucun bien orphelin n\'est créé', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      DATA.params.cloture_2023 = true;
      __saisie({ val: '1000000', date: '2023-05-01' }); await saveBienAmort();
      return { biens: DATA.biens_amort.length, ecr: DATA.ecritures.length, msg: window.__toasts.join(' ') };
    });
    assert.equal(r.biens, 0); assert.equal(r.ecr, 0); assert.match(r.msg, /Exercice clos/);
  } finally { await app.fermer(); }
});

test('listes : sélecteur du tableau sans doublon et à jour ; liste des divisions alimentée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(function () {
      DATA.divisions = [{ id: 'D1', nom: 'Division Un' }];
      DATA.biens_amort = [{ id: 'b1', designation: 'Immeuble', valeur_origine: 5000000, duree: 20, date_debut: '2024-01-01', methode: 'lineaire' }];
      DATA.immobilisations = [{ id: 'i1', designation: 'Camion', valeur_acquisition: 1000000, duree_ans: 5, date_acquisition: '2024-01-01', compte: '245' }];
      buildAmortBiens();
      const sel = document.getElementById('filter-amort-bien');
      const n1 = [].map.call(sel.options, function (o) { return o.value + '|' + o.textContent; });
      DATA.biens_amort.push({ id: 'b2', designation: 'Villa', valeur_origine: 1000000, duree: 20, date_debut: '2024-01-01', methode: 'lineaire' });
      buildAmortBiens();
      const n2 = sel.options.length;
      switchAmortTab('nouveau');
      return { n1: n1, n2: n2, div: [].map.call(document.getElementById('amort-division').options, function (o) { return o.textContent; }) };
    });
    assert.equal(r.n1.length, 3); assert.ok(r.n1.some(function (x) { return /^i1\|🚗/.test(x); })); assert.ok(r.n1.some(function (x) { return /^b1\|🏠/.test(x); }));
    assert.equal(r.n2, 4);
    assert.ok(r.div.indexOf('Division Un') >= 0, JSON.stringify(r.div));
  } finally { await app.fermer(); }
});

test('désignation piégée : aucun HTML injecté dans les listes ; import générique (colonnes libelle / valeur_acquisition) sans plantage', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(function () {
      DATA.biens_amort = [
        { id: 'b1', designation: '<b id="xb">gras</b>', dossier: '<i id="xi">x</i>', valeur_origine: 5000000, duree: 20, date_debut: '2024-01-01', methode: 'lineaire' },
        { id: 'b2', libelle: 'Bien importé', valeur_acquisition: 2000000, duree: 10, date_acquisition: '2024-06-01' }];
      let erreur = null; try { buildAmortBiens(); buildDotations(); } catch (e) { erreur = String(e); }
      return { erreur: erreur, injecte: !!document.getElementById('xb') || !!document.getElementById('xi'), texte: document.getElementById('tbody-amort-biens').textContent };
    });
    assert.equal(r.erreur, null); assert.equal(r.injecte, false); assert.match(r.texte, /Bien importé/);
  } finally { await app.fermer(); }
});

test('exports CSV : formule neutralisée, guillemets doublés, BOM UTF-8, séparateur « ; »', async () => {
  const app = await ouvrirApp();
  try {
    let r = await app.page.evaluate(async function () {
      let blob = null; URL.createObjectURL = function (b) { blob = b; return 'blob:x'; }; HTMLAnchorElement.prototype.click = function () {};
      DATA.biens_amort = [{ id: 'b1', designation: '=HYPERLINK("http://x")', dossier: 'a"b;c', valeur_origine: 1000, duree: 5, date_debut: '2024-01-01', methode: 'lineaire' }];
      exportAmortCSV();
      const octets = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3));
      return { octets: octets, texte: await blob.text() };
    });
    assert.deepEqual(r.octets, [0xEF, 0xBB, 0xBF], 'BOM UTF-8');
    r = r.texte;
    assert.match(r, /'=HYPERLINK/);
    assert.match(r, /"a""b;c"/);
    assert.ok(r.split('\r\n')[0].indexOf(';') > 0 && r.split('\r\n')[0].indexOf(',') < 0);
  } finally { await app.fermer(); }
});

test('lien véhicule : une fenêtre annulée ne fuit plus ; un véhicule déjà lié ne peut pas être relié une seconde fois', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(function () {
      window._paImmoLienVehicule = 'v1'; openImmoSocieteModal(null);
      const apresOuverture = window._paImmoLienVehicule;
      DATA.vehicules = [{ id: 'v9', immatriculation: 'AA-1', valeur_acquisition: 9000000, immobilisation_id: 'imm_deja' }];
      window.__toasts.length = 0; window._paImmoLienVehicule = null; paCreerImmobilisation('v9');
      return { apresOuverture: apresOuverture, lien: window._paImmoLienVehicule, msg: window.__toasts.join(' ') };
    });
    assert.equal(r.apresOuverture, null); assert.equal(r.lien, null); assert.match(r.msg, /déjà lié/);
  } finally { await app.fermer(); }
});

test('droits : sans droit « Comptabilité », ni saisie ni dotation n\'écrit quoi que ce soit', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      window.exigerDroit = function () { return false; };
      DATA.immobilisations = [{ id: 'i1', designation: 'Camion', valeur_acquisition: 1200000, duree_ans: 5, date_acquisition: '2024-01-01', compte: '245' }];
      __saisie({ val: '1000000' }); await saveBienAmort(); await comptabiliserDotations(); await genererDotationsAnnuelles();
      return { biens: DATA.biens_amort.length, ecr: DATA.ecritures.length };
    });
    assert.deepEqual(r, { biens: 0, ecr: 0 });
  } finally { await app.fermer(); }
});

test('périmètre par division : un rôle limité à D1 ne voit que ses biens (et ceux sans division)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.biens_amort = [{ id: 'a', designation: 'A', division_id: 'D1', valeur_origine: 1000, duree: 5, date_debut: '2024-01-01' }, { id: 'b', designation: 'B', division_id: 'D2', valeur_origine: 1000, duree: 5, date_debut: '2024-01-01' }, { id: 'c', designation: 'C', valeur_origine: 1000, duree: 5, date_debut: '2024-01-01' }];
      DATA.immobilisations = [];
      window.userScopeDivision = function () { return 'D1'; };
      return _amortTousBiens().map(function (b) { return b.id; }).sort();
    });
    assert.deepEqual(r, ['a', 'c']);
  } finally { await app.fermer(); }
});
