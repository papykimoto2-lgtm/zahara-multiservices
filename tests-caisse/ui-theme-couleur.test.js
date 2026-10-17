/* Sélecteur de couleur de l'interface : 6 palettes, mémorisation, retour à l'apparence d'origine. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('6 pastilles ; un thème change l\'accent et la barre latérale, est mémorisé, bronze rétablit l\'origine', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(() => {
    const nb = document.querySelectorAll('#ui-theme-picker button').length;
    const dyn = () => (document.getElementById('ui-theme-dyn') || {}).textContent || '';
    const defaut = { attr: document.documentElement.getAttribute('data-ui'), css: dyn() };
    document.querySelector('#ui-theme-picker button[data-t="emeraude"]').click();
    const em = { attr: document.documentElement.getAttribute('data-ui'), css: dyn(), mem: localStorage.getItem('erp_ui_theme'), accent: getComputedStyle(document.body).getPropertyValue('--or').trim(), pressed: document.querySelector('#ui-theme-picker button[data-t="emeraude"]').getAttribute('aria-pressed') };
    uiThemeAppliquer('bronze');
    return { nb, defaut, em, retour: { css: dyn(), mem: localStorage.getItem('erp_ui_theme') } };
  });
  assert.equal(r.nb, 6);
  assert.equal(r.defaut.attr, 'bronze'); assert.equal(r.defaut.css, '');
  assert.equal(r.em.attr, 'emeraude'); assert.match(r.em.css, /#1A7F5A/); assert.match(r.em.css, /\.sidebar\{background:linear-gradient/);
  assert.equal(r.em.mem, 'emeraude'); assert.equal(r.em.accent.toLowerCase(), '#1a7f5a'); assert.equal(r.em.pressed, 'true');
  assert.equal(r.retour.css, ''); assert.equal(r.retour.mem, 'bronze');
  assert.equal(app.etat.erreursPage.length, 0, app.etat.erreursPage.join('\n'));
});

test('le thème mémorisé est réappliqué au rechargement', async () => {
  const app = await ouvrirApp();
  const css = await app.page.evaluate(() => { localStorage.setItem('erp_ui_theme', 'violet'); return null; });
  await app.page.reload({ waitUntil: 'domcontentloaded' }); await app.page.waitForTimeout(800);
  const r = await app.page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-ui'), css: (document.getElementById('ui-theme-dyn') || {}).textContent || '' }));
  assert.equal(r.attr, 'violet'); assert.match(r.css, /#6B3BC4/);
});
