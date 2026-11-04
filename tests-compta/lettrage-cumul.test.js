const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Lettrage : exercices cumulés depuis le dernier bilan d'ouverture, lignes sans tiers identifié jamais lettrées automatiquement. */
const piece = (id, date, sens, compte, m, tiers, extra) => Object.assign({ id: id, date: date, libelle: id, piece: id,
  lignes: [{ compte: compte, sens: sens, montant: m, tiers_id: tiers }, { compte: '521', sens: sens === 'D' ? 'C' : 'D', montant: m }] }, extra || {});

test('facture d\'un exercice non clôturé et règlement de l\'exercice suivant : lettrés ensemble ; « exercice seul » garde l\'ancien comportement', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      const piece = eval('(' + f + ')');
      DATA.ecritures = [piece('fac', '2025-03-10', 'D', '411', 1000, 'T1'), piece('reg', '2026-02-05', 'C', '411', 1000, 'T1')];
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'lett-exercice-seul'; cb.checked = true; document.body.appendChild(cb);
      await lettrageAuto(2026);
      const seul = ecrLettres(DATA.ecritures[0]).length + ecrLettres(DATA.ecritures[1]).length;
      cb.checked = false;
      await lettrageAuto(2026);
      const cumul = { fac: ecrLettres(DATA.ecritures[0])[0], reg: ecrLettres(DATA.ecritures[1])[0] };
      cb.remove();
      return { seul, cumul };
    }, piece.toString());
    assert.equal(r.seul, 0);
    assert.ok(r.cumul.fac && r.cumul.fac === r.cumul.reg, JSON.stringify(r.cumul));
  } finally { await app.fermer(); }
});

test('après clôture : l\'à-nouveau porte le solde, la facture de l\'exercice clos n\'est pas comptée deux fois', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      const piece = eval('(' + f + ')');
      DATA.ecritures = [piece('fac', '2024-03-10', 'D', '411', 1000, 'T1'),
        piece('an', '2025-01-01', 'D', '411', 1000, 'T1', { journal: 'AN', type: 'a_nouveau' }),
        piece('reg', '2025-02-05', 'C', '411', 1000, 'T1')];
      await lettrageAuto(2025);
      return { fac: ecrLettres(DATA.ecritures[0]).length, an: ecrLettres(DATA.ecritures[1])[0], reg: ecrLettres(DATA.ecritures[2])[0] };
    }, piece.toString());
    assert.equal(r.fac, 0);
    assert.ok(r.an && r.an === r.reg);
  } finally { await app.fermer(); }
});

test('sans tiers identifié : jamais lettré automatiquement (clients différents), sous-compte propre au tiers : lettré', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      const piece = eval('(' + f + ')');
      DATA.ecritures = [piece('a', '2026-03-01', 'D', '411', 100, ''), piece('b', '2026-03-02', 'C', '411', 100, ''),
        piece('c', '2026-03-01', 'D', '41110001', 200, ''), piece('d', '2026-03-02', 'C', '41110001', 200, '')];
      const el = document.createElement('div'); el.id = 'lettrage-result'; document.body.appendChild(el);
      await lettrageAuto(2026);
      const res = { sansTiers: ecrLettres(DATA.ecritures[0]).length + ecrLettres(DATA.ecritures[1]).length,
        sousCompte: ecrLettres(DATA.ecritures[2])[0] && ecrLettres(DATA.ecritures[2])[0] === ecrLettres(DATA.ecritures[3])[0], msg: el.innerHTML };
      el.remove();
      return res;
    }, piece.toString());
    assert.equal(r.sansTiers, 0);
    assert.equal(r.sousCompte, true);
    assert.match(r.msg, /2 ligne\(s\) sans tiers identifié/);
  } finally { await app.fermer(); }
});

test('postes ouverts : une facture d\'un exercice antérieur non clôturé figure dans les postes ouverts', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function (f) {
      const piece = eval('(' + f + ')');
      DATA.ecritures = [piece('fac', '2025-03-10', 'D', '411', 1000, 'T1')];
      const el = document.createElement('div'); el.id = 'lettrage-result'; document.body.appendChild(el);
      etatNonLettres(2026);
      const h = el.innerHTML; el.remove();
      return h;
    }, piece.toString());
    assert.doesNotMatch(r, /Aucun poste ouvert/);
  } finally { await app.fermer(); }
});
