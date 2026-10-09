/* Harnais des tests de non-régression du module Caisse.
   Charge la VRAIE page de l'ERP dans Chromium (aucune fonction réimplémentée) et isole le réseau :
   tout appel Supabase est intercepté, le cloud est simulé par chaque test.
   Lancer : node --test tests-caisse/*.test.js(variables : PLAYWRIGHT_PATH, CHROMIUM_PATH) */
const path = require('path');
const fs = require('fs');

function chargerPlaywright() {
  try { return require('playwright'); } catch (e) { /* repli ci-dessous */ }
  return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
}
function trouverChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    const dossiers = fs.readdirSync(base).filter(function (d) { return d.indexOf('chromium-') === 0; }).sort().reverse();
    for (const d of dossiers) {
      const c = path.join(base, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(c)) return c;
    }
  }
  return undefined;
}
const RACINE = path.resolve(__dirname, '..');
const PAGE_ERP = process.env.ERP_PAGE || ['index.html', 'menko-immo.html']
  .map(function (f) { return path.join(RACINE, f); })
  .find(function (f) { return fs.existsSync(f) && fs.readFileSync(f, 'utf8').indexOf('async function caisseOuvrir()') !== -1; });
if (!PAGE_ERP) throw new Error('Page ERP avec module Caisse introuvable dans ' + RACINE);

let navigateur = null;
async function lancer() {
  if (!navigateur) navigateur = await chargerPlaywright().chromium.launch({ executablePath: trouverChromium() });
  return navigateur;
}
async function fermerNavigateur() { if (navigateur) { await navigateur.close(); navigateur = null; } }

/* Ouvre l'ERP. `etat.confirm` : réponse aux confirm() (true par défaut) ;
   `etat.prompts` : file de réponses aux prompt() ; `etat.dialogues` : textes affichés. */
async function ouvrirApp() {
  const b = await lancer();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  const etat = { confirm: true, prompts: [], dialogues: [], erreursPage: [] };
  page.on('pageerror', function (e) { etat.erreursPage.push(e.message); });
  page.on('dialog', async function (d) {
    etat.dialogues.push(d.type() + ': ' + d.message());
    if (d.type() === 'prompt') {
      const rep = etat.prompts.shift();
      if (rep === undefined) await d.dismiss(); else await d.accept(rep);
    } else if (d.type() === 'confirm' && etat.confirm === false) await d.dismiss();
    else await d.accept();
  });
  await page.route('**/*supabase.co/**', function (r) { r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }); });
  await page.goto('file://' + PAGE_ERP);
  await page.waitForFunction(function () { return typeof caisseOuvrir === 'function' && typeof DATA !== 'undefined'; });
  await page.waitForTimeout(800);
  await page.evaluate(preparer);
  return { page, etat, fermer: function () { return ctx.close(); } };
}

/* Neutralise droits, persistance et synchro ; fournit un utilisateur et une caisse de test. */
function preparer() {
  window.__syncReel = window.__syncReel || syncToSupabase;   /* la vraie fonction, pour les tests de synchro */
  APP.currentUser = { id: 'u1', nom: 'Comptable Test', role: 'comptable' };
  window.exigerDroit = function () { return true; };
  window.exigerPlafond = function () { return true; };
  window.caisseUserPeut = function () { return true; };
  window.caisseRoleAdminLike = function () { return true; };
  window.dbPut = async function () { return true; };
  window.dbDelete = async function () { return true; };
  window.caisseSyncEtAlerter = async function () { return true; };
  window.syncToSupabase = async function () { return true; };
  window.syncPullStore = async function () {};
  window.sbFetch = async function () { return []; };     /* cloud simulé : « rien d'ouvert, rien de clôturé » */
  window.caisseNotifierValidation = function () {};
  window._reapNotifier = function () {};
  window._caisseAjouterRegle = async function () {};
  window.requireCompteDefaut = function (k) { return k === 'ecart_caisse_manquant' ? '658' : '758'; };
  DATA.params = DATA.params || {};
  DATA.params.comptes_defaut = { virement_interne: '585' };
  DATA.params.caisse_ventilation_map = { 'virement interne caisse': '585' };
  DATA.caisses = [{ id: 'c1', nom: 'CAISSE TEST', compte: '571' }];
  DATA.caisse_sessions = [];
  DATA.caisse_mouvements = [];
  DATA.demandes_reappro = [];
  DATA.ecritures = [];
  window.__enLigne = function (v) { Object.defineProperty(navigator, 'onLine', { value: v, configurable: true }); };
}

module.exports = { ouvrirApp, fermerNavigateur, PAGE_ERP };
