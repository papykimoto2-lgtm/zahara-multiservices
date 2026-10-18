/* CSP en observation : en-tête déclaré dans vercel.json, violations conservées côté navigateur. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('vercel.json : CSP en rapport seul, sans domaine générique dangereux', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const h = cfg.headers.find(x => x.source === '/(.*)').headers, csp = h.find(x => x.key === 'Content-Security-Policy-Report-Only');
  assert.ok(csp, 'en-tête CSP absent'); assert.ok(!h.some(x => x.key === 'Content-Security-Policy'), 'CSP bloquante non attendue à ce stade');
  const v = csp.value; assert.match(v, /object-src 'none'/); assert.match(v, /frame-ancestors 'self'/); assert.match(v, /base-uri 'self'/);
  assert.doesNotMatch(v, /script-src[^;]*\*(?![.])/); assert.doesNotMatch(v, /script-src[^;]*https:(?!\/)/);
});

test('rapport CSP : une violation est conservée (50 max) et lisible via cspRapport()', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(() => {
    localStorage.removeItem('csp_violations');
    for (let i = 0; i < 55; i++) document.dispatchEvent(new SecurityPolicyViolationEvent('securitypolicyviolation', { violatedDirective: 'script-src', blockedURI: 'https://evil.example/' + i, documentURI: location.href }));
    const l = cspRapport(); return [typeof cspRapport, l.length, l[l.length - 1].bloque, l[0].bloque, l[0].directive];
  });
  assert.deepEqual(r, ['function', 50, 'https://evil.example/54', 'https://evil.example/5', 'script-src']);
  assert.deepEqual(app.etat.erreursPage, []);
});
