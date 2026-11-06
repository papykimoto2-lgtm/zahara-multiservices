/* Portail souscripteur — plan 3D du lotissement (portail-plan3d.js + fonction serveur fc_vue_plan_lotissement).
   Vérifie : le plan se monte (tracés réels et repli en grille), la fiche d'un lot voisin ne montre aucune donnée
   financière ni nominative, le bouton est branché dans le portail, et la fonction serveur ne renvoie que les champs prévus. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

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

/* Plan synthétique : grille de n lots de ~15 × 20 m autour d'Abidjan, avec contours [lat, lng]. */
function planAvecTraces(n, mien) {
  const lots = [], cols = Math.ceil(Math.sqrt(n));
  const lat0 = 5.3153, lng0 = -4.4317, dLat = 20 / 110540, dLng = 15 / (111320 * Math.cos(lat0 * Math.PI / 180));
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const la = lat0 + r * dLat * 1.1, lo = lng0 + c * dLng * 1.1;
    lots.push({ id: 'L' + i, numero: 'L' + (i + 1), ilot: 'A', surface: 300, statut: i === mien ? 'mon_lot' : (i % 3 === 0 ? 'attribue' : 'libre'),
      poly: [[la, lo], [la, lo + dLng], [la + dLat, lo + dLng], [la + dLat, lo]] });
  }
  return { parcelle_id: 'P1', parcelle: 'TF 12', programme: 'Les Bougainvillées', total: n, tronque: false, lots };
}
const PAIEMENT = { total: 6600000, verse: 4200000, reste: 2400000, pct: 63.6 };

let pw, nav;
async function ouvrirPage() {
  if (!nav) { pw = chargerPlaywright(); nav = await pw.chromium.launch({ executablePath: trouverChromium(), args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gl-blocklist', '--ignore-gpu-blocklist', '--no-sandbox'] }); }
  const page = await nav.newPage({ viewport: { width: 1100, height: 900 } });
  const erreurs = []; page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>:root{--pp-primary:#A6431C}</style></head><body><div id="s-plan"></div></body></html>');
  await page.addScriptTag({ path: path.join(RACINE, 'vendor/three.r128.min.js') });
  await page.addScriptTag({ path: path.join(RACINE, 'portail-plan3d.js') });
  return { page, erreurs };
}
test.after(async () => { if (nav) await nav.close(); });

test('plan à tracés réels : se monte, compte les lots et ne produit aucune erreur', async () => {
  const { page, erreurs } = await ouvrirPage();
  const info = await page.evaluate((a) => { window.__c = window.PortailPlan3D.monter(document.getElementById('s-plan'), { plans: [a.plan], paiement: a.pay }); return window.__c.info(); }, { plan: planAvecTraces(300, 7), pay: PAIEMENT });
  assert.strictEqual(info.webgl, true);
  assert.strictEqual(info.lots, 300);
  assert.strictEqual(info.mes, 1);
  assert.strictEqual(info.grille, false);
  assert.strictEqual(await page.locator('#s-plan canvas').count(), 1);
  assert.match(await page.locator('.p3-kpis').innerText(), /L8/);
  await page.waitForTimeout(500);
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});

test('confidentialité : la fiche de mon lot détaille mon dossier, celle d\'un lot voisin n\'affiche aucun montant', async () => {
  const { page, erreurs } = await ouvrirPage();
  await page.evaluate((a) => { window.__c = window.PortailPlan3D.monter(document.getElementById('s-plan'), { plans: [a.plan], paiement: a.pay }); }, { plan: planAvecTraces(60, 5), pay: PAIEMENT });
  await page.evaluate(() => window.__c.select('L5'));
  const miens = await page.locator('.p3-card').innerText();
  assert.match(miens, /Lot L6/); assert.match(miens, /Votre lot/); assert.match(miens, /Reste à payer/); assert.match(miens, /2\s?400\s?000/);
  await page.evaluate(() => window.__c.select('L3'));   /* i % 3 === 0 : attribué */
  const autre = await page.locator('.p3-card').innerText();
  assert.match(autre, /Attribué/);
  assert.doesNotMatch(autre, /Reste à payer|Déjà versé|Montant total|Mon dossier|\sF\b/);
  assert.doesNotMatch(autre, /4\s?200\s?000|2\s?400\s?000|6\s?600\s?000/);
  await page.evaluate(() => window.__c.select('L4'));   /* libre */
  const libre = await page.locator('.p3-card').innerText();
  assert.match(libre, /Disponible/); assert.doesNotMatch(libre, /Reste à payer|Déjà versé/);
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});

test('parcelle sans tracé : repli en grille signalé, tous les lots restent sélectionnables', async () => {
  const { page, erreurs } = await ouvrirPage();
  const plan = planAvecTraces(24, 2); plan.lots.forEach((l) => { l.poly = null; });
  const info = await page.evaluate((a) => { window.__c = window.PortailPlan3D.monter(document.getElementById('s-plan'), { plans: [a.plan], paiement: a.pay }); return window.__c.info(); }, { plan, pay: PAIEMENT });
  assert.strictEqual(info.grille, true); assert.strictEqual(info.lots, 24);
  assert.match(await page.locator('#s-plan').innerText(), /disposés en grille à titre indicatif/);
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});

test('aucun plan disponible : message clair, pas d\'erreur', async () => {
  const { page, erreurs } = await ouvrirPage();
  await page.evaluate(() => { window.PortailPlan3D.monter(document.getElementById('s-plan'), { plans: [], paiement: {} }); });
  assert.match(await page.locator('#s-plan').innerText(), /pas encore disponible/);
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});

test('plan de 700 lots (maximum renvoyé par le serveur) : monté en moins de 5 secondes', async () => {
  const { page, erreurs } = await ouvrirPage();
  const ms = await page.evaluate((a) => { const t = performance.now(); window.__c = window.PortailPlan3D.monter(document.getElementById('s-plan'), { plans: [a.plan], paiement: a.pay }); return performance.now() - t; }, { plan: planAvecTraces(700, 350), pay: PAIEMENT });
  assert.ok(ms < 5000, 'montage en ' + Math.round(ms) + ' ms');
  assert.deepStrictEqual(erreurs, []);
  await page.close();
});

test('le portail branche l\'onglet « Plan 3D » et charge la 3D à la demande, depuis ses propres fichiers', () => {
  const p = lire('portail-unique.html');
  assert.ok(p.indexOf("sSub(this,\\'plan\\');planOuvrir()") !== -1, 'bouton Plan 3D absent');
  assert.ok(p.indexOf('id="s-plan"') !== -1, 'conteneur s-plan absent');
  assert.ok(p.indexOf("rpc/fc_vue_plan_lotissement") !== -1);
  assert.ok(p.indexOf("'/vendor/three.r128.min.js'") !== -1 && p.indexOf("'/portail-plan3d.js'") !== -1);
  assert.ok(!/<script[^>]+src="https?:\/\/[^"]*three/i.test(p), 'la 3D ne doit pas venir d\'un service tiers');
  assert.ok(fs.existsSync(path.join(RACINE, 'vendor/three.r128.min.js')) && fs.existsSync(path.join(RACINE, 'portail-plan3d.js')));
});

test('le module n\'accède à aucune donnée nominative ou financière d\'un autre lot', () => {
  const js = lire('portail-plan3d.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/\.(client_id|telephone|email|nom|montant)\b/.test(js), 'champ sensible lu dans le module');
  /* Le prix n'est lu que pour le plan public (mêmes informations que les fiches de la carte). Dans l'espace souscripteur,
     la fonction serveur ne le renvoie pas (voir le test des champs serveur) et il n'est affiché qu'en mode public. */
  const affichages = js.split('\n').filter((l) => /l\.prix/.test(l) && /<span>Prix/.test(l));
  assert.ok(affichages.length > 0 && affichages.every((l) => /pub && l\.prix/.test(l)), 'prix affiché hors mode public');
});

test('fonction serveur : champs renvoyés limités, statut réduit à 3 valeurs, droits sans anon', () => {
  const sql = lire('supabase/portail_plan_lotissement.sql');
  const bloc = /'lots', \(\s*select coalesce\(jsonb_agg\(jsonb_build_object\(([\s\S]*?)\)\), '\[\]'::jsonb\)/.exec(sql);
  assert.ok(bloc, 'bloc des lots introuvable');
  const cles = [...bloc[1].matchAll(/'([a-z_]+)',/g)].map((m) => m[1]);
  assert.deepStrictEqual(cles, ['id', 'numero', 'ilot', 'surface', 'statut', 'poly']);
  assert.ok(/'mon_lot'[\s\S]*'libre'[\s\S]*'attribue'/.test(sql));
  assert.ok(/revoke all on function public\.fc_vue_plan_lotissement\(\) from public, anon;/.test(sql));
  assert.ok(/grant execute on function public\.fc_vue_plan_lotissement\(\) to authenticated, service_role;/.test(sql));
  assert.ok(/security definer set search_path to ''/.test(sql));
  assert.ok(/auth\.jwt\(\) ->> 'kind'/.test(sql) && /<> 'souscripteur'/.test(sql));
});
