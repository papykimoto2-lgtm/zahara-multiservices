/* Lot B — phase 1 : un document HTML venu de la base s'ouvre dans une iframe sandbox (origine opaque) :
   un script injecté ne peut ni lire le jeton du portail, ni son stockage, ni la page parente ; l'impression reste possible. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const portail = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
const src = portail.match(/function ouvrirDocSandbox\(html, imprimer\)\{[\s\S]*?\n    return true;\n  \}/)[0];

const MALVEILLANT = '<!doctype html><html><head><title>t</title></head><body><p id="ok">Attestation ATS-1</p>'
  + '<script>window.print=function(){document.title="imprime";};'
  + 'var o=[];'
  + 'try{o.push("parent:"+window.parent.sessionStorage.getItem("pp_token"));}catch(e){o.push("parent:bloque");}'
  + 'try{o.push("top:"+window.top.document.title);}catch(e){o.push("top:bloque");}'
  + 'try{o.push("local:"+(sessionStorage.getItem("pp_token")||"vide"));}catch(e){o.push("local:bloque");}'
  + 'try{o.push("opener:"+(window.opener&&window.opener.document?"lu":"nul"));}catch(e){o.push("opener:bloque");}'
  + 'try{window.top.location="about:blank";o.push("nav:?");}catch(e){o.push("nav:bloque");}'
  + 'document.getElementById("ok").setAttribute("data-res",o.join("|"));<\/script></body></html>';

/* Page hôte réelle (file://, window.open natif : le harnais de l'ERP simule window.open). */
async function hote(app) {
  const p = await app.page.context().newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'conditions.html'));
  return p;
}
async function ouvrir(app, html, imprimer) {
  const ctx = app.page.context(), h0 = await hote(app);
  const [pop] = await Promise.all([
    ctx.waitForEvent('page'),
    h0.evaluate(([code, h, i]) => { sessionStorage.setItem('pp_token', 'SECRET-JETON'); const f = new Function(code + '; return ouvrirDocSandbox;')(); window.__ok = f(h, i); }, [src, html, !!imprimer]),
  ]);
  await pop.waitForSelector('iframe');
  await pop.waitForTimeout(600);
  const frame = pop.frames().find((f) => f !== pop.mainFrame());
  return { pop, frame };
}

test('script injecté : aucun accès au jeton, au stockage ni à la page parente ; le document légitime s\'affiche', async () => {
  const app = await ouvrirApp();
  const { pop, frame } = await ouvrir(app, MALVEILLANT, false);
  const res = await frame.evaluate(() => document.getElementById('ok').getAttribute('data-res'));
  assert.ok(!/SECRET/.test(res), 'le jeton ne fuit pas : ' + res);
  assert.match(res, /parent:bloque/); assert.match(res, /local:bloque/); assert.match(res, /top:bloque/);
  assert.ok(!/nav:\?/.test(res) || (await pop.url()) === 'about:blank' === false, 'pas de navigation du parent');
  assert.equal(await frame.evaluate(() => document.getElementById('ok').textContent), 'Attestation ATS-1');
  assert.equal(await pop.evaluate(() => !!document.querySelector('iframe').getAttribute('sandbox') && document.querySelector('iframe').getAttribute('sandbox').indexOf('allow-same-origin') < 0), true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('impression : le bouton déclenche print() DANS le document, et imprimer=true le fait seul', async () => {
  const app = await ouvrirApp();
  let { pop, frame } = await ouvrir(app, MALVEILLANT, false);
  assert.notEqual(await frame.evaluate(() => document.title), 'imprime');
  await pop.click('#pp-imp'); await pop.waitForTimeout(400);
  assert.equal(await frame.evaluate(() => document.title), 'imprime', 'le bouton imprime depuis l\'iframe');
  await pop.close();
  ({ pop, frame } = await ouvrir(app, MALVEILLANT, true)); await pop.waitForTimeout(1200);
  assert.equal(await frame.evaluate(() => document.title), 'imprime', 'impression automatique');
});

test('les quatre ouvertures de document stocké passent par la sandbox (plus de document.write brut)', () => {
  assert.ok(!/document\.write\((a|n)\.html\)/.test(portail), 'aucun document.write du HTML stocké');
  assert.equal((portail.match(/ouvrirDocSandbox\((a|n)\.html,/g) || []).length, 4);
});
