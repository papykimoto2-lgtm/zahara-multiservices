const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Écritures de souscripteurs au format historique (2 comptes, sans tiers) : seul l'identifiant les relie au client. */
function legacy() {
  DATA.versements = [{ id: 'vB', client_id: 'cliB' }, { id: 'vA', client_id: 'cliA' }];
  DATA.clients = [{ id: 'cliA', nom: 'KOUASSI', prenoms: 'A', dossier: 'DOS-A', lot_id: 'lotA' }, { id: 'cliB', nom: 'TRAORE', prenoms: 'B', dossier: 'DOS-B', lot_id: 'lotB' }];
  DATA.ecritures = [
    { id: 'ecr_vente_logement_lotA', date: '2025-02-01', libelle: 'Vente lot A', compte_debit: '4111', compte_credit: '701', montant: 15000000 },
    { id: 'ecr_vrs_vB', date: '2025-03-01', libelle: 'Versement B', compte_debit: '521', compte_credit: '4111', montant: 15000000 },
    { id: 'ecr_vrs_vA', date: '2025-03-02', libelle: 'Versement A', compte_debit: '521', compte_credit: '4111', montant: 15000000 },
  ];
}

test('lettrage : un versement n\'est jamais lettré avec la vente d\'un autre souscripteur', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      await lettrageAuto(2025);
      const lettre = function (id) { return DATA.ecritures.find(function (e) { return e.id === id; }).lettrage || ''; };
      return { vente: lettre('ecr_vente_logement_lotA'), versB: lettre('ecr_vrs_vB'), versA: lettre('ecr_vrs_vA') };
    }, legacy.toString());
    assert.ok(r.vente && r.versA, 'la vente et le versement du MÊME souscripteur se lettrent');
    assert.equal(r.vente, r.versA);
    assert.equal(r.versB, '', 'le versement de B reste ouvert (B n\'a pas de vente)');
  } finally { await app.fermer(); }
});

test('écritures de versement, de vente et de résiliation : la ligne client porte son tiers', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.clients = [{ id: 'c1', nom: 'KOUASSI', prenoms: 'Jean', lot_id: 'lot1' }];
      DATA.lots = [{ id: 'lot1', numero: 'A1', nature: 'logement', prix: 1000, statut: 'vendu', date_vente: '2025-04-01', programme_id: 'p1' }];
      DATA.programmes = [{ id: 'p1', nom: 'Prog' }];
      const v = { id: 'v1', client_id: 'c1', date: '2025-05-05', montant: 100, mode: 'virement', type: 'apport' };
      await genererEcritureVersement(v);
      await comptabiliserVenteLogement(DATA.lots[0]);
      const tiers = function (id) { return ecrLignes(DATA.ecritures.find(function (e) { return e.id === id; })).filter(function (l) { return l.compte === '4111'; }).map(function (l) { return l.tiers_id; }); };
      return { versement: tiers('ecr_vrs_v1'), vente: tiers('ecr_vente_logement_lot1') };
    });
    assert.deepEqual(r.versement, ['c1']);
    assert.deepEqual(r.vente, ['c1']);
  } finally { await app.fermer(); }
});

test('lettrage : la lettre appartient à la ligne, pas à l\'écriture entière', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.ecritures = [
        { id: 'x1', date: '2025-02-01', libelle: 'Compensation', lignes: [{ compte: '4111', sens: 'D', montant: 100, tiers_id: 'A' }, { compte: '401', sens: 'C', montant: 100, tiers_id: 'F' }] },
        { id: 'x2', date: '2025-02-02', libelle: 'Règlement A', lignes: [{ compte: '521', sens: 'D', montant: 100 }, { compte: '4111', sens: 'C', montant: 100, tiers_id: 'A' }] }];
      await lettrageAuto(2025);                       /* x1/4111 ↔ x2/4111 ; x1/401 reste ouvert */
      const ouvertes = _lettItems(2025).filter(function (i) { return !i.lettre; }).map(function (i) { return i.e.id + '/' + i.compte; });
      DATA.ecritures.push({ id: 'x3', date: '2025-02-03', libelle: 'Règlement F', lignes: [{ compte: '401', sens: 'D', montant: 100, tiers_id: 'F' }, { compte: '521', sens: 'C', montant: 100 }] });
      await lettrageAuto(2025);                       /* au 2e passage, x1/401 doit se lettrer avec x3 */
      return { ouvertes: ouvertes, lettreX1_401: DATA.ecritures[0].lignes[1].lettrage || '', lettreX3: DATA.ecritures[2].lignes[0].lettrage || '' };
    });
    assert.deepEqual(r.ouvertes, ['x1/401']);
    assert.ok(r.lettreX1_401 && r.lettreX1_401 === r.lettreX3);
  } finally { await app.fermer(); }
});

test('FEC : PieceRef, journal, tiers auxiliaire et lettre par ligne', async () => {
  const app = await ouvrirApp();
  try {
    const fec = await app.page.evaluate(async function () {
      DATA.params.dgi = '123456';
      DATA.clients = [{ id: 'cliA', nom: 'KOUASSI', prenoms: 'A', dossier: 'DOS-A', lot_id: 'lotA' }];
      DATA.ecritures = [
        { id: 'uid_manuel', ref: 'JL-2025-00001', piece: 'FAC-77', date: '2025-02-01', libelle: 'Vente', journal: 'VE', valide_le: '2025-03-01T00:00:00Z',
          lignes: [{ compte: '4111', sens: 'D', montant: 100, tiers_id: 'cliA', lettrage: 'L250001' }, { compte: '701', sens: 'C', montant: 100 }], lettrage: 'L250001' },
        { id: 'ecr_vrs_zz', date: '2025-02-02', libelle: 'Versement', compte_debit: '521', compte_credit: '4111', montant: 100, client_id: 'cliA' }];
      let out = '';
      const BlobReel = window.Blob; window.Blob = function (parts, o) { out = parts.join(''); return new BlobReel(parts, o); };
      exporterFEC(2025, '');
      window.Blob = BlobReel;
      return out;
    });
    const l = fec.replace(/^﻿/, '').split('\r\n').slice(1).map(function (x) { return x.split('|'); });
    const IDX = { journal: 0, compte: 4, aux: 6, auxLib: 7, piece: 8, let: 13, valid: 15 };
    assert.equal(l[0][IDX.piece], 'FAC-77');                       /* la pièce saisie, plus l'identifiant interne */
    assert.equal(l[0][IDX.aux], 'DOS-A');                          /* compte auxiliaire = dossier du souscripteur */
    assert.match(l[0][IDX.auxLib], /KOUASSI/);
    assert.equal(l[0][IDX.let], 'L250001');                        /* la ligne lettrée porte la lettre… */
    assert.equal(l[1][IDX.let], '');                               /* …pas la ligne produit de la même écriture */
    assert.equal(l[0][IDX.valid], '20250301');
    assert.notEqual(l[2][IDX.journal], 'OD');                      /* journal déduit des comptes (banque) au lieu de « OD » partout */
    assert.equal(l[3][IDX.aux], 'DOS-A');                          /* ancienne écriture de versement : tiers retrouvé */
    assert.equal(l[2][IDX.aux], '');                               /* la ligne banque n'a pas de tiers */
  } finally { await app.fermer(); }
});
