const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Un versement et son écriture automatique, persistée comme en production. */
async function amorcer(page) {
  await page.evaluate(async function () {
    DATA.clients = [{ id: 'c1', nom: 'KOUASSI', prenoms: 'Jean' }];
    window.__v = { id: 'v1', client_id: 'c1', date: '2025-05-05', montant: 100, mode: 'virement', type: 'apport', ref: 'VRS-2025-0001' };
    DATA.versements = [window.__v];
    await genererEcritureVersement(window.__v);
  });
}

test('écriture automatique visée : une modification du versement ne lui retire pas son visa', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const e = DATA.ecritures.find(function (x) { return x.id === 'ecr_vrs_v1'; });
      e.valide_le = '2025-06-01T10:00:00Z'; e.valide_par = 'Resp'; e.statut_ecr = 'valide';
      await dbPut('ecritures', e);                       /* le visa est persisté */
      __v.montant = 999;
      await genererEcritureVersement(__v);               /* le générateur reconstruit l'écriture */
      const apres = DATA.ecritures.find(function (x) { return x.id === 'ecr_vrs_v1'; });
      return { montant: apres.montant, valide_le: apres.valide_le, nb: DATA.ecritures.length, toasts: __toasts, sync: __sync.filter(function (s) { return s.id === 'ecr_vrs_v1'; }) };
    });
    assert.equal(r.montant, 100);                    /* la pièce visée est intacte */
    assert.ok(r.valide_le, 'le visa doit rester');
    assert.equal(r.nb, 1);
    assert.ok(r.toasts.some(function (t) { return /Pièce visée/.test(t) && /contre-passation/.test(t); }));
    assert.ok(r.sync[r.sync.length - 1].rejete, 'l\'écriture refusée n\'est pas envoyée au cloud');
  } finally { await app.fermer(); }
});

test('exercice clos : l\'écriture d\'un versement reste en mémoire et inchangée si on tente de la régénérer', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      DATA.params.cloture_2025 = true;
      __v.montant = 777;
      await genererEcritureVersement(__v);
      const e = DATA.ecritures.find(function (x) { return x.id === 'ecr_vrs_v1'; });
      return { present: !!e, montant: e && e.montant };
    });
    assert.equal(r.present, true);       /* avant : l'écriture disparaissait de la mémoire */
    assert.equal(r.montant, 100);
  } finally { await app.fermer(); }
});

test('versement : modification et suppression refusées si l\'écriture est visée ou l\'exercice clos', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const e = DATA.ecritures.find(function (x) { return x.id === 'ecr_vrs_v1'; });
      const libre = vrsEcritureVerrouillee('v1', '2025-05-06');
      e.valide_le = '2025-06-01T10:00:00Z'; await dbPut('ecritures', e);
      const visee = vrsEcritureVerrouillee('v1');
      delete e.valide_le; DATA.params.cloture_2025 = true;
      const clos = vrsEcritureVerrouillee('v1');
      DATA.params.cloture_2025 = false; DATA.params.cloture_2026 = true;
      const dateClose = vrsEcritureVerrouillee('v1', '2026-01-10');
      DATA.params.cloture_2026 = false;
      e.valide_le = '2025-06-01T10:00:00Z';
      await deleteVersement('v1', true);
      return { libre: libre, visee: visee, clos: clos, dateClose: dateClose, versementsRestants: DATA.versements.length, ecr: DATA.ecritures.length, toasts: __toasts };
    });
    assert.equal(r.libre, '');
    assert.match(r.visee, /visée/);
    assert.match(r.clos, /clôturé/);
    assert.match(r.dateClose, /nouvelle date/);
    assert.equal(r.versementsRestants, 1);   /* la suppression n'a pas eu lieu */
    assert.equal(r.ecr, 1);
    assert.ok(r.toasts.some(function (t) { return /Suppression impossible/.test(t); }));
  } finally { await app.fermer(); }
});

test('dévalidation par l\'administrateur : le visa se lève (avec motif) et se retrace', async () => {
  const app = await ouvrirApp();
  try {
    app.etat.prompts.push('Erreur de saisie constatée');
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      const e = DATA.ecritures.find(function (x) { return x.id === 'ecr_vrs_v1'; });
      e.valide_le = '2025-06-01T10:00:00Z'; e.valide_par = 'Resp'; e.statut_ecr = 'valide';
      await dbPut('ecritures', e);
      annee(2025);
      await devaliderPerimetre();
      const apres = DATA.ecritures.find(function (x) { return x.id === 'ecr_vrs_v1'; });
      return { visa: apres.valide_le || null, histo: (apres.devalide_historique || []).length };
    });
    assert.equal(r.visa, null);
    assert.equal(r.histo, 1);
  } finally { await app.fermer(); }
});

test('contre-passation d\'une pièce d\'un exercice clos : la pièce d\'origine est marquée, impossible de la contre-passer deux fois', async () => {
  const app = await ouvrirApp();
  try {
    app.etat.prompts.push('2026-01-15', 'Annulation test', '2026-01-16', 'Encore');
    const r = await app.page.evaluate(async function () {
      const e = Object.assign(E('orig', '2025-03-01', '512', '4111', 500), { valide_le: '2025-04-01', piece: 'FAC-9' });
      DATA.ecritures = [e]; await dbPut('ecritures', e);
      DATA.params.cloture_2025 = true;
      await contrePasserEcriture('orig');
      await contrePasserEcriture('orig');
      const src = DATA.ecritures.find(function (x) { return x.id === 'orig'; });
      return { marque: src.contrepassee_par, nb: DATA.ecritures.length, inverse: DATA.ecritures[1].lignes.map(function (l) { return l.compte + l.sens; }) };
    });
    assert.equal(r.marque, 'CP-FAC-9');
    assert.equal(r.nb, 2);                       /* une seule contre-passation */
    assert.deepEqual(r.inverse, ['512C', '4111D']);
  } finally { await app.fermer(); }
});
