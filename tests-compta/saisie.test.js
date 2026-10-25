const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('saisie manuelle : la colonne « Tiers » apparaît sur un compte client et le tiers est enregistré', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.clients = [{ id: 'cliA', nom: 'KOUASSI', prenoms: 'Jean', dossier: 'DOS-A' }];
      openEcritureModal();
      document.getElementById('e-date').value = '2025-05-05';
      document.getElementById('e-libelle').value = 'Régularisation';
      _ecrLignes = [{ compte: '521', sens: 'D', montant: 100, libelle: '' }, { compte: '701', sens: 'C', montant: 100, libelle: '' }];
      ecrRenderLignes();
      const avant = document.querySelectorAll('#ecr-lignes-wrap input[list="dl-tiers-ecr"]').length;
      ecrUpdateLigne(1, 'compte', '4111');                         /* la ligne devient un compte client */
      const apres = document.querySelectorAll('#ecr-lignes-wrap input[list="dl-tiers-ecr"]').length;
      const champ = document.querySelector('#ecr-lignes-wrap input[list="dl-tiers-ecr"]');
      champ.value = 'KOUASSI Jean [DOS-A]'; champ.dispatchEvent(new Event('change'));
      await saveEcriture();
      const e = DATA.ecritures[0];
      return { avant: avant, apres: apres, tiers: e.lignes[1].tiers_id, confirmations: 0 };
    });
    assert.equal(r.avant, 0);
    assert.equal(r.apres, 1);
    assert.equal(r.tiers, 'cliA');
    assert.ok(!app.etat.dialogues.some(function (d) { return /sans tiers auxiliaire/.test(d); }));
  } finally { await app.fermer(); }
});

test('saisie manuelle : une ligne de compte client sans tiers demande confirmation (refus = rien d\'enregistré)', async () => {
  const app = await ouvrirApp();
  try {
    app.etat.confirm = false;
    const r = await app.page.evaluate(async function () {
      openEcritureModal();
      document.getElementById('e-date').value = '2025-05-05';
      document.getElementById('e-libelle').value = 'Sans tiers';
      _ecrLignes = [{ compte: '521', sens: 'D', montant: 100, libelle: '' }, { compte: '4111', sens: 'C', montant: 100, libelle: '' }];
      await saveEcriture();
      return DATA.ecritures.length;
    });
    assert.equal(r, 0);
    assert.ok(app.etat.dialogues.some(function (d) { return /sans tiers auxiliaire/.test(d); }));
  } finally { await app.fermer(); }
});

test('modification d\'une écriture : référence, tiers, source conservés — aucun numéro JL- consommé', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.clients = [{ id: 'cliA', nom: 'KOUASSI', prenoms: 'Jean' }];
      DATA.ecritures = [{ id: 'm1', ref: 'JL-2025-00007', date: '2025-05-05', libelle: 'Initial', piece: 'FAC-1', source: 'import_manuel', client_id: 'cliA',
        lignes: [{ compte: '521', sens: 'D', montant: 100 }, { compte: '4111', sens: 'C', montant: 100, tiers_id: 'cliA' }] }];
      openEcritureModal('m1');
      document.getElementById('e-libelle').value = 'Libellé corrigé';
      await saveEcriture();
      const e = DATA.ecritures[0];
      return { ref: e.ref, libelle: e.libelle, tiers: e.lignes[1].tiers_id, source: e.source, client: e.client_id, prochain: prochainNumeroRef('ecritures', 'JL', 2025, 5) };
    });
    assert.equal(r.ref, 'JL-2025-00007');
    assert.equal(r.libelle, 'Libellé corrigé');
    assert.equal(r.tiers, 'cliA');
    assert.equal(r.source, 'import_manuel');
    assert.equal(r.client, 'cliA');
    assert.equal(r.prochain, '00008');
  } finally { await app.fermer(); }
});

test('modification refusée sur une écriture lettrée', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.ecritures = [{ id: 'm1', ref: 'JL-2025-00001', date: '2025-05-05', libelle: 'Lettrée',
        lignes: [{ compte: '521', sens: 'D', montant: 100 }, { compte: '4111', sens: 'C', montant: 100, tiers_id: 'cliA', lettrage: 'L250001' }] }];
      openEcritureModal('m1');
      document.getElementById('e-libelle').value = 'Changé';
      await saveEcriture();
      return { libelle: DATA.ecritures[0].libelle, toasts: __toasts };
    });
    assert.equal(r.libelle, 'Lettrée');
    assert.ok(r.toasts.some(function (t) { return /lettrée/.test(t); }));
  } finally { await app.fermer(); }
});
