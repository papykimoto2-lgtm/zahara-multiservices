/* Site / Portail : contenu et photo de bannière par division (saisie ERP → export du portail → affichage). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('éditeur de division : saisie, lecture, export vers le portail', async () => {
  const app = await ouvrirApp(); const page = app.page;
  const r = await page.evaluate(() => {
    DATA.divisions = [{ id: 'd1', nom: 'Agro', secteur: 'agriculture', description: 'Fiche agro' }, { id: 'd2', nom: 'BTP', description: 'Fiche btp' }];
    DATA.params = DATA.params || {};
    var zone = document.getElementById('param-portail-divisions-list');
    var out = { zone: !!zone };
    if (!zone) return out;
    renderDivisionsPubliees(['d1'], { d1: { slogan: 'Du champ à l\'assiette', apropos: 'Para 1\n\nPara 2', points: 'Bio\nLocal\n\nSuivi', banniere: 'https://x.test/b.jpg' } });
    out.editeurs = zone.querySelectorAll('details').length;
    out.valeurSlogan = zone.querySelector('[data-div="d1"][data-champ="slogan"]').value;
    out.coche = Array.prototype.map.call(zone.querySelectorAll('.param-div-pub:checked'), function (e) { return e.value; });
    zone.querySelector('[data-div="d2"][data-champ="description"]').value = 'Présentation BTP';
    out.lu = _lireContenuDivisions();
    DATA.params.portail_divisions = ['d1', 'd2'];
    DATA.params.portail_divisions_contenu = out.lu;
    out.brand = buildPortailBrand().divisions_portail.map(function (d) { return { id: d.id, slogan: d.slogan, desc: d.description, points: d.points, ban: d.banniere, apropos: d.apropos }; });
    return out;
  });
  assert.ok(r.zone); assert.equal(r.editeurs, 2); assert.equal(r.valeurSlogan, "Du champ à l'assiette"); assert.deepEqual(r.coche, ['d1']);
  assert.equal(r.lu.d1.banniere, 'https://x.test/b.jpg'); assert.equal(r.lu.d2.description, 'Présentation BTP');
  const d1 = r.brand.find(d => d.id === 'd1'), d2 = r.brand.find(d => d.id === 'd2');
  assert.deepEqual(d1.points, ['Bio', 'Local', 'Suivi']); assert.equal(d1.desc, 'Fiche agro'); assert.equal(d1.ban, 'https://x.test/b.jpg');
  assert.equal(d2.desc, 'Présentation BTP'); assert.equal(d2.slogan, '');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('portail : bannière, à propos et points forts d\'une division', async () => {
  const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
  const path = require('path');
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }).catch(() => chromium.launch());
  try {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    const fs = require('fs'); let html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
    const divs = [{ id: 'd1', nom: 'Agro', slogan: 'Du champ', description: 'Courte', apropos: 'Para 1\n\nPara 2', points: ['Bio', 'Local'], banniere: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', ordre: 0 }];
    html = html.replace("PORTAIL_BRAND = JSON.parse('{", "PORTAIL_BRAND = JSON.parse('{\"divisions_portail\":" + JSON.stringify(divs).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + ",");
    await p.route('**/*', r => r.request().url().startsWith('file:') || r.request().url() === 'http://portail.test/' ? r.continue() : r.abort());
    await p.route('http://portail.test/', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await p.goto('http://portail.test/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
    await p.click('.p-activites .nav-dropdown-trigger'); await p.click('#activites-menu .tab-link[data-tab="div-d1"]'); await p.waitForTimeout(300);
    assert.equal(await p.locator('#div-d1-pane .div-hero-img').count(), 1);
    assert.equal(await p.locator('#div-d1-pane .div-apropos-txt p').count(), 2);
    assert.equal(await p.locator('#div-d1-pane .div-points li').count(), 2);
    assert.ok(/du champ/i.test(await p.locator('#div-d1-pane .div-hero-sur').innerText()));
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
});
