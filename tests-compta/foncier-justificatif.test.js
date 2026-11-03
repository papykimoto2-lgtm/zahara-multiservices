const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('foncier : fichier sans type MIME accepté ; grosse photo réduite sous 5 Mo ; HEIC refusé clairement', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const pdf = new File([new TextEncoder().encode('%PDF-1.4 test')], 'recu.pdf', { type: '' });
      const f1 = await fcLireFichier(pdf);
      /* photo bruitée volumineuse (PNG > 5 Mo) */
      const c = document.createElement('canvas'); c.width = 2600; c.height = 2600;
      const cx = c.getContext('2d'), img = cx.createImageData(c.width, c.height);
      for (let i = 0; i < img.data.length; i++) img.data[i] = (i % 4 === 3) ? 255 : Math.floor(Math.random() * 256);
      cx.putImageData(img, 0, 0);
      const big = await new Promise(function (res) { c.toBlob(res, 'image/png'); });
      const f2 = await fcLireFichier(new File([big], 'photo.png', { type: 'image/png' }));
      const f3 = await fcLireFichier(new File([new Uint8Array([0, 0, 0, 24])], 'x.heic', { type: '' }));
      return { t1: f1.type, e1: fcValiderFichier(f1), bigAvant: big.size, t2: f2.type, taille2: f2.taille, e2: fcValiderFichier(f2), e3: fcValiderFichier(f3) };
    });
    assert.equal(r.t1, 'application/pdf');
    assert.equal(r.e1, '');
    assert.ok(r.bigAvant > 5 * 1024 * 1024, 'photo de test trop petite : ' + r.bigAvant);
    assert.equal(r.t2, 'image/jpeg');
    assert.ok(r.taille2 <= 5 * 1024 * 1024);
    assert.equal(r.e2, '');
    assert.match(r.e3, /HEIC/);
  } finally { await app.fermer(); }
});

test('foncier : un fichier joint à une étape qui exige un justificatif devient le justificatif (étape terminable)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const d = { id: 'd1', statut: 'ouvert', responsable_id: '', type_procedure: 'acd', _v: 0,
        etapes: [{ code: 'e1', libelle: 'Étape test', statut: 'en_cours', justificatif_requis: true, justificatifs: [], visibilite: 'interne', phase: 'A' }] };
      DATA.dossiers_fonciers = [d]; DATA.pieces_foncieres = [];
      const f = await fcLireFichier(new File([new TextEncoder().encode('%PDF-1.4 x')], 'justif.pdf', { type: 'application/pdf' }));
      const res = await fcAjouterPiece('d1', 'e1', f, { visibilite: 'interne', source: '' });
      return { ok: res.ok, err: res.erreur || '', nbJustif: d.etapes[0].justificatifs.length, source: (d.etapes[0].justificatifs[0] || {}).source };
    });
    assert.equal(r.ok, true, r.err);
    assert.equal(r.nbJustif, 1);
    assert.equal(r.source, 'promoteur');
  } finally { await app.fermer(); }
});
