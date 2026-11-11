/* Portail public — jeton d'espace connecté expiré.
   Le jeton (2 h) signait aussi les lectures publiques : une fois expiré, le serveur refusait tout et le portail
   s'affichait vide (0 programme, 0 lot, nom par défaut), rechargement compris. Vérifie qu'un jeton expiré ou refusé
   est écarté et que les lectures publiques aboutissent, sans toucher à un jeton encore valide. */
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
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jeton = (expSec) => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ role: 'authenticated', exp: expSec }) + '.signature';
const maintenant = () => Math.floor(Date.now() / 1000);
const LOTS = [1, 2, 3].map((i) => ({ id: 'L' + i, numero: String(i), statut: 'disponible', programme_id: 'PG1', lat: 5.31 + i / 1000, lng: -4.03, geo_polygon: null }));

let nav;
/* refuses : jetons que le serveur simulé rejette en 401, comme Supabase pour un jeton expiré. */
async function ouvrir(jetonStocke, refuses) {
  if (!nav) nav = await chargerPlaywright().chromium.launch({ executablePath: trouverChromium(), args: ['--no-sandbox'] });
  const page = await nav.newPage({ viewport: { width: 1200, height: 1000 } });
  const erreurs = [], porteurs = []; page.on('pageerror', (e) => erreurs.push(e.message));
  await page.addInitScript((a) => { try { sessionStorage.setItem('pp_token', a.t); sessionStorage.setItem('portail_session_v1', JSON.stringify({ espace: 'sous', id: 'C1', ts: 1 })); } catch (e) {} }, { t: jetonStocke });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('file:')) return route.continue();
    if (/leaflet\.min\.js/.test(u)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(FIX, 'leaflet-1.9.4.js')) });
    if (/leaflet\.min\.css/.test(u)) return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(FIX, 'leaflet-1.9.4.css')) });
    if (/\/rest\/v1\//.test(u)) {
      const porteur = (route.request().headers().authorization || '').replace(/^Bearer /, '');
      porteurs.push(porteur);
      if (refuses.indexOf(porteur) !== -1) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"JWT expired"}' });
      if (/pi_programmes_public/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: 'PG1', nom: 'Les Bougainvillées' }]) });
      if (/pi_lots_public/.test(u)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(new URL(u).searchParams.get('offset') > 0 ? [] : LOTS) });
      return route.fulfill({ contentType: 'application/json', body: '[]' });
    }
    return route.abort();
  });
  await page.goto('file://' + path.join(RACINE, 'portail-unique.html'));
  await page.evaluate(() => basculerVersOnglet('carte'));
  await page.waitForFunction(() => window.L && typeof CARTE !== 'undefined' && CARTE.map, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const etat = await page.evaluate(() => ({ lots: BIENS.lots.length, jeton: sessionStorage.getItem('pp_token'), session: sessionStorage.getItem('portail_session_v1') }));
  await page.close();
  return { etat, porteurs, erreurs };
}
test.after(async () => { if (nav) await nav.close(); });

test('jeton expiré resté dans l\'onglet : jamais envoyé, effacé, et les données publiques se chargent', async () => {
  const vieux = jeton(maintenant() - 3600);
  const { etat, porteurs, erreurs } = await ouvrir(vieux, [vieux]);
  assert.strictEqual(etat.lots, 3, 'les lots publics doivent se charger malgré le jeton expiré');
  assert.ok(porteurs.length > 0 && porteurs.indexOf(vieux) === -1, 'le jeton expiré ne doit partir dans aucune requête');
  assert.strictEqual(etat.jeton, null); assert.strictEqual(etat.session, null);
  assert.deepStrictEqual(erreurs, []);
});

test('jeton refusé par le serveur avant son échéance : écarté, requête rejouée avec la clé publique', async () => {
  const revoque = jeton(maintenant() + 3600);
  const { etat, porteurs, erreurs } = await ouvrir(revoque, [revoque]);
  assert.strictEqual(etat.lots, 3);
  assert.ok(porteurs.indexOf(revoque) !== -1, 'le jeton est d\'abord essayé');
  assert.strictEqual(etat.jeton, null);
  assert.deepStrictEqual(erreurs, []);
});

test('jeton valide : conservé et utilisé (pas de déconnexion intempestive)', async () => {
  const bon = jeton(maintenant() + 3600);
  const { porteurs } = await ouvrir(bon, []);
  assert.ok(porteurs.indexOf(bon) !== -1, 'le jeton valide doit signer les appels');
});
