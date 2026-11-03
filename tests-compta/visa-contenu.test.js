const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('pièce visée : changer montant/compte est refusé même si valide_le est conservé ; lettrage et contre-passation restent possibles', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const e = { id: 'e1', ref: 'JL-2026-00001', date: '2026-03-01', libelle: 'Test', journal: 'OD',
        lignes: [{ compte: '6011', sens: 'D', montant: 1000 }, { compte: '571', sens: 'C', montant: 1000 }],
        montant: 1000, valide_le: '2026-03-02T10:00:00Z', statut_ecr: 'valide' };
      DATA.ecritures = [e];
      await dbPut('ecritures', JSON.parse(JSON.stringify(e)));
      const modif = JSON.parse(JSON.stringify(e)); modif.lignes[0].montant = 5000; modif.lignes[1].montant = 5000;
      const r1 = await dbPut('ecritures', modif);
      const lett = JSON.parse(JSON.stringify(e)); lett.lignes[0].lettre = 'AA'; lett.contrepassee_par = 'X';
      const r2 = await dbPut('ecritures', lett);
      return { refuse: r1 === false, lettrageOk: r2 !== false, montantGarde: DATA.ecritures[0].lignes[0].montant };
    });
    assert.equal(r.refuse, true);
    assert.equal(r.lettrageOk, true);
  } finally { await app.fermer(); }
});

test('numérotation : un numéro supprimé n\'est jamais réattribué', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function () {
      DATA.ecritures = [];
      const n1 = prochainNumeroRef('ecritures', 'JL', 2026, 5);
      DATA.ecritures = [{ id: 'a', ref: 'JL-2026-' + n1 }];
      const n2 = prochainNumeroRef('ecritures', 'JL', 2026, 5);
      DATA.ecritures = [];                                   /* suppression de toutes les pièces */
      const n3 = prochainNumeroRef('ecritures', 'JL', 2026, 5);
      return [n1, n2, n3];
    });
    assert.deepEqual(r, ['00001', '00002', '00003']);
  } finally { await app.fermer(); }
});
