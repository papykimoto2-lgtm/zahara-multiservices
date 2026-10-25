const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* ── PAIE ─────────────────────────────────────────────────────────────── */
function prepPaie() {
  DATA.params.comptes_defaut = Object.assign(DATA.params.comptes_defaut, { paie_its: '4472', paie_charge: '641', paie_charge_pat: '645', paie_du: '422', paie_cnps: '431', paie_avances: '4251', paie_retenues: '4281' });
  const emp = function (id, nom) { return { id: id, nom: nom, prenoms: '', matricule: id, division: '' }; };
  window._paieMoisData = function () {
    return [{ emp: emp('e1', 'KONE'), brut: 1000, net: 800, cnpsSal: 100, itsSal: 100, itsPat: 0, cmuSal: 0, cmuPat: 0, cnpsPatSocial: 200, fdfp: 0, its: 100, avances: 0, retenues: 0, patronal: 200 },
            { emp: emp('e2', 'DIALLO'), brut: 2000, net: 1600, cnpsSal: 200, itsSal: 200, itsPat: 0, cmuSal: 0, cmuPat: 0, cnpsPatSocial: 400, fdfp: 0, its: 200, avances: 0, retenues: 0, patronal: 400 }];
  };
  window._compteAuxiliaireEmploye = function (e) { return '4211' + e.id.slice(1); };
}
const soldeParCompte = function () {
  const s = {};
  DATA.ecritures.forEach(function (e) { ecrLignes(e).forEach(function (l) { s[l.compte] = (s[l.compte] || 0) + (l.sens === 'D' ? 1 : -1) * l.montant; }); });
  return s;
};

test('paie en détail : le règlement solde le compte individuel de chaque salarié (421XXX), avec son tiers', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (o) {
      eval('(' + o.f + ')')(); const solde = eval('(' + o.g + ')');
      const res = await comptabiliserPaie('2025-03', { mode: 'detail', reglement: true });
      const s = solde();
      const lignes = [].concat.apply([], DATA.ecritures.map(function (e) { return e.lignes; }));
      return { ok: res.ok, s4211: s['42111'], s4212: s['42112'], generique: s['422'] || 0,
        tiersNet: lignes.filter(function (l) { return l.compte === '42111' && l.sens === 'C'; }).map(function (l) { return l.tiers_id; }),
        tiersRegl: lignes.filter(function (l) { return l.compte === '42111' && l.sens === 'D'; }).map(function (l) { return l.tiers_id; }) };
    }, { f: prepPaie.toString(), g: soldeParCompte.toString() });
    assert.equal(r.ok, true);
    assert.equal(r.s4211, 0);          /* net à payer crédité puis réglé : compte individuel soldé */
    assert.equal(r.s4212, 0);
    assert.equal(r.generique, 0);      /* et le compte générique n'accumule plus de débit */
    assert.deepEqual(r.tiersNet, ['e1']);
    assert.deepEqual(r.tiersRegl, ['e1']);
  } finally { await app.fermer(); }
});

test('paie : un mois visé ne se régénère pas (pas de double comptage) et ne se décomptabilise pas', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      await comptabiliserPaie('2025-03', { mode: 'detail', reglement: true });
      const nb = DATA.ecritures.length;
      for (const e of DATA.ecritures) { e.valide_le = '2025-04-01'; await dbPut('ecritures', e); }
      const regen = await comptabiliserPaie('2025-03', { mode: 'global', reglement: true });   /* changement de mode : ids différents */
      const dec = await decomptabiliserPaie('2025-03');
      return { nb: nb, apres: DATA.ecritures.length, regen: regen, dec: dec };
    }, prepPaie.toString());
    assert.equal(r.regen.ok, false);
    assert.match(r.regen.msg, /visée/);
    assert.equal(r.apres, r.nb);
    assert.equal(r.dec, 0);
  } finally { await app.fermer(); }
});

test('paie : mois dans un exercice clos refusé sans rien supprimer', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      DATA.params.cloture_2025 = true;
      const res = await comptabiliserPaie('2025-03', { mode: 'detail', reglement: true });
      return { ok: res.ok, msg: res.msg, nb: DATA.ecritures.length };
    }, prepPaie.toString());
    assert.equal(r.ok, false);
    assert.match(r.msg, /clôturé/);
    assert.equal(r.nb, 0);
  } finally { await app.fermer(); }
});

/* ── DOTATIONS ────────────────────────────────────────────────────────── */
test('amortissement : le bien est amorti en totalité, prorata temporis, linéaire et dégressif', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      const lin = { valeur_origine: 1200000, valeur_residuelle: 0, duree: 5, date_debut: '2024-07-01', methode: 'lineaire' };
      const deg = { valeur_origine: 1000000, valeur_residuelle: 100000, duree: 5, date_debut: '2024-01-01', methode: 'degressif' };
      const somme = function (b) { let t = 0; for (let a = 2024; a <= 2032; a++) t += calcAnnuite(b, a); return t; };
      return { lin: [2024, 2025, 2028, 2029, 2030].map(function (a) { return calcAnnuite(lin, a); }), totLin: somme(lin), totDeg: somme(deg), base: 900000,
               degAn1: calcAnnuite(deg, 2024), degAn2: calcAnnuite(deg, 2025), vncLin: calcVNC(lin, 2029) };
    });
    assert.deepEqual(r.lin, [120000, 240000, 240000, 120000, 0]);   /* 6/12 la 1re année ; la fraction manquante est amortie en 2029 */
    assert.equal(r.totLin, 1200000);
    assert.equal(r.totDeg, 900000);
    assert.ok(r.degAn1 > r.degAn2, 'le dégressif décroît');
    assert.equal(r.vncLin, 0);
  } finally { await app.fermer(); }
});

test('amortissement : les deux registres donnent la même dotation (une seule formule)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      const im = { id: 'im1', designation: 'Camion', valeur_acquisition: 1200000, valeur_residuelle: 0, duree_ans: 5, date_acquisition: '2024-07-01', methode: 'lineaire' };
      return { reg1: immoSocCalc(im, 2024).dotationAnnuelle, reg2: calcAnnuite(_amortAdapterImmo(im), 2024), vnc: immoSocCalc(im, 2025).vnc };
    });
    assert.equal(r.reg1, r.reg2);
    assert.equal(r.reg1, 120000);
    assert.equal(r.vnc, 1200000 - 120000 - 240000);
  } finally { await app.fermer(); }
});

test('dotations : une dotation visée identique n\'est pas refaite ; différente → signalée ; contre-passée → écriture de révision', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.params.comptes_defaut.amort_dotation = '681';
      DATA.immobilisations = [{ id: 'im1', designation: 'Camion', valeur_acquisition: 1200000, valeur_residuelle: 0, duree_ans: 5, date_acquisition: '2024-01-01', methode: 'lineaire', compte: '245' }];
      const sel = document.getElementById('filter-amort-annee'); sel.innerHTML = '<option value="2025">2025</option>'; sel.value = '2025';
      await comptabiliserDotations();
      const e = DATA.ecritures.find(function (x) { return x.id === 'ecr_immosoc_dot_im1_2025'; });
      const montant = e.montant;
      e.valide_le = '2026-01-10'; await dbPut('ecritures', e);
      await comptabiliserDotations();                                        /* identique et visée : rien */
      const apresIdentique = DATA.ecritures.length;
      DATA.immobilisations[0].valeur_acquisition = 1800000;                  /* le calcul change */
      window.__toasts.length = 0; await comptabiliserDotations();
      const alerte = window.__toasts.join(' ');
      const apresDivergent = DATA.ecritures.length;
      e.contrepassee_par = 'CP-X'; await dbPut('ecritures', e, { forceCloture: true });
      await comptabiliserDotations();                                        /* contre-passée : révision */
      const rev = DATA.ecritures.find(function (x) { return x.id === 'ecr_immosoc_dot_im1_2025_r2'; });
      return { montant: montant, apresIdentique: apresIdentique, apresDivergent: apresDivergent, alerte: alerte, rev: rev && rev.montant, orig: DATA.ecritures.find(function (x) { return x.id === 'ecr_immosoc_dot_im1_2025'; }).montant };
    });
    assert.equal(r.montant, 240000);
    assert.equal(r.apresIdentique, 1);
    assert.equal(r.apresDivergent, 1);
    assert.match(r.alerte, /contre-passer/);
    assert.equal(r.rev, 360000);
    assert.equal(r.orig, 240000);       /* la pièce visée d'origine est intacte */
  } finally { await app.fermer(); }
});

/* ── CESSIONS FONCIÈRES ───────────────────────────────────────────────── */
function prepCes() {
  DATA.params.comptes_defaut = Object.assign(DATA.params.comptes_defaut, { cession_produit: '702', client_foncier: '4112' });
  DATA.cessions_foncieres = [{ id: 'ces1', dossier: 'CF0001', date: '2025-03-01', prix_cession: 1000, montant_encaisse: 300, acquereur: 'DIABATE', designation: 'Lot 12', source_key: '', nb_lots: 1, paiements: [] }];
}
test('cession : les écritures sont idempotentes et suivent une modification de prix ou d\'encaissement', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      const c = DATA.cessions_foncieres[0];
      await cesGenererEcriture(c);
      const nb1 = DATA.ecritures.length, ref1 = DATA.ecritures[0].ref;
      c.prix_cession = 1200; c.montant_encaisse = 500;
      await cesGenererEcriture(c);
      const vente = DATA.ecritures.find(function (e) { return e.id === c.ecriture_vente_id; }), enc = DATA.ecritures.find(function (e) { return e.id === c.ecriture_enc_id; });
      const tiers = ecrLignes(vente).filter(function (l) { return l.compte === '4112'; }).map(function (l) { return ecrTiersLigne(vente, l); });
      return { nb1: nb1, nb2: DATA.ecritures.length, ref: vente.ref === ref1, vente: vente.montant, enc: enc.montant, tiers: tiers };
    }, prepCes.toString());
    assert.equal(r.nb1, 2);
    assert.equal(r.nb2, 2);                  /* pas de doublon */
    assert.equal(r.ref, true);               /* référence conservée */
    assert.equal(r.vente, 1200);
    assert.equal(r.enc, 500);
    assert.deepEqual(r.tiers, ['ces1']);     /* tiers = la cession */
  } finally { await app.fermer(); }
});

test('cession : encaissement initial = total encaissé − versements déjà enregistrés', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      const c = DATA.cessions_foncieres[0];
      c.paiements = [{ id: 'p1', montant: 200 }]; c.montant_encaisse = 500;
      await cesGenererEcriture(c);
      return DATA.ecritures.find(function (e) { return e.id === c.ecriture_enc_id; }).montant;
    }, prepCes.toString());
    assert.equal(r, 300);
  } finally { await app.fermer(); }
});

test('cession : suppression complète (vente, stock, encaissement, recouvrements), refusée si une écriture est visée', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      const c = DATA.cessions_foncieres[0];
      await cesGenererEcriture(c);
      const stock = Object.assign(E('ecr_ces_stock_ces1', '2025-03-01', '712', '331', 100), { cession_id: 'ces1' });
      const recouv = Object.assign(E('rec1', '2025-04-01', '521', '4112', 50), { cession_id: 'ces1', source: 'recouvrement_cession' });
      DATA.ecritures.push(stock, recouv); await dbPut('ecritures', stock); await dbPut('ecritures', recouv);
      c.ecriture_stock_id = stock.id;
      const vente = DATA.ecritures.find(function (e) { return e.id === c.ecriture_vente_id; });
      vente.valide_le = '2025-05-01'; await dbPut('ecritures', vente);
      _cesId = 'ces1';
      await cesDelete();
      const refusee = { cessions: DATA.cessions_foncieres.length, ecr: DATA.ecritures.length };
      delete vente.valide_le; await dbPut('ecritures', vente, { forceVisa: true });
      await cesDelete();
      return { refusee: refusee, cessions: DATA.cessions_foncieres.length, ecr: DATA.ecritures.length };
    }, prepCes.toString());
    assert.deepEqual(r.refusee, { cessions: 1, ecr: 4 });
    assert.equal(r.cessions, 0);
    assert.equal(r.ecr, 0);       /* y compris la sortie de stock, qui restait orpheline */
  } finally { await app.fermer(); }
});

test('cession : versement d\'un acquéreur sur exercice clos refusé avant tout enregistrement', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      DATA.params.cloture_2025 = true;
      _crecId = 'ces1'; _crecEditPaiementId = null;
      for (const [id, v] of [['crecp-montant', '100'], ['crecp-date', '2025-06-01'], ['crecp-mode', 'virement']]) {
        let el = document.getElementById(id); if (!el) { el = document.createElement('input'); el.id = id; document.body.appendChild(el); } el.value = v;
      }
      await crecSavePaiement();
      return { paiements: DATA.cessions_foncieres[0].paiements.length, verse: DATA.cessions_foncieres[0].montant_encaisse, toasts: window.__toasts };
    }, prepCes.toString());
    assert.equal(r.paiements, 0);
    assert.equal(r.verse, 300);
    assert.ok(r.toasts.some(function (t) { return /clôturé/.test(t); }));
  } finally { await app.fermer(); }
});
