const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('cockpit : les actions de croissance rejoignent la file, triées avec les autres, reportables, sans erreur', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const j = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      DATA.params = DATA.params || {}; DATA.params.wa_relances = { actif: true, provider: 'cinetpay' }; DATA.params.parrainage = { actif: true, montant: 100000, seuil_pct: 10 };
      DATA.ecritures = []; DATA.programmes = []; DATA.lots = []; DATA.apporteurs = []; DATA.relances = [];
      DATA.clients = []; DATA.versements = [];
      DATA.leads = [
        { id: 'n1', nom: 'Négo <img src=x onerror=window.__xss=1>', tel: '0711111111', stade: 'negociation', created_at: j(40), budget: 25000000, source: 'site_web', email: 'a@b.c', programme_id: 'p', commercial_id: 'c' },
        { id: 'h1', nom: 'Chaud', tel: '0722222222', stade: 'visite_faite', created_at: j(2), date_contact: j(1), budget: 15000000, source: 'site_web', date_relance: j(-2), email: 'a@b.c', programme_id: 'p', commercial_id: 'c' }];
      CCR.cache = null;
      const A = ckActions(), cr = A.filter(a => a.aid.startsWith('cr_'));
      const ids = A.map(a => a.aid);
      const prios = A.map(a => a.prio), trie = prios.every((p, i) => i === 0 || prios[i - 1] >= p);
      const nego = cr.find(a => a.aid.startsWith('cr_nego_'));
      ckSnooze(nego.aid, 'demain');
      CCR.cache = null; const apres = ckActions().filter(a => a.aid.startsWith('cr_nego_')).length;
      localStorage.removeItem(CK_SNOOZE_KEY);
      buildDashTabCockpit();
      return { nb: cr.length, kinds: cr.map(a => a.aid.split('_')[1]).sort(), trie, apres, html: document.getElementById('ck-actions').innerHTML, xss: window.__xss || 0 };
    });
    assert.ok(r.kinds.includes('nego')); assert.ok(r.kinds.includes('chauds'));
    assert.equal(r.trie, true); assert.equal(r.apres, 0, 'report pour la journée');
    assert.doesNotMatch(r.html, /<img src=x/); assert.equal(r.xss, 0);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
