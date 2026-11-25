/* Statistiques de fréquentation du portail : mesure fiable (durée active, une fin par valeur, exclusion robots / tests)
   et écran (visites, médiane plafonnée, une durée par session). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const portail = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
const bloc = portail.match(/var ANALYTICS = \{[\s\S]*?function _anaOngletVu/)[0].replace(/function _anaOngletVu$/, '')
  + portail.match(/function _anaActif\(\)\{[\s\S]*?\n  function _anaVisibilite\(\)\{[\s\S]*?\n  \}\n/)[0];

function monde(ua, opts) {
  opts = opts || {};
  const envois = []; let t = 1000000; const store = Object.assign({}, opts.store || {});
  const env = {
    navigator: { userAgent: ua, webdriver: !!opts.webdriver, language: 'fr' },
    location: { search: opts.search || '', hostname: 'x.test' },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: { visibilityState: 'visible', referrer: '' },
    window: { innerWidth: 400 },
    fetch: (u, o) => { envois.push(JSON.parse(o.body)); return Promise.resolve({}); },
    SB_URL: 'http://sb', SB_KEY: 'k', Intl,
    Date: { now: () => t },
  };
  const f = new Function('E', 'with(E){' + bloc + '; return { A: ANALYTICS, exclu: _anaExclu, demarrer: _anaDemarrer, terminer: _anaTerminer, visibilite: _anaVisibilite, actif: _anaActif }; }');
  const m = f(env);
  return { m, env, envois, store, avancer: (ms) => { t += ms; } };
}
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

test('robots, aperçus de lien, automates et visites de test ne sont pas comptés', () => {
  for (const ua of ['Googlebot/2.1', 'facebookexternalhit/1.1', 'WhatsApp/2.23', 'Mozilla/5.0 HeadlessChrome/120', 'Lighthouse', 'curl/8.0'])
    assert.equal(monde(ua).m.exclu(), true, ua);
  assert.equal(monde(UA, { webdriver: true }).m.exclu(), true, 'automate');
  assert.equal(monde(UA).m.exclu(), false, 'vrai visiteur');
  const w = monde(UA, { search: '?nostats=1' });
  assert.equal(w.m.exclu(), true); assert.equal(w.store.pp_no_stats, '1', 'mémorisé dans le navigateur');
  assert.equal(monde(UA, { store: { pp_no_stats: '1' } }).m.exclu(), true, 'mémorisation relue');
  assert.equal(monde(UA, { store: { pp_no_stats: '1' }, search: '?nostats=0' }).m.exclu(), false, '?nostats=0 réactive');
});

test('durée = temps actif : l\'arrière-plan ne compte pas ; pagehide + beforeunload n\'envoient qu\'une valeur', () => {
  const w = monde(UA); const { m } = w;
  m.A.sessionId = 'sess_x'; m.A.debut = 1000000; m.A.depuis = 1000000;
  w.avancer(60000);                                  /* 60 s visible */
  w.env.document.visibilityState = 'hidden'; m.visibilite();   /* passe en arrière-plan : fin envoyée (60 s) */
  w.avancer(3 * 3600 * 1000);                        /* 3 h en arrière-plan : ne compte pas */
  w.env.document.visibilityState = 'visible'; m.visibilite();
  w.avancer(30000);                                  /* 30 s de plus */
  m.terminer(); m.terminer();                        /* pagehide + beforeunload */
  const fins = w.envois.filter((e) => e.event_type === 'session_end').map((e) => e.duree_ms);
  assert.deepEqual(fins, [60000, 90000], 'une fin au passage en arrière-plan, une à la fermeture, jamais deux fois la même');
  assert.ok(fins[fins.length - 1] < 4 * 3600 * 1000);
});

test('plafond de sécurité à 4 h', () => {
  const w = monde(UA); w.m.A.sessionId = 's'; w.m.A.depuis = 1000000; w.avancer(30 * 3600 * 1000);
  assert.equal(w.m.actif(), 4 * 3600 * 1000);
});

test('écran : visites, visites avec navigation, durée médiane plafonnée, une durée par session', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    var ids = ['pstats-kpis', 'pstats-regions', 'pstats-appareils', 'pstats-onglets', 'pstats-referrers', 'pstats-courbe'];
    ids.forEach(function (i) { if (!document.getElementById(i)) { var d = document.createElement('div'); d.id = i; document.body.appendChild(d); } });
    var rows = [];
    var s = function (id, ev, extra) { rows.push(Object.assign({ session_id: id, event_type: ev, cree_le: new Date().toISOString() }, extra || {})); };
    ['s1', 's2', 's3', 's4'].forEach(function (id) { s(id, 'session_start', { timezone: 'Africa/Abidjan', appareil: 'mobile' }); });
    s('s1', 'session_end', { duree_ms: 100000 }); s('s1', 'session_end', { duree_ms: 100000 });   /* doublon (anciennes versions) */
    s('s2', 'session_end', { duree_ms: 30 * 3600 * 1000 });                                      /* onglet oublié : plafonné à 2 h */
    s('s4', 'session_end', { duree_ms: 60000 });
    s('s3', 'tab_view', { onglet: 'programmes' });
    window.sbFetch = async function () { return rows; };
    await renderPortailStats();
    return document.getElementById('pstats-kpis').innerText.replace(/\s+/g, ' ');
  });
  assert.match(r, /Visites\s*4/i); assert.match(r, /navigation\s*1/i);
  assert.match(r, /médiane\s*1 min 40s/i, 'médiane de 60 s, 100 s et 7200 s (plafonné) = 100 s : ' + r);
  assert.match(r, /Taux de rebond\*\s*75%/i);
  assert.doesNotMatch(r, /Visiteurs uniques/i);
  assert.deepEqual(app.etat.erreursPage, []);
});
