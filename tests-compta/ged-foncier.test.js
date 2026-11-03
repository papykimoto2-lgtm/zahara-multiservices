const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');

test('GED : les pièces des dossiers fonciers (archivées incluses) apparaissent et s\'affichent dans la page, sans fenêtre contextuelle', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (pdf) {
      window.__open = 0; window.open = function () { window.__open++; return null; };
      DATA.dossiers_fonciers = [{ id: 'd1', reference: 'DF-2026-0001', statut: 'ouvert', responsable_id: '', _v: 0,
        etapes: [{ code: 'e1', libelle: 'Étape test', statut: 'en_cours', justificatifs: [], visibilite: 'interne', phase: 'A' }] }];
      const base = { dossier_id: 'd1', etape_code: 'e1', type: 'application/pdf', taille: 60, contenu: pdf, confidentialite: 'normale', depose_le: '2026-03-01T10:00:00Z', depose_par: { role: 'promoteur', id: 'u1', nom: 'Resp' }, version: 1, retire: false };
      DATA.pieces_foncieres = [
        Object.assign({}, base, { id: 'p1', nom: 'recu-actif.pdf' }),
        Object.assign({}, base, { id: 'p2', nom: 'ancien-archive.pdf', retire: true, retire_motif: 'doublon' }),
        Object.assign({}, base, { id: 'p3', nom: 'ancienne-version.pdf', remplacee_par: 'p1' })
      ];
      const tous = await gedCollecter();
      const foncier = tous.filter(function (d) { return d.store === 'pieces_foncieres'; });
      await gedApercu('pieces_foncieres', 'p2');                       /* pièce ARCHIVÉE */
      const ov = document.getElementById('ged-apercu');
      return { noms: foncier.map(function (d) { return d.name + ':' + d.archive + ':' + d.module; }).sort(), overlay: !!ov, iframe: !!(ov && ov.querySelector('iframe')), ouvertures: window.__open };
    }, PDF);
    assert.deepEqual(r.noms, ['ancien-archive.pdf:true:Foncier — Dossiers', 'recu-actif.pdf:false:Foncier — Dossiers']);
    assert.equal(r.overlay, true);
    assert.equal(r.iframe, true);
    assert.equal(r.ouvertures, 0);
  } finally { await app.fermer(); }
});

test('GED : une pièce foncière ne se supprime pas depuis la GED', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (pdf) {
      DATA.pieces_foncieres = [{ id: 'p1', nom: 'x.pdf', type: 'application/pdf', contenu: pdf, dossier_id: 'd1' }];
      window.confirm = function () { return true; };
      await gedSupprimer('pieces_foncieres', 'p1');
      return DATA.pieces_foncieres.length;
    }, PDF);
    assert.equal(r, 1);
  } finally { await app.fermer(); }
});
