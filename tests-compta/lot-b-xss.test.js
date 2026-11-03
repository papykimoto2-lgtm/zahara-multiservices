/* Lot B : XSS stockée, aperçus, injection CSV (audit « dysfonctionnements ») */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF').toString('base64');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const HTML = 'data:text/html;base64,' + Buffer.from('<script>window.parent.__xss=1</script>').toString('base64');
const SVG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>window.parent.__xss=1</script></svg>').toString('base64');
const XSS = '<img src=x onerror="window.__xss=1">';

test('B1 : GED et signatures — description, module, division, filtres et signataire sont échappés', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async ({ xss, pdf }) => {
      window.__xss = 0; window.toast = () => {};
      DATA.dossiers_fonciers = [{ id: 'd1', reference: xss, statut: 'ouvert', etapes: [{ code: 'e1', libelle: xss }] }];
      DATA.pieces_foncieres = [{ id: 'p1', nom: 'a.pdf', type: 'application/pdf', taille: 10, contenu: pdf, dossier_id: 'd1', etape_code: 'e1', depose_le: '2026-03-01T10:00:00Z', depose_par: { role: 'promoteur', id: 'u1', nom: 'R' }, retire: true, retire_motif: xss }];
      await gedBuildDashboard(); await gedFiltrer();
      const liste = document.getElementById('archive-documents-list');
      const barres = gedBarList({ [xss]: 2, "a'b\"c": 1 }, 'module');
      const conteneur = document.createElement('div'); conteneur.innerHTML = barres; document.body.appendChild(conteneur);
      await new Promise(r => setTimeout(r, 200));
      return { xss: window.__xss, imgActive: !!document.querySelector('#archive-documents-list img[onerror], .ged-bar-row img'), texteLiteral: liste.textContent.includes('<img src=x'), onclick: (conteneur.querySelector('.ged-bar-row') || {}).getAttribute ? conteneur.querySelector('.ged-bar-row').getAttribute('onclick') : '' };
    }, { xss: XSS, pdf: PDF });
    assert.equal(r.xss, 0); assert.equal(r.imgActive, false); assert.equal(r.texteLiteral, true);
    assert.ok(/decodeURIComponent\('/.test(r.onclick) && !/<img/.test(r.onclick));
  } finally { await app.fermer(); }
});

test('B2 : Validations — libellé, demandeur, valideur, motif échappés ; anciens libellés déjà échappés sans double échappement', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async (xss) => {
      window.__xss = 0; DATA.validations = [
        { id: 'v1', type: 'bon_commande', ref_id: 'x', libelle: xss, montant: 0, statut: 'valide', demandeur: xss, valideur: xss, motif: xss, date_demande: '2026-03-01', date_decision: '2026-03-02' },
        { id: 'v2', type: 'bon_commande', ref_id: 'y', libelle: 'Menko &amp; Co &lt;SA&gt;', montant: 0, statut: 'valide', demandeur: 'A', valideur: 'B', motif: '', date_demande: '2026-03-01', date_decision: '2026-03-02' }];
      window.valFilter = 'historique'; try { valFilter = 'historique'; } catch (e) {}
      renderValidations(); await new Promise(r => setTimeout(r, 200));
      const tb = document.getElementById('tbody-validations');
      return { xss: window.__xss, img: !!tb.querySelector('img'), texte: tb.textContent.includes('<img src=x'), ancien: tb.textContent.includes('Menko & Co <SA>'), doubleEchappement: tb.textContent.includes('&amp;') };
    }, XSS);
    assert.equal(r.xss, 0); assert.equal(r.img, false); assert.equal(r.texte, true);
    assert.equal(r.ancien, true); assert.equal(r.doubleEchappement, false);
  } finally { await app.fermer(); }
});

test('B3 : aperçu — PDF et images oui ; HTML, SVG et type inconnu jamais dans un iframe ; apercuDocument passe par le calque sûr', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async ({ pdf, png, html, svg }) => {
      window.__xss = 0; const toasts = []; window.toast = m => toasts.push(m);
      const poser = async (id, type, blob, name) => { _pulling = true; try { await dbPut('documents', { id, name: name || id, type, size: 10, blob, upload_date: '2026-03-01', entity_type: 'client', entity_id: 'c1' }); } finally { _pulling = false; } };
      await poser('d_pdf', 'application/pdf', pdf); await poser('d_png', 'image/png', png); await poser('d_html', 'application/pdf', html);   /* type DÉCLARÉ pdf, contenu html */
      await poser('d_svg', 'image/png', svg); await poser('d_html2', 'text/html', html, 'x.html');
      const o = {};
      for (const id of ['d_pdf', 'd_png', 'd_html', 'd_svg', 'd_html2']) {
        const avant = document.getElementById('ged-apercu'); if (avant) avant.remove();
        await gedApercu('documents', id); const ov = document.getElementById('ged-apercu');
        o[id] = ov ? (ov.querySelector('iframe') ? 'iframe' : (ov.querySelector('img') ? 'img' : 'autre')) : 'refuse';
      }
      const avant = document.getElementById('ged-apercu'); if (avant) avant.remove();
      await apercuDocument('d_pdf'); o.ancienneFonction = document.getElementById('ged-apercu') ? 'calque' : 'rien';
      await new Promise(r => setTimeout(r, 300)); o.xss = window.__xss; o.messages = toasts.filter(m => /indisponible/.test(m)).length;
      return o;
    }, { pdf: PDF, png: PNG, html: HTML, svg: SVG });
    assert.equal(r.d_pdf, 'iframe'); assert.equal(r.d_png, 'img');
    assert.equal(r.d_html, 'refuse'); assert.equal(r.d_svg, 'refuse'); assert.equal(r.d_html2, 'refuse');
    assert.equal(r.ancienneFonction, 'calque'); assert.equal(r.xss, 0); assert.ok(r.messages >= 3);
  } finally { await app.fermer(); }
});

test('B4 : téléversement — HTML, SVG et scripts refusés ; PDF et images acceptés', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async ({ pdf, png }) => {
      window.toast = () => {}; const o = {};
      const essai = async (name, type, blob) => (await dbPut('documents', { id: 'u_' + name, name, type, size: 5, blob, upload_date: '2026-03-01' })) !== false;
      o.pdf = await essai('a.pdf', 'application/pdf', pdf); o.png = await essai('a.png', 'image/png', png);
      o.html = await essai('a.html', 'text/html', 'data:text/html;base64,AA=='); o.svg = await essai('a.svg', 'image/svg+xml', 'data:image/svg+xml;base64,AA==');
      o.extension = await essai('piege.html', 'application/pdf', pdf); o.js = await essai('a.js', 'text/javascript', 'data:text/javascript;base64,AA==');
      return o;
    }, { pdf: PDF, png: PNG });
    assert.deepEqual(r, { pdf: true, png: true, html: false, svg: false, extension: false, js: false });
  } finally { await app.fermer(); }
});

test('B5 : export CSV — injection de formule neutralisée, nombres et textes normaux intacts', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(() => ({
      formule: fcCsvEchapper('=HYPERLINK("http://evil","x").pdf'), plus: fcCsvEchapper('+cmd|calc'), arobase: fcCsvEchapper('@SUM(A1)'), moins: fcCsvEchapper('-2+3'),
      nombre: fcCsvEchapper('-5000'), decimal: fcCsvEchapper('12,5'), normal: fcCsvEchapper('Titre foncier'), pointVirgule: fcCsvEchapper('a;b')
    }));
    assert.equal(r.formule.startsWith('"\'=HYPERLINK'), true); assert.equal(r.plus, "'+cmd|calc"); assert.equal(r.arobase, "'@SUM(A1)"); assert.equal(r.moins, "'-2+3");
    assert.equal(r.nombre, '-5000'); assert.equal(r.decimal, '12,5'); assert.equal(r.normal, 'Titre foncier'); assert.equal(r.pointVirgule, '"a;b"');
  } finally { await app.fermer(); }
});
