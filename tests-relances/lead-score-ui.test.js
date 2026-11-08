const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('pipeline : pastille de score, tri des plus chauds en haut, liste « À appeler », XSS inerte', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const j = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
      DATA.programmes = []; DATA.lots = [];
      DATA.leads = [
        { id: 'froid', nom: 'Froid', tel: '0711111111', stade: 'contact', created_at: j(60), source: 'salon' },
        { id: 'chaud', nom: 'Chaud <img src=x onerror=window.__xss=1>', tel: '0722222222', stade: 'contact', created_at: j(1), date_contact: j(1), source: 'site_web', budget: 15000000, date_relance: j(-2) },
        { id: 'neg', nom: 'Negoce', tel: '0733333333', stade: 'negociation', created_at: j(2), budget: 20000000 }
      ];
      renderPipeline();
      const col = document.querySelector('.pl-col-body');          // 2e colonne = contact : chaud avant froid
      const cols = document.querySelectorAll('.pl-col-body');
      const contact = cols[1].innerHTML;
      lsOuvrir();
      const body = document.getElementById('ls-body').innerHTML;
      return { ordre: contact.indexOf('Chaud') < contact.indexOf('Froid') && contact.indexOf('Chaud') > -1, pastille: /🔥|🟠|❄️/.test(contact),
        premier: (body.match(/<strong>([^<]+)<\/strong>/) || [])[1], action: /Action recommandée/.test(body), xss: window.__xss || 0,
        bouton: !!document.querySelector('[onclick="lsOuvrir()"]') };
    });
    assert.equal(r.ordre, true); assert.equal(r.pastille, true); assert.equal(r.bouton, true); assert.equal(r.action, true);
    assert.equal(r.premier, 'Negoce');       // négociation + gros budget = priorité n°1
    assert.equal(r.xss, 0);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
