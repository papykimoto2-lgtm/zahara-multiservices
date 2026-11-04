const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Revue comptabilité, lot 2 : verrou de clôture par division dans la couche données, exclusion clôture consolidée /
   clôture par division, bilan d'ouverture visé d'office, FEC (dates, arrondi par pièce). */

test('clôture d\'une division : ses écritures sont verrouillées (création, modification), pas celles d\'une autre division', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.ecritures = [E('ex', '2025-03-01', '521', '701', 500, { division: 'd1' })];
      await dbPut('ecritures', DATA.ecritures[0]);
      DATA.params['cloture_2025-d1'] = true;
      const n = async function (id) { return (await dbGetAll('ecritures')).filter(function (x) { return x.id === id; }).length; };
      const nv1 = E('nv1', '2025-06-01', '521', '701', 100, { division: 'd1' }), nv2 = E('nv2', '2025-06-01', '521', '701', 100, { division: 'd2' });
      await dbPut('ecritures', nv1); await dbPut('ecritures', nv2);
      const modif = Object.assign({}, DATA.ecritures[0], { libelle: 'MODIFIE' });
      await dbPut('ecritures', modif);
      const lu = (await dbGetAll('ecritures')).find(function (x) { return x.id === 'ex'; });
      return { d1Nouveau: await n('nv1'), d2Nouveau: await n('nv2'), libelle: lu && lu.libelle, annee: exerciceEstClos('2026-01-01', 'd1') };
    });
    assert.equal(r.d1Nouveau, 0, 'création dans la division close refusée');
    assert.equal(r.d2Nouveau, 1, 'autre division inchangée');
    assert.notEqual(r.libelle, 'MODIFIE');
    assert.equal(r.annee, false);
  } finally { await app.fermer(); }
});

test('clôture consolidée refusée si une division est déjà clôturée la même année', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.ecritures = [];
      DATA.params['cloture_2025-d1'] = true;
      await cloturerExercice(2025, '');
      return { clos: DATA.params.cloture_2025 === true, msg: window.__toasts.join(' | ') };
    });
    assert.equal(r.clos, false);
    assert.match(r.msg, /Clôture consolidée impossible/);
  } finally { await app.fermer(); }
});

test('bilan d\'ouverture : visé d\'office, ne bloque plus la clôture de son exercice, sort au FEC avec une ValidDate', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.ecritures = [];
      _boLignes = [{ compte: '521', sens: 'D', montant: 1000 }, { compte: '101', sens: 'C', montant: 1000 }];
      document.getElementById('bo-date').value = '2025-01-01';
      const sel = document.getElementById('bo-annee'); if (![].some.call(sel.options, function (o) { return o.value === '2025'; })) { const o = document.createElement('option'); o.value = '2025'; o.textContent = '2025'; sel.appendChild(o); } sel.value = '2025';
      await saveBilanOuverture();
      const bo = DATA.ecritures.filter(function (e) { return e.reference === 'BO-2025'; });
      const vises = bo.length > 0 && bo.every(function (e) { return !!e.valide_le && e.statut_ecr === 'valide'; });
      window.__toasts = [];
      await cloturerExercice(2025, '');
      return { nb: bo.length, vises, clos: DATA.params.cloture_2025 === true, msg: window.__toasts.join(' | ') };
    });
    assert.ok(r.nb > 0);
    assert.equal(r.vises, true);
    assert.equal(r.clos, true, r.msg);
  } finally { await app.fermer(); }
});

test('FEC : date avec heure au format AAAAMMJJ et pièce équilibrée malgré les arrondis ligne à ligne', async () => {
  const app = await ouvrirApp();
  try {
    const lignes = await app.page.evaluate(async function () {
      const blobs = [];
      URL.createObjectURL = function (b) { blobs.push(b); return 'blob:x'; };
      HTMLAnchorElement.prototype.click = function () {};
      DATA.ecritures = [{ id: 'p1', date: '2025-03-01T10:00:00', libelle: 'Arrondis', piece: 'P1', valide_le: '2025-03-02T08:00:00.000Z',
        lignes: [{ compte: '601', sens: 'D', montant: 33.33 }, { compte: '602', sens: 'D', montant: 33.33 }, { compte: '603', sens: 'D', montant: 33.33 }, { compte: '521', sens: 'C', montant: 99.99 }] }];
      exporterFEC(2025, '');
      return (await blobs[0].text()).replace(/^﻿/, '').split('\r\n').slice(1);
    });
    const cols = lignes.map(function (l) { return l.split('|'); });
    cols.forEach(function (c) { assert.equal(c[3], '20250301'); assert.equal(c[9], '20250301'); });
    const D = cols.reduce(function (a, c) { return a + (+c[11]); }, 0), C = cols.reduce(function (a, c) { return a + (+c[12]); }, 0);
    assert.equal(D, C);
  } finally { await app.fermer(); }
});
