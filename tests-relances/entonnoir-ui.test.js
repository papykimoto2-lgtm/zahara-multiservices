const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('pipeline : historique tracé, perte avec motif, entonnoir rendu, saveLead conserve historique et date', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      DATA.leads = [
        { id: 'l1', nom: 'Awa <img src=x onerror=window.__xss=1>', tel: '0712345678', stade: 'prospect', created_at: new Date().toISOString().slice(0, 10), source: 'site_web', budget: 12000000 },
        { id: 'l2', nom: 'Koffi', tel: '0711111111', stade: 'contact', created_at: new Date().toISOString().slice(0, 10), source: 'salon', budget: 8000000 }
      ];
      setLeadStade('l1', 'contact'); setLeadStade('l1', 'visite');
      ENT.perduId = 'l2'; entPerduOuvrir('l2');
      document.getElementById('ent-perdu-motif').value = ''; entPerduConfirmer();      // sans motif : refusé
      const refuse = DATA.leads[1].statut !== 'perdu';
      document.getElementById('ent-perdu-motif').value = 'prix'; entPerduConfirmer();
      // édition via saveLead : historique et created_at conservés
      openLead('l1');
      document.getElementById('ld-nom').value = 'Awa'; document.getElementById('ld-tel').value = '0712345678';
      document.getElementById('ld-stade').value = 'visite_faite';
      await saveLead();
      const l1 = DATA.leads.find(x => x.id === 'l1');
      ENT.periode = 'tout'; entOuvrir();
      return { refuse, perdu: DATA.leads[1].statut === 'perdu' && DATA.leads[1].perte.motif === 'prix',
        hist: l1.historique_stades.map(h => h.stade), createdOk: !!l1.created_at, stade: l1.stade,
        html: document.getElementById('ent-body').innerHTML, xss: window.__xss || 0,
        hidden: !document.getElementById('pipeline-board').innerHTML.includes('Koffi') };
    });
    assert.equal(r.refuse, true); assert.equal(r.perdu, true);
    assert.deepEqual(r.hist, ['prospect', 'contact', 'visite', 'visite_faite']);
    assert.equal(r.createdOk, true); assert.equal(r.stade, 'visite_faite');
    assert.match(r.html, /Prix trop élevé/); assert.match(r.html, /Parcours/);
    assert.equal(r.xss, 0); assert.equal(r.hidden, true);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
