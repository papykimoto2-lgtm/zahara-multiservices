/* Portail souscripteur : frais de titre à rembourser (notes de débours publiées, fc_vue_souscripteur_debours). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path'), fs = require('fs');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright').chromium; }
const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const exe = process.env.CHROMIUM_PATH || (fs.existsSync(base) ? fs.readdirSync(base).filter(d => d.startsWith('chromium-')).sort().reverse().map(d => path.join(base, d, 'chrome-linux', 'chrome')).find(f => fs.existsSync(f)) : undefined);
let nav; after(async () => { if (nav) await nav.close(); });
async function ouvrir() {
  nav = nav || await chromium.launch({ executablePath: exe });
  const page = await (await nav.newContext()).newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await page.goto('file://' + path.resolve(__dirname, '..', 'portail-unique.html'));
  await page.waitForFunction(() => typeof blocDeboursTitre === 'function' && typeof dbOuvrir === 'function');
  return { page, erreurs };
}

const NOTES = [{ id: 'n1', numero: 'NDF-2026-0001', date: '2026-10-10', echeance: '2000-01-01', montant: 350000, statut: 'emise', dossier: 'DF-1', html: '<p>NOTE <b>1</b></p>' },
  { id: 'n2', numero: 'NDF-2026-0002', date: '2026-09-10', echeance: '2099-01-01', montant: 50000, statut: 'encaissee', encaisse_le: '2026-09-20', dossier: 'DF-1', html: '<p>NOTE 2</p>' }];

test('portail : bloc frais de titre (statuts, retard, montants), vide sans note, texte échappé', async () => {
  const { page, erreurs } = await ouvrir();
  const r = await page.evaluate((N) => { S.debours = null; var a = blocDeboursTitre(); S.debours = []; var b = blocDeboursTitre(); S.debours = N.concat([{ numero: '<img src=x>', statut: 'emise', montant: 1, date: '2026-10-01', echeance: '2099-01-01', html: 'x' }]); return { a: a, b: b, h: blocDeboursTitre() }; }, NOTES);
  assert.equal(r.a, ''); assert.equal(r.b, '');
  assert.match(r.h, /NDF-2026-0001[\s\S]*À régler[\s\S]*En retard/); assert.match(r.h, /NDF-2026-0002[\s\S]*Réglée[\s\S]*réglée le/); assert.doesNotMatch(r.h, /<img src=x>/); assert.match(r.h, /&lt;img src=x&gt;/);
  assert.equal((r.h.match(/dbOuvrir\(/g) || []).length, 3); assert.deepEqual(erreurs, []);
});

test('portail : chargement par RPC sans paramètre ; réponse invalide ou refus = aucun bloc ; ouverture du document figé', async () => {
  const { page, erreurs } = await ouvrir();
  const r = await page.evaluate(async (N) => {
    var o = {}; window.__u = [];
    window.fetch = async function (u, opt) { window.__u.push([String(u), opt && opt.body]); return new Response(JSON.stringify({ notes: N }), { status: 200 }); };
    o.l = (await chargerDeboursTitre()).length; o.url = window.__u[0][0].split('/rpc/')[1]; o.body = window.__u[0][1];
    window.fetch = async function () { return new Response('{}', { status: 403 }); }; o.refus = await chargerDeboursTitre();
    window.fetch = async function () { return new Response('{"x":1}', { status: 200 }); }; o.invalide = await chargerDeboursTitre();
    var ecrit = ''; window.open = function () { return { document: { write: function (h) { ecrit = h; }, close: function () {} }, print: function () {} }; };
    S.debours = N; dbOuvrir(0); o.ecrit = ecrit; ecrit = ''; dbOuvrir(99); o.hors = ecrit;
    return o;
  }, NOTES);
  assert.equal(r.l, 2); assert.equal(r.url, 'fc_vue_souscripteur_debours'); assert.equal(r.body, '{}'); assert.equal(r.refus, null); assert.equal(r.invalide, null); assert.equal(r.ecrit, '<p>NOTE <b>1</b></p>'); assert.equal(r.hors, '');
  assert.deepEqual(erreurs, []);
});
