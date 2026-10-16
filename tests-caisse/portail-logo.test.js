/* Logo de l'entreprise (Paramètres → Société) repris par le portail : réduction, export, affichage. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('ERP : le logo de la société est réduit et publié comme logo du portail', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const r = await page.evaluate(async () => {
    window.dbPut = async function () { return true; };
    var c = document.createElement('canvas'); c.width = 1200; c.height = 600; var g = c.getContext('2d'); g.fillStyle = '#d63a1b'; g.fillRect(0, 0, 600, 600);
    var grand = c.toDataURL('image/png');
    DATA.params = { logo: grand }; DATA.divisions = [];
    var out = { avant: buildPortailBrand().logo_url };
    await _logoPortailPrepare();
    var b = buildPortailBrand().logo_url;
    out.png = /^data:image\/png/.test(b); out.plusPetit = b.length < grand.length;
    var dim = await new Promise(function (ok) { var i = new Image(); i.onload = function () { ok([i.width, i.height]); }; i.src = b; });
    out.dim = dim;
    DATA.params.portail_logo_url = 'https://exemple.test/logo.png';
    out.prioriteUrl = buildPortailBrand().logo_url;
    DATA.params.portail_logo_url = ''; DATA.params.logo = 'https://exemple.test/autre.png'; DATA.params.logo_portail_cle = 'x';
    await _logoPortailPrepare(); out.http = buildPortailBrand().logo_url;
    return out;
  });
  assert.equal(r.avant, ''); assert.ok(r.png); assert.ok(r.plusPetit); assert.deepEqual(r.dim, [360, 180]);
  assert.equal(r.prioriteUrl, 'https://exemple.test/logo.png'); assert.equal(r.http, 'https://exemple.test/autre.png');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('portail : logo en en-tête, icône d\'onglet et pied de page', async () => {
  const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
  const fs = require('fs'), path = require('path');
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() => chromium.launch());
  try {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    const logo = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    let html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
    html = html.replace('"logo_url":""', '"logo_url":"' + logo + '"');
    await p.route('**/*', r => r.request().url() === 'http://portail.test/' ? r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }) : r.abort());
    await p.goto('http://portail.test/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
    assert.equal(await p.locator('.logo-area img.logo-img').count(), 1);
    assert.equal(await p.locator('.logo-area h1.sr-seul').count(), 1);
    assert.equal(await p.evaluate(() => document.querySelector('link[rel="icon"]').getAttribute('href')), logo);
    assert.equal(await p.locator('#footer-brand img.logo-pied').count(), 1);
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
});
