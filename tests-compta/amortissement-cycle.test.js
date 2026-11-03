const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Lot 3 de la revue du module amortissement : sortie d'un bien (cession / rebut), modification, suppression. */
async function amorcer(page) {
  await page.evaluate(function () {
    DATA.params.comptes_defaut = Object.assign({}, DATA.params.comptes_defaut, { amort_dotation: '681', treso_banque: '521', treso_caisse: '571' });
    DATA.biens_amort = []; DATA.immobilisations = []; DATA.ecritures = []; DATA.vehicules = [];
    /* bien du promoteur : 1 200 000 sur 5 ans depuis le 01/01/2024, acquisition D 221 / C 481 */
    DATA.biens_amort = [{ id: 'b1', designation: 'Villa', dossier: 'V1', compte_immo: '221', compte_amort: '2812', valeur_origine: 1200000, valeur_residuelle: 0, duree: 5, date_debut: '2024-01-01', methode: 'lineaire' }];
    DATA.ecritures = [{ id: 'ecr_immo_b1', date: '2024-01-01', libelle: 'Immobilisation — Villa', compte: '221', compte_debit: '221', compte_credit: '481', montant: 1200000, type: 'actif', mode: 'interne' }];
    window.__annee = function (a) { const sel = document.getElementById('filter-amort-annee'); sel.innerHTML = '<option value="' + a + '">' + a + '</option>'; sel.value = String(a); };
    window.__sortie = async function (o) {
      ouvrirSortieBien('b1', 'biens_amort');
      const set = function (id, v) { document.getElementById(id).value = v; };
      set('as-type', o.type || 'cession'); set('as-date', o.date); set('as-prix', o.prix === undefined ? '0' : o.prix); set('as-contrepartie', o.contrepartie || '485');
      window.__toasts.length = 0; await confirmerSortieBien();
      return window.__toasts.join(' | ');
    };
    window.__equilibre = function (e) { const L = ecrLignes(e); return L.filter(l => l.sens === 'D').reduce((s, l) => s + l.montant, 0) === L.filter(l => l.sens === 'C').reduce((s, l) => s + l.montant, 0); };
  });
}

test('plan tronqué à la sortie : dotation de l\'année de sortie au prorata, rien après, bien hors bilan', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      const b = { valeur_origine: 1200000, valeur_residuelle: 0, duree: 5, date_debut: '2024-01-01', methode: 'lineaire', date_sortie: '2026-06-30' };
      return { dot: [2024, 2025, 2026, 2027].map(function (a) { return calcAnnuite(b, a); }), cumulBilan: calcAmortCumul(b, 2026), cumulPlan: _amortCumulPlan(b, 2026), vnc: calcVNC(b, 2026), vncAvant: calcVNC(b, 2025) };
    });
    assert.deepEqual(r.dot, [240000, 240000, 120000, 0]);
    assert.equal(r.cumulPlan, 600000); assert.equal(r.cumulBilan, 0); assert.equal(r.vnc, 0); assert.equal(r.vncAvant, 720000);
  } finally { await app.fermer(); }
});

test('cession : dotation arrêtée à la date, écriture de sortie équilibrée, bilan équilibré sans l\'immobilisation, plus-value correcte', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      for (const a of [2024, 2025]) { __annee(a); await comptabiliserDotations(); }
      const msg = await __sortie({ type: 'cession', date: '2026-06-30', prix: '800000', contrepartie: '485' });
      const sortie = DATA.ecritures.find(function (e) { return e.id === 'ecr_sortie_b1'; });
      const dot26 = DATA.ecritures.find(function (e) { return e.id === 'ecr_681_b1_2026'; });
      annee(2026);
      const B = calcBilan(2026, '');
      return { msg: msg, sortie: sortie && { lignes: ecrLignes(sortie).map(function (l) { return l.sens + ' ' + l.compte + ' ' + l.montant; }), equilibre: __equilibre(sortie), date: sortie.date },
               dot26: dot26 && { montant: dot26.montant, date: dot26.date }, bien: DATA.biens_amort[0].date_sortie, immoBrut: B.immoBrut, amort: B.amort, eq: B.equilibre };
    });
    assert.ok(r.sortie, r.msg);
    assert.equal(r.sortie.equilibre, true);
    assert.deepEqual(r.sortie.lignes.sort(), ['C 221 1200000', 'C 822 800000', 'D 2812 600000', 'D 485 800000', 'D 812 600000'].sort());
    assert.deepEqual(r.dot26, { montant: 120000, date: '2026-06-30' });
    assert.equal(r.bien, '2026-06-30');
    assert.equal(r.immoBrut, 0); assert.equal(r.amort, 0); assert.equal(r.eq, true);
    assert.match(r.msg, /plus-value 200[\s  ]?000/);
  } finally { await app.fermer(); }
});

test('mise au rebut : perte de la valeur nette, aucune ligne de prix', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      for (const a of [2024, 2025]) { __annee(a); await comptabiliserDotations(); }
      await __sortie({ type: 'rebut', date: '2026-01-31' });
      const s = DATA.ecritures.find(function (e) { return e.id === 'ecr_sortie_b1'; });
      return { lignes: ecrLignes(s).map(function (l) { return l.sens + ' ' + l.compte + ' ' + l.montant; }).sort(), eq: __equilibre(s) };
    });
    assert.equal(r.eq, true);
    assert.deepEqual(r.lignes, ['C 221 1200000', 'D 2812 500000', 'D 812 700000'].sort());   /* cumul 2024-2025 = 480 000 + dotation 2026 jusqu'au 31/01 = 20 000 → 500 000 ; VNC 700 000 */
  } finally { await app.fermer(); }
});

test('sortie refusée : dotations antérieures non comptabilisées, exercice clos, date avant la mise en service', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const manquantes = await __sortie({ date: '2026-06-30', prix: '1000' });               /* 2024 et 2025 non comptabilisées */
      const etat1 = { sortie: !!DATA.ecritures.find(function (e) { return e.id === 'ecr_sortie_b1'; }), date: DATA.biens_amort[0].date_sortie || null };
      for (const a of [2024, 2025]) { __annee(a); await comptabiliserDotations(); }
      DATA.params.cloture_2026 = true;
      const clos = await __sortie({ date: '2026-06-30', prix: '1000' });
      delete DATA.params.cloture_2026;
      const avant = await __sortie({ date: '2023-06-30', prix: '1000' });
      return { manquantes: manquantes, etat1: etat1, clos: clos, avant: avant, bien: DATA.biens_amort[0].date_sortie || null };
    });
    assert.match(r.manquantes, /Comptabilisez d'abord les dotations 2024, 2025/);
    assert.deepEqual(r.etat1, { sortie: false, date: null });
    assert.match(r.clos, /Exercice clos/); assert.match(r.avant, /précéder la mise en service/);
    assert.equal(r.bien, null);
  } finally { await app.fermer(); }
});

test('annuler une sortie : écriture supprimée, bien de nouveau amorti, dotation réalignée sur le plan complet', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      for (const a of [2024, 2025]) { __annee(a); await comptabiliserDotations(); }
      await __sortie({ date: '2026-06-30', prix: '800000' });
      await annulerSortieBien('b1', 'biens_amort');
      return { sortie: !!DATA.ecritures.find(function (e) { return e.id === 'ecr_sortie_b1'; }), date: DATA.biens_amort[0].date_sortie, dot26: (DATA.ecritures.find(function (e) { return e.id === 'ecr_681_b1_2026'; }) || {}).montant, plan: calcAnnuite(_amortNormaliserBien(DATA.biens_amort[0]), 2026) };
    });
    assert.equal(r.sortie, false); assert.ok(!r.date); assert.equal(r.dot26, 240000); assert.equal(r.plan, 240000);
  } finally { await app.fermer(); }
});

test('modification : avant toute dotation, l\'écriture d\'acquisition suit ; après, les dotations sont réalignées', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const modifier = async function (champs) {
        editBienAmort('b1');
        Object.keys(champs).forEach(function (k) { document.getElementById(k).value = champs[k]; });
        window.__toasts.length = 0; await saveBienAmort(); return window.__toasts.join(' | ');
      };
      const m1 = await modifier({ 'amort-valeur': '1500000' });
      const acq = DATA.ecritures.find(function (e) { return e.id === 'ecr_immo_b1'; }).montant;
      __annee(2025); await comptabiliserDotations();                                  /* dotation 2025 = 300 000 */
      const dot1 = DATA.ecritures.find(function (e) { return e.id === 'ecr_681_b1_2025'; }).montant;
      const m2 = await modifier({ 'amort-valeur': '1800000' });
      const dot2 = DATA.ecritures.find(function (e) { return e.id === 'ecr_681_b1_2025'; }).montant;
      return { m1: m1, acq: acq, dot1: dot1, m2: m2, dot2: dot2, val: DATA.biens_amort[0].valeur_origine, nbEcr: DATA.ecritures.length };
    });
    assert.equal(r.acq, 1500000); assert.equal(r.dot1, 300000);
    assert.equal(r.dot2, 360000); assert.equal(r.val, 1800000);
    assert.match(r.m2, /réalignée/);
  } finally { await app.fermer(); }
});

test('modification verrouillée : dotation visée → montants refusés, désignation et notes modifiables', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      __annee(2025); await comptabiliserDotations();
      const e = DATA.ecritures.find(function (x) { return x.id === 'ecr_681_b1_2025'; }); e.valide_le = '2026-01-10'; await dbPut('ecritures', e);
      editBienAmort('b1');
      document.getElementById('amort-valeur').value = '2000000'; document.getElementById('amort-designation').value = 'Villa rénovée';
      window.__toasts.length = 0; await saveBienAmort(); const refus = window.__toasts.join(' | ');
      const apresRefus = { val: DATA.biens_amort[0].valeur_origine, des: DATA.biens_amort[0].designation };
      editBienAmort('b1');
      document.getElementById('amort-designation').value = 'Villa rénovée'; document.getElementById('amort-notes').value = 'ravalement';
      window.__toasts.length = 0; await saveBienAmort();
      return { refus: refus, apresRefus: apresRefus, des: DATA.biens_amort[0].designation, notes: DATA.biens_amort[0].notes, val: DATA.biens_amort[0].valeur_origine };
    });
    assert.match(r.refus, /verrouillés/);
    assert.deepEqual(r.apresRefus, { val: 1200000, des: 'Villa' });
    assert.equal(r.des, 'Villa rénovée'); assert.equal(r.notes, 'ravalement'); assert.equal(r.val, 1200000);
  } finally { await app.fermer(); }
});

test('suppression d\'un bien : acquisition et dotations supprimées avec lui ; refusée sans rien toucher si une pièce est visée', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      for (const a of [2024, 2025]) { __annee(a); await comptabiliserDotations(); }
      const e = DATA.ecritures.find(function (x) { return x.id === 'ecr_681_b1_2025'; }); e.valide_le = '2026-01-10'; await dbPut('ecritures', e);
      window.__toasts.length = 0; await deleteBienAmort('b1');
      const refus = { msg: window.__toasts.join(' | '), biens: DATA.biens_amort.length, ecr: DATA.ecritures.length };
      /* un second bien, sans pièce visée : supprimé avec ses écritures, sans toucher au premier */
      DATA.biens_amort.push({ id: 'b2', designation: 'Villa 2', compte_immo: '221', compte_amort: '2812', valeur_origine: 600000, valeur_residuelle: 0, duree: 5, date_debut: '2024-01-01' });
      DATA.ecritures.push({ id: 'ecr_immo_b2', date: '2024-01-01', compte: '221', compte_debit: '221', compte_credit: '481', montant: 600000 });
      __annee(2024); await comptabiliserDotations();
      const avant = DATA.ecritures.length;
      await deleteBienAmort('b2');
      return { refus: refus, avant: avant, biens: DATA.biens_amort.map(function (b) { return b.id; }), ecr: DATA.ecritures.length, restantes: DATA.ecritures.filter(function (x) { return /b2/.test(x.id); }).length };
    });
    assert.match(r.refus.msg, /validée/); assert.equal(r.refus.biens, 1); assert.equal(r.refus.ecr, 3);
    assert.equal(r.avant, 3 + 2);              /* b1 : acquisition + 2 dotations ; b2 : acquisition + dotation 2024 (celle de b1 existe déjà : idempotent) */
    assert.deepEqual(r.biens, ['b1']); assert.equal(r.restantes, 0); assert.equal(r.ecr, 3);
  } finally { await app.fermer(); }
});

test('suppression réservée à admin / manager ; immobilisation société : écriture d\'acquisition supprimée et véhicule libéré', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      APP.currentUser = Object.assign({}, APP.currentUser, { role: 'comptable' });
      window.__toasts.length = 0; await deleteBienAmort('b1');
      const comptable = { biens: DATA.biens_amort.length, msg: window.__toasts.join(' ') };
      APP.currentUser = Object.assign({}, APP.currentUser, { role: 'admin' });
      DATA.biens_amort = [];
      DATA.immobilisations = [{ id: 'i1', designation: 'Camion', valeur_acquisition: 1200000, duree_ans: 5, date_acquisition: '2024-01-01', compte: '245', ecriture_acquisition_id: 'ecr_immosoc_i1' }];
      DATA.ecritures = [{ id: 'ecr_immosoc_i1', date: '2024-01-01', compte: '245', compte_debit: '245', compte_credit: '521', montant: 1200000, immobilisation_id: 'i1' }];
      DATA.vehicules = [{ id: 'v1', immatriculation: 'AA-1', immobilisation_id: 'i1' }];
      await deleteImmoSociete('i1');
      return { comptable: comptable, immos: DATA.immobilisations.length, ecr: DATA.ecritures.length, lien: DATA.vehicules[0].immobilisation_id };
    });
    assert.equal(r.comptable.biens, 1); assert.match(r.comptable.msg, /réservée/);
    assert.equal(r.immos, 0); assert.equal(r.ecr, 0); assert.ok(!r.lien);
  } finally { await app.fermer(); }
});

test('immobilisation société sortie : plus de modification des montants (verrou), sortie par le même moteur', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      DATA.biens_amort = []; DATA.ecritures = [E('acq', '2024-01-01', '245', '521', 1200000, { id: 'ecr_immosoc_i1', immobilisation_id: 'i1' })];
      DATA.immobilisations = [{ id: 'i1', designation: 'Camion', valeur_acquisition: 1200000, duree_ans: 5, date_acquisition: '2024-01-01', compte: '245', ecriture_acquisition_id: 'ecr_immosoc_i1' }];
      for (const a of [2024, 2025]) { __annee(a); await comptabiliserDotations(); }
      ouvrirSortieBien('i1', 'immobilisations');
      document.getElementById('as-type').value = 'rebut'; document.getElementById('as-date').value = '2026-03-31';
      await confirmerSortieBien();
      const sorti = DATA.immobilisations[0].date_sortie;
      openImmoSocieteModal('i1'); document.getElementById('is-valeur').value = '2000000';
      window.__toasts.length = 0; await saveImmoSociete();
      return { sorti: sorti, msg: window.__toasts.join(' | '), val: DATA.immobilisations[0].valeur_acquisition, sortieEcr: !!DATA.ecritures.find(function (e) { return e.id === 'ecr_sortie_i1'; }) };
    });
    assert.equal(r.sorti, '2026-03-31'); assert.equal(r.sortieEcr, true);
    assert.match(r.msg, /verrouillés/); assert.equal(r.val, 1200000);
  } finally { await app.fermer(); }
});
