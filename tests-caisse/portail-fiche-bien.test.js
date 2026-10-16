/* Fiche détaillée d'un bien : galerie, simulateur de paiement, souscription directe. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
test('fiche bien : ouverture, simulateur, galerie, fermeture, souscription', async () => {
  const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() => chromium.launch());
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    const gif = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    const cat = [{ nom: 'Villa Test F4', pieces: '4 pièces', surf: '120 m²', go: 10000000, cle: 20000000 }, { nom: 'Terrain Test', surf: '300 m²', prix: 5000000, prix_label: 'Prix' }];
    let html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
    html = html.replace(/"catalogue":\[\],/, '').replace(/"(duree|jouissance|frais_souscription)":[^,]*,/g, '').replace("PORTAIL_BRAND = JSON.parse('{", "PORTAIL_BRAND = JSON.parse('{\"catalogue\":" + JSON.stringify(cat) + ",\"duree\":\"24\",\"jouissance\":\"30\",\"frais_souscription\":\"50000\",");
    const medias = [1, 2].map(k => ({ id: 'm' + k, data: { id: 'm' + k, type: 'photo', categorie: 'catalogue', titre: 'Villa Test F4 vue ' + k, data: gif + '#' + k, visible: true } }));
    await p.route('**/*', r => { const u = r.request().url();
      if (u === 'http://portail.test/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
      if (u.includes('pi_portail_medias')) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(medias) });
      return r.abort(); });
    await p.goto('http://portail.test/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    await p.click('.p-liste .tab-link[data-tab="catalogue"]'); await p.waitForTimeout(300);
    await p.click('#villa-cards .vt-lien >> nth=0'); await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => !document.getElementById('bien-voile').hidden), true);
    assert.ok(/Villa Test F4/.test(await p.locator('.bien-corps h3').innerText()));
    assert.equal(await p.locator('.bien-vignettes .photo-item').count(), 2);
    // défaut : formule clé en main (20 M), apport 30 %, 24 mois → reste 14 M, mensualité 583 333
    const txt = async id => (await p.locator('#' + id).innerText()).replace(/\s| /g, '');
    assert.ok((await txt('sim-prix')).startsWith('20000000'));
    assert.ok((await txt('sim-reste')).startsWith('14000000'));
    assert.ok((await txt('sim-mens')).startsWith('583333'));
    assert.ok((await txt('sim-frais')).startsWith('50000'));
    await p.selectOption('#sim-mode', { index: 0 });
    assert.ok((await txt('sim-prix')).startsWith('10000000'));
    await p.locator('#sim-apport').evaluate(e => { e.value = 100; e.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.ok((await txt('sim-mens')).startsWith('0'));
    await p.click('.bien-vignettes .photo-item >> nth=1');
    assert.ok((await p.locator('#bien-principale').getAttribute('src')).endsWith('#2'));
    assert.equal(await p.evaluate(() => document.getElementById('pp-lb-overlay').classList.contains('active')), false);
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => document.getElementById('bien-voile').hidden), true);
    await p.click('#villa-cards .vt-lien >> nth=1'); await p.waitForTimeout(200);
    assert.equal(await p.locator('.sim select').count(), 0);          // un seul prix : pas de choix de formule
    await p.click('.bien-corps .highlight-btn'); await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => document.getElementById('souscrire-pane').classList.contains('active-pane')), true);
    assert.equal(await p.evaluate(() => document.getElementById('s_villa').value), 'Terrain Test');
    assert.deepStrictEqual(errs, []);
  } finally { await b.close(); }
});
