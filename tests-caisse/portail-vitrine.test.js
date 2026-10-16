/* Thème vitrine du portail : parcours d'accueil, accès aux 12 espaces, boutons d'action de la bannière. */
const test = require('node:test'), assert = require('node:assert');
const path = require('path'), fs = require('fs');
const html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
const ESPACES = ['souscripteur','intervenant','apporteurs','diaspo','foncier','mandant','propfoncier','partlot','financier','amenageur','locataire','copropriete'];
test('chaque espace a un accès rapide sur l\'accueil et un volet correspondant', () => {
  ESPACES.forEach(e => {
    assert.ok(html.includes('class="tab-link esp-chip" data-tab="' + e + '"'), 'accès rapide ' + e);
    assert.ok(html.includes('id="' + e + '-pane"'), 'volet ' + e);
  });
});
test('boutons de la bannière pointent vers des volets existants', () => {
  ['eden','souscrire','nous-contacter'].forEach(t => {
    assert.ok(html.includes('hero-btn') && html.includes('data-tab="' + t + '"'));
    assert.ok(html.includes('id="' + t + '-pane"'), 'volet ' + t);
  });
});
test('aucune police distante ajoutée', () => {
  assert.ok(!/fonts\.googleapis\.com/.test(html));
});
test('clic sur un accès rapide ouvre le volet', async () => {
  const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() => chromium.launch());
  try {
    const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto('file://' + path.join(__dirname, '..', 'portail-unique.html')); await p.waitForTimeout(800);
    for (const e of ESPACES) {
      await p.evaluate(() => allerAccueilPortail());
      await p.click('.esp-chip[data-tab="' + e + '"]');
      assert.ok(await p.evaluate(id => document.getElementById(id + '-pane').classList.contains('active-pane'), e), 'ouvre ' + e);
    }
    await p.evaluate(() => allerAccueilPortail());
    await p.click('.hero-btn[data-tab="eden"]');
    assert.ok(await p.evaluate(() => document.getElementById('eden-pane').classList.contains('active-pane')));
    assert.deepStrictEqual(errs, []);
  } finally { await b.close(); }
});

test('photos : sections et mosaïque d\'accueil', () => {
  ['photo-sections-nav','accueil-galerie-wrap','accueil-galerie','photo-catalogue-grid'].forEach(id => assert.ok(html.includes('id="' + id + '"'), id));
  ['photosParSection','renderAccueilGalerie','vignettePhoto'].forEach(f => assert.ok(html.includes('function ' + f + '('), f));
});

test('catalogue : types, filtres, tri et souscription directe', () => {
  ['catalogue-nav','catalogue-tri','catalogue-outils','villa-cards'].forEach(id => assert.ok(html.includes('id="' + id + '"'), id));
  ['typeBien','prixBien','photoBien','carteBien','souscrireVilla'].forEach(f => assert.ok(html.includes('function ' + f + '('), f));
  assert.ok(html.includes('window.souscrireVilla'));
});

test('parcours : ordre des onglets en marche en avant', () => {
  const nav = html.slice(html.indexOf('<nav class="parcours"'), html.indexOf('</nav>', html.indexOf('<nav class="parcours"')));
  const ordre = [...nav.matchAll(/data-tab="([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(ordre, ['activites','eden','catalogue','catalogue-photo','location','carte','investir','nous-connaitre','temoignages','faq','souscrire','nous-contacter']);
  assert.ok(html.indexOf('class="header-actions"') < html.indexOf('<nav class="parcours"'));
  assert.ok(html.includes('data-tab="souscripteur"') && html.includes('id="espace-menu"'));
  assert.ok(html.includes('id="nav-divisions"'));
});

test('bannières : accueil seulement, une bannière par division', () => {
  assert.ok(html.includes('body:not(:has(#activites-pane.active-pane)) :is(.hero,.promesses)'));
  assert.ok(html.includes("class=\"div-hero\""));
  assert.ok(html.includes('data-tab="nous-contacter">Nous contacter'));
  assert.ok(!html.includes("html+='<div class=\"div-intro\">'"));
});
