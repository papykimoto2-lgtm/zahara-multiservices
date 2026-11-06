/* Portail — page Carte : plan 3D public (sans connexion) et lecture complète des lots.
   Charge la VRAIE page du portail ; Leaflet est servi depuis tests-compta/fixtures (copie de la version 1.9.4 que le portail
   charge sur cdnjs), Supabase est simulé (vue publique pi_lots_public), les tuiles sont coupées.
   Vérifie : bouton Plan 3D, un plan par programme, fiche d'un lot sans nom ni paiement, aucun appel d'espace souscripteur,
   liste déroulante au-delà de 6 programmes, aucun programme tracé, lecture page par page de plus de 2 000 lots. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');

function chargerPlaywright() {
  try { return require('playwright'); } catch (e) { /* repli */ }
  return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
}
function trouverChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    const d = fs.readdirSync(base).filter((x) => x.indexOf('chromium-') === 0).sort().reverse();
    for (const x of d) { const c = path.join(base, x, 'chrome-linux', 'chrome'); if (fs.existsSync(c)) return c; }
  }
  return undefined;
}

/* 40 lots tracés (~15 × 20 m) près d'Abidjan : 1 sur 4 vendu, 1 sur 5 réservé ; le lot 3 n'a pas de point saisi ;
   plus 2 lots sans contour (épingle seule). */
function lotsSimules() {
  const lots = [], lat0 = 5.3153, lng0 = -4.0317, dLat = 20 / 110540, dLng = 15 / (111320 * Math.cos(lat0 * Math.PI / 180));
  for (let i = 0; i < 40; i++) {
    const r = Math.floor(i / 8), c = i % 8, la = lat0 + r * dLat * 1.1, lo = lng0 + c * dLng * 1.1;
    lots.push({ id: 'L' + i, numero: String(i + 1), ilot: 'B', statut: i % 4 === 0 ? 'vendu' : (i % 5 === 0 ? 'reserve' : 'disponible'),
      programme_id: i < 24 ? 'PG1' : 'PG2', prix: 6600000, superficie: 300, lat: i === 3 ? null : la + dLat / 2, lng: i === 3 ? null : lo + dLng / 2,
      geo_polygon: [[la, lo], [la, lo + dLng], [la + dLat, lo + dLng], [la + dLat, lo]] });
  }
  lots.push({ id: 'X1', numero: '900', statut: 'disponible', lat: 5.33, lng: -4.02, geo_polygon: null });
  lots.push({ id: 'X2', numero: '901', statut: 'disponible', lat: 5.331, lng: -4.021, geo_polygon: [[1, 2]] });
  return lots;
}

let nav;
/* Simulation du serveur : respecte limit / offset et plafonne chaque réponse à 1 000 lignes, comme Supabase. */
const PLAFOND_SERVEUR = 1000;
function pageServeur(url, lignes, journal) {
  const q = new URL(url).searchParams, off = +(q.get('offset') || 0), lim = Math.min(+(q.get('limit') || PLAFOND_SERVEUR), PLAFOND_SERVEUR);
  if (journal) journal.push({ offset: off, limit: lim, order: q.get('order') });
  return lignes.slice(off, off + lim);
}
async function ouvrirCarte(lots, journal) {
  lots = lots || lotsSimules();
  if (!nav) nav = await chargerPlaywright().chromium.launch({ executablePath: trouverChromium(), args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await nav.newPage({ viewport: { width: 1200, height: 1000 } });
  const erreurs = []; page.on('pageerror', (e) => erreurs.push(e.message));
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (/\/vendor\/three\.r128\.min\.js$/.test(u)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(RACINE, 'vendor/three.r128.min.js')) });
    if (/\/portail-plan3d\.js$/.test(u)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(RACINE, 'portail-plan3d.js')) });
    if (/\/rest\/v1\/pi_programmes_public/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'PG1', nom: 'Les Bougainvillées' }, { id: 'PG2', nom: 'Cité des Palmiers' }]) });
    if (u.startsWith('file:')) return route.continue();
    if (/leaflet\.min\.js/.test(u)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(FIX, 'leaflet-1.9.4.js')) });
    if (/leaflet\.min\.css/.test(u)) return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(FIX, 'leaflet-1.9.4.css')) });
    if (/\/rest\/v1\/pi_lots_public/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(pageServeur(u, lots, journal)) });
    if (/\/rest\/v1\//.test(u)) return route.fulfill({ contentType: 'application/json', body: '[]' });
    return route.abort();
  });
  await page.goto('file://' + path.join(RACINE, 'portail-unique.html'));
  await page.evaluate(() => basculerVersOnglet('carte'));
  await page.waitForFunction(() => window.L && typeof CARTE !== 'undefined' && CARTE.map, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  return { page, erreurs };
}
test.after(async () => { if (nav) await nav.close(); });

test('plus de 2 000 lots : la carte les charge tous, page par page, malgré le plafond de 1 000 lignes du serveur', async () => {
  const base = lotsSimules().slice(0, 40), lots = [];
  for (let i = 0; i < 2771; i++) { const l = Object.assign({}, base[i % 40]); l.id = 'Z' + String(i).padStart(5, '0'); l.numero = String(i + 1); lots.push(l); }
  const journal = [];
  const { page, erreurs } = await ouvrirCarte(lots, journal);
  const n = await page.evaluate(() => ({ lots: BIENS.lots.length, distincts: new Set(BIENS.lots.map((l) => l.id)).size }));
  assert.deepStrictEqual(n, { lots: 2771, distincts: 2771 });
  assert.deepStrictEqual(journal.map((j) => j.offset), [0, 1000, 2000, 2771], 'pages demandées');
  assert.ok(journal.every((j) => j.order === 'id'), 'ordre stable demandé');
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});

test('plan 3D public (sans connexion) : bouton sur la carte, un plan par programme, aucune donnée de souscripteur', async () => {
  const { page, erreurs } = await ouvrirCarte();
  await page.evaluate(() => carteVue('3d'));
  await page.waitForSelector('#carte-3d canvas', { timeout: 15000 });
  assert.strictEqual(await page.locator('#carte-bloc-carte').isHidden(), true, 'la carte est masquée');
  const txt = await page.locator('#carte-3d').innerText();
  assert.match(txt, /Plan 3D du programme/); assert.match(txt, /Informations publiques/);
  assert.match(txt, /Les Bougainvillées/); assert.match(txt, /Cité des Palmiers/);
  assert.doesNotMatch(txt, /Mon dossier|Mon lot|Reste à payer|Déjà versé/);
  /* 24 lots dans PG1, 16 dans PG2 : le plus grand programme est affiché en premier */
  const info = await page.evaluate(() => CARTE3D.ctrl.info());
  assert.strictEqual(info.public, true); assert.strictEqual(info.lots, 24); assert.strictEqual(info.mes, 0);
  /* retour à la carte */
  await page.evaluate(() => carteVue('carte'));
  assert.strictEqual(await page.locator('#carte-bloc-carte').isVisible(), true);
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});

test('plan 3D public : la fiche d\'un lot donne superficie, prix et statut (comme la carte), jamais de nom ni de paiement', async () => {
  const { page, erreurs } = await ouvrirCarte();
  await page.evaluate(() => carteVue('3d'));
  await page.waitForSelector('#carte-3d canvas', { timeout: 15000 });
  await page.evaluate(() => CARTE3D.ctrl.select('L1'));
  const fiche = await page.locator('#carte-3d .p3-card').innerText();
  assert.match(fiche, /Lot 2/); assert.match(fiche, /300 m²/); assert.match(fiche, /6\s?600\s?000 F/); assert.match(fiche, /22\s?000 F/);
  assert.doesNotMatch(fiche, /Reste à payer|Déjà versé|Mon dossier/);
  await page.evaluate(() => CARTE3D.ctrl.select('L0'));   /* i % 4 === 0 → vendu */
  const vendu = await page.locator('#carte-3d .p3-card').innerText();
  assert.match(vendu, /Vendu/); assert.match(vendu, /plus disponible/);
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});

test('plan 3D public : aucune lecture d\'espace souscripteur (pas de jeton, pas de fonction fc_vue_*)', async () => {
  const { page } = await ouvrirCarte();
  const appels = [];
  page.on('request', (r) => { if (/rpc\/fc_vue/.test(r.url())) appels.push(r.url()); });
  await page.evaluate(() => carteVue('3d'));
  await page.waitForSelector('#carte-3d canvas', { timeout: 15000 });
  assert.deepStrictEqual(appels, []);
  await page.close();
});

test('plan 3D public : plus de 6 programmes → liste déroulante ; changement de programme sans erreur', async () => {
  const lots = [];
  for (let g = 0; g < 8; g++) for (let i = 0; i < 6; i++) {
    const la = 5.31 + g * 0.002, lo = -4.03 + i * 0.0002;
    lots.push({ id: 'G' + g + 'L' + i, numero: String(i + 1), statut: 'disponible', prix: 5000000, superficie: 250, programme_id: 'PGX' + g, lat: la, lng: lo,
      geo_polygon: [[la, lo], [la, lo + 0.00013], [la + 0.00018, lo + 0.00013], [la + 0.00018, lo]] });
  }
  const { page, erreurs } = await ouvrirCarte(lots);
  await page.evaluate(() => carteVue('3d'));
  await page.waitForSelector('#carte-3d select.p3-select', { timeout: 15000 });
  assert.strictEqual(await page.locator('#carte-3d select.p3-select option').count(), 8);
  await page.locator('#carte-3d select.p3-select').selectOption('3');
  await page.waitForSelector('#carte-3d canvas');
  assert.strictEqual(await page.locator('#carte-3d select.p3-select').inputValue(), '3');
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});

test('plan 3D public : aucun programme tracé → message clair', async () => {
  const lots = lotsSimules().map((l) => Object.assign({}, l, { geo_polygon: null }));
  const { page, erreurs } = await ouvrirCarte(lots);
  await page.evaluate(() => carteVue('3d'));
  await page.waitForFunction(() => /Aucun programme/.test(document.getElementById('carte-3d').innerText), null, { timeout: 15000 });
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});
