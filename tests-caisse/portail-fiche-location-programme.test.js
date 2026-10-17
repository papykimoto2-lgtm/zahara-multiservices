/* Fiches détaillées Location (budget à l'entrée) et Programme (galerie, lots, livraison). */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
test('fiches location et programme : ouverture, budget, galerie, fermeture', async () => {
  const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() => chromium.launch());
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    const gif = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    let html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
    html = html.replace(/"catalogue_location":"[^"]*",/, '').replace("PORTAIL_BRAND = JSON.parse('{", "PORTAIL_BRAND = JSON.parse('{\"catalogue_location\":\"Studio Test | 2 pièces | 40 m² | 150000 | 300000 | Cocody\",");
    const medias = [1, 2].map(k => ({ id: 'm' + k, data: { id: 'm' + k, type: 'photo', categorie: 'location', titre: 'Studio Test vue ' + k, data: gif + '#' + k, visible: true } }));
    const progs = [{ id: 'g1', nom: 'Résidence Test', statut: 'en_cours', commune: 'Bingerville', description: 'Un beau programme.', lots_disponibles: 3, lots_prevus: 10, date_livraison: '2027-06-30' }];
    await p.route('**/*', r => { const u = r.request().url();
      if (u === 'http://portail.test/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
      if (u.includes('pi_portail_medias')) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(medias) });
      if (u.includes('pi_programmes_public')) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(progs) });
      return r.abort(); });
    await p.goto('http://portail.test/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    await p.click('.p-liste .tab-link[data-tab="location"]'); await p.waitForTimeout(300);
    await p.click('#location-cards .vt-lien >> nth=0'); await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => !document.getElementById('bien-voile').hidden), true);
    assert.ok(/Studio Test/.test(await p.locator('.bien-corps h3').innerText()));
    assert.equal(await p.locator('.bien-vignettes .photo-item').count(), 2);
    const txt = async id => (await p.locator('#' + id).innerText()).replace(/\s| /g, '');
    assert.ok((await txt('loc-entree')).startsWith('450000'));   // caution 300 000 + 1 mois d'avance 150 000
    assert.ok((await txt('loc-an')).startsWith('1800000'));
    await p.locator('#loc-avance').evaluate(e => { e.value = 3; e.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.ok((await txt('loc-entree')).startsWith('750000'));
    await p.click('.bien-vignettes .photo-item >> nth=1');
    assert.ok((await p.locator('#bien-principale').getAttribute('src')).endsWith('#2'));
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => document.getElementById('bien-voile').hidden), true);
    await p.click('.bien-voile', { force: true, trial: true }).catch(() => {});

    await p.click('.p-liste .tab-link[data-tab="eden"]'); await p.waitForTimeout(600);
    await p.click('#programme-liste-cards .vt-lien >> nth=0'); await p.waitForTimeout(200);
    assert.ok(/Résidence Test/.test(await p.locator('.bien-corps h3').innerText()));
    const corps = await p.locator('.bien-corps').innerText();
    assert.ok(/Bingerville/.test(corps) && /Un beau programme/.test(corps) && /3 lots disponibles/.test(corps) && /Livraison prévue/.test(corps));
    await p.click('.bien-corps .vt-actions .highlight-btn >> nth=0'); await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => document.getElementById('bien-voile').hidden), true);
    assert.equal(await p.evaluate(() => document.getElementById('catalogue-pane').classList.contains('active-pane')), true);
    assert.deepStrictEqual(errs, []);
  } finally { await b.close(); }
});
