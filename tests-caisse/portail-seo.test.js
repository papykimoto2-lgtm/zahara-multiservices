/* Référencement du portail : adresses propres par onglet, titres, canonique, noindex des espaces, retour arrière. */
const test = require('node:test'), assert = require('node:assert');
const path = require('path'), fs = require('fs'), http = require('http');
const racine = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(racine, 'portail-unique.html'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(racine, 'vercel.json'), 'utf8'));
const ROUTES = { eden:'programmes', catalogue:'catalogue', 'catalogue-photo':'photos', location:'location', carte:'carte', investir:'investir', 'nous-connaitre':'societe', temoignages:'avis', faq:'faq', souscrire:'souscrire', 'nous-contacter':'contact' };
test('vercel.json réécrit /portail/<page> vers le portail pour chaque onglet public', () => {
  const rw = (vercel.rewrites || []).find(r => /^\/portail\/:slug\(/.test(r.source));
  assert.ok(rw && rw.destination === '/portail-unique.html');
  const slugs = rw.source.match(/\((.+)\)/)[1].split('|');
  Object.values(ROUTES).forEach(s => assert.ok(slugs.includes(s), s));
  Object.values(ROUTES).forEach(s => assert.ok(html.includes("'" + s + "'") || html.includes(':\'" + s + "\''), 'route ' + s));
});
test('robots.txt autorise /portail/', () => {
  assert.ok(/Allow: \/portail\/\n/.test(fs.readFileSync(path.join(racine, 'robots.txt'), 'utf8')));
});
test('liens directs, titres, canonique, noindex et retour arrière', async () => {
  const srv = http.createServer((q, r) => {
    if (/^\/(portail\/[a-z-]+|portail-unique\.html)/.test(q.url)) { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(html); } else { r.writeHead(404); r.end(); }
  });
  await new Promise(ok => srv.listen(0, ok));
  const base = 'http://localhost:' + srv.address().port;
  const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() => chromium.launch());
  try {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    const etat = () => p.evaluate(() => ({ url: location.pathname + location.hash, title: document.title, canon: (document.querySelector('link[rel=canonical]') || {}).href || null, robots: (document.querySelector('meta[name=robots]') || {}).content || null, actifs: [...document.querySelectorAll('.tab-pane.active-pane')].map(e => e.id) }));
    await p.goto(base + '/portail/catalogue', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
    let e = await etat();
    assert.deepStrictEqual(e.actifs, ['catalogue-pane']); assert.ok(/^Catalogue des biens \| /.test(e.title)); assert.strictEqual(e.canon, base + '/portail/catalogue'); assert.strictEqual(e.robots, null);
    await p.click('.p-liste .tab-link[data-tab="faq"]'); await p.waitForTimeout(200); e = await etat();
    assert.strictEqual(e.url, '/portail/faq'); assert.ok(/^Questions fréquentes/.test(e.title));
    await p.click('.nav-dropdown-trigger'); await p.click('#espace-menu .tab-link[data-tab="financier"]'); await p.waitForTimeout(200); e = await etat();
    assert.strictEqual(e.robots, 'noindex'); assert.strictEqual(e.canon, null);
    await p.goBack(); await p.waitForTimeout(300); e = await etat();
    assert.deepStrictEqual(e.actifs, ['faq-pane']); assert.strictEqual(e.robots, null);
    assert.ok(await p.evaluate(() => JSON.parse(document.getElementById('seo-jsonld').textContent)['@type'] === 'RealEstateAgent'));
    assert.deepStrictEqual(errs, []);
  } finally { await b.close(); srv.close(); }
});
