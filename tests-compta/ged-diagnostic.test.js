const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF').toString('base64');

test('GED : détail par source (dont foncier archivé et masqué) et version affichés', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (pdf) {
      DATA.dossiers_fonciers = [{ id: 'd1', reference: 'DF-2026-0001', statut: 'ouvert', etapes: [{ code: 'e1', libelle: 'Étape' }] }];
      const base = { dossier_id: 'd1', etape_code: 'e1', type: 'application/pdf', taille: 10, contenu: pdf, confidentialite: 'normale', depose_le: '2026-03-01T10:00:00Z', depose_par: { role: 'promoteur', id: 'u1', nom: 'R' } };
      DATA.pieces_foncieres = [
        Object.assign({}, base, { id: 'p1', nom: 'actif.pdf' }),
        Object.assign({}, base, { id: 'p2', nom: 'archive.pdf', retire: true, retire_motif: 'doublon' }),
        Object.assign({}, base, { id: 'p3', nom: 'ancienne.pdf', remplacee_par: 'p1' })
      ];
      await gedBuildDashboard();
      const el = document.getElementById('ged-diag');
      return { texte: el ? el.textContent : null, version: String(window.IMMOSUITE_VERSION).split(' — ')[0] };
    }, PDF);
    assert.ok(r.texte, 'ligne de diagnostic absente');
    assert.match(r.texte, /Documents 0/);
    assert.match(r.texte, /Foncier 2 \(dont 1 archivé\)/);
    assert.match(r.texte, /\(1 masquée\)/);
    assert.ok(r.texte.includes(r.version), 'version absente : ' + r.version);
    assert.match(r.version, /^v\d+\.\d+ · \d{4}-\d{2}-\d{2}$/);
    assert.equal(app.etat.erreursPage.length, 0, app.etat.erreursPage.join('\n'));
  } finally { await app.fermer(); }
});
