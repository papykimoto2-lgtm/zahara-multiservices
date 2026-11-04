const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Revue comptabilité, lot 3 : suppression d'écritures lettrées ou liées, lettrage automatique (numérotation), délettrage. */
const ecrTiers = function (id, date, d, c, m, tiers) {
  return { id: id, date: date, libelle: 'T ' + id, piece: id, lignes: [{ compte: d, sens: 'D', montant: m, tiers_id: tiers }, { compte: c, sens: 'C', montant: m }] };
};

test('une écriture lettrée ne se supprime pas ; délettrée, elle se supprime', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const e = E('l1', '2026-02-01', '411', '701', 100); e.lignes[0].lettrage = 'L260001';
      DATA.ecritures = [e]; await dbPut('ecritures', e);
      const refuse = await deleteRecord('ecritures', 'l1');
      const encore = DATA.ecritures.some(function (x) { return x.id === 'l1'; });
      delete e.lignes[0].lettrage; delete e.lettrage;
      const ok = await deleteRecord('ecritures', 'l1');
      return { refuse, encore, ok };
    });
    assert.equal(r.refuse, false);
    assert.equal(r.encore, true);
    assert.notEqual(r.ok, false);
  } finally { await app.fermer(); }
});

test('suppression manuelle : refusée si un document référence l\'écriture ou si elle est liée à une contre-passation', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const a = E('r1', '2026-02-01', '521', '701', 100), b = E('r2', '2026-02-01', '521', '701', 100, { contrepassee_par: 'CP-1' }), c = E('r3', '2026-02-01', '521', '701', 100);
      DATA.ecritures = [a, b, c]; for (const x of DATA.ecritures) await dbPut('ecritures', x);
      DATA.versements = [{ id: 'v1', ecriture_id: 'r1' }];
      await deleteEcriture('r1'); await deleteEcriture('r2'); await deleteEcriture('r3');
      return { ids: DATA.ecritures.map(function (x) { return x.id; }).sort(), toasts: window.__toasts.join(' | ') };
    });
    assert.deepEqual(r.ids, ['r1', 'r2']);
    assert.match(r.toasts, /rattachée à 1 document/);
    assert.match(r.toasts, /contre-passation/);
  } finally { await app.fermer(); }
});

test('versement : la modification / suppression est refusée tant que son écriture est lettrée', async () => {
  const app = await ouvrirApp();
  try {
    const motif = await app.page.evaluate(function () {
      const e = E('ecr_vrs_v9', '2026-02-01', '411', '701', 100); e.lignes[0].lettrage = 'L260007';
      DATA.ecritures = [e];
      return vrsEcritureVerrouillee('v9');
    });
    assert.match(motif, /lettrée \(L260007\)/);
  } finally { await app.fermer(); }
});

test('lettrage automatique : un second lancement ne réutilise pas les lettres déjà posées', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const paire = function (id, t) { return [ecrT(id + 'a', '2026-02-01', '411', '701', 100, t), ecrT(id + 'b', '2026-02-02', '521', '411', 100, t)]; };
      function ecrT(id, date, d, c, m, t) { return { id: id, date: date, libelle: id, piece: id, lignes: [{ compte: d, sens: 'D', montant: m, tiers_id: t }, { compte: c, sens: 'C', montant: m, tiers_id: t }] }; }
      DATA.ecritures = paire('p1', 'T1'); await lettrageAuto(2026);
      const l1 = ecrLettres(DATA.ecritures[0]).concat(ecrLettres(DATA.ecritures[1]));
      DATA.ecritures = DATA.ecritures.concat(paire('p2', 'T2')); await lettrageAuto(2026);
      const l2 = ecrLettres(DATA.ecritures[2]).concat(ecrLettres(DATA.ecritures[3]));
      return { l1: l1, l2: l2 };
    });
    assert.ok(r.l1.length > 0 && r.l2.length > 0, JSON.stringify(r));
    r.l2.forEach(function (x) { assert.ok(r.l1.indexOf(x) === -1, 'lettre réutilisée : ' + x); });
  } finally { await app.fermer(); }
});

test('délettrage en masse refusé sur un exercice clôturé', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const e = E('d1', '2026-02-01', '411', '701', 100); e.lignes[0].lettrage = 'L260001'; e.lettrage = 'L260001';
      DATA.ecritures = [e]; DATA.params.cloture_2026 = true;
      await delettrageAuto(2026);
      return { lettre: ecrLettres(DATA.ecritures[0]).length, msg: window.__toasts.join(' | ') };
    });
    assert.ok(r.lettre > 0);
    assert.match(r.msg, /délettrage en masse est impossible/);
  } finally { await app.fermer(); }
});
