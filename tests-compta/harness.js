/* Harnais des tests de non-régression — module Comptabilité.
   Charge la VRAIE page de l'ERP dans Chromium (aucune fonction réimplémentée), coupe le réseau,
   et GARDE le vrai dbPut / IndexedDB : les verrous de visa et d'exercice clos sont ceux de la production.
   Lancer : npm run test:compta (variables : PLAYWRIGHT_PATH, CHROMIUM_PATH, ERP_PAGE). */
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
  .find(function (f) { return fs.existsSync(f) && fs.readFileSync(f, 'utf8').indexOf('function calcBilan(') !== -1; });
if (!PAGE_ERP) throw new Error('Page ERP avec calcBilan() introuvable dans ' + RACINE);

let navigateur = null;
async function lancer() {
  if (!navigateur) navigateur = await chargerPlaywright().chromium.launch({ executablePath: trouverChromium() });
  return navigateur;
}
async function fermerNavigateur() { if (navigateur) { await navigateur.close(); navigateur = null; } }

/* Ouvre l'ERP. etat.confirm : réponse aux confirm() ; etat.prompts : file de réponses aux prompt() ;
   etat.dialogues : textes affichés ; etat.toasts : messages affichés à l'écran. */
async function ouvrirApp() {
  const b = await lancer();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
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
  await page.waitForFunction(function () { return typeof calcBilan === 'function' && typeof DATA !== 'undefined' && typeof db !== 'undefined' && !!db; }, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(preparer);
  return { page, etat, fermer: function () { return ctx.close(); } };
}

/* Neutralise droits et réseau (SANS toucher à dbPut) ; capte les messages à l'écran. */
function preparer() {
  APP.currentUser = { id: 'u1', nom: 'Comptable Test', role: 'admin' };
  window.exigerDroit = function () { return true; };
  window.exigerPlafond = function () { return true; };
  window.hasRole = function () { return true; };
  window.syncToSupabase = async function (t, o) { (window.__sync = window.__sync || []).push({ t: t, id: o && o.id, rejete: !!(o && o._rejete) }); return true; };
  window.sbFetch = async function () { return []; };
  window.__toasts = [];
  const toastReel = window.toast;
  window.toast = function (m, t) { window.__toasts.push(String(m)); try { toastReel(m, t); } catch (e) {} };
  DATA.params = { comptes_defaut: { client_lots: '4111', treso_banque: '521', treso_caisse: '571', treso_mobile: '531', paie_charge: '641', vente_lot_produit: '701' }, taux_is: 25 };
  if (typeof rebuildPlanComptable === 'function') rebuildPlanComptable();
  DATA.ecritures = [];
  DATA.versements = []; DATA.clients = []; DATA.lots = [];
  /* Ecritures d'un jeu de test : E(id, date, débit, crédit, montant, extras) */
  window.E = function (id, date, d, c, m, extra) {
    return Object.assign({ id: id, date: date, libelle: 'T ' + id, lignes: [{ compte: d, sens: 'D', montant: m }, { compte: c, sens: 'C', montant: m }] }, extra || {});
  };
  /* Sélectionne l'exercice dans le filtre de la Comptabilité (la liste n'est remplie qu'à l'ouverture du module). */
  window.annee = function (a) {
    const sel = document.getElementById('filter-annee-compta');
    if (![].some.call(sel.options, function (o) { return o.value === String(a); })) {
      const o = document.createElement('option'); o.value = String(a); o.textContent = String(a); sel.appendChild(o);
    }
    sel.value = String(a);
  };
}

module.exports = { ouvrirApp, fermerNavigateur, PAGE_ERP };
