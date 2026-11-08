const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('../tests-compta/harness');
after(fermerNavigateur);

test('UI : file du jour calculée depuis les vrais souscripteurs, aperçu rendu, XSS échappé', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      const auj = new Date(), p = (n) => (n < 10 ? '0' : '') + n;
      const dEch = new Date(auj.getFullYear(), auj.getMonth() - 4, auj.getDate() - 12);   // échéance il y a 12 j du mois
      const ancre = dEch.getFullYear() + '-' + p(dEch.getMonth() + 1) + '-' + p(dEch.getDate());
      DATA.clients = [{ id: 'c1', nom: '<img src=x onerror=window.__xss=1>', prenoms: 'Awa', tel: '0712345678', montant_total: 6000000, apport: 0, duree: 60, date_debut: ancre, date_souscription: ancre, dossier: 'D-1' }];
      DATA.versements = []; DATA.lots = []; DATA.relances = [];
      const entrees = waRelEntrees(new Date());
      const f = WaRelances.construireFile(entrees, {}, {}, new Date());
      WAREL.file = f.file; WAREL.ignores = f.ignores; WAREL.log = [];
      DATA.params = { wa_relances: { actif: true, provider: 'cinetpay' } };
      waRelOuvrir();
      await new Promise((ok) => setTimeout(ok, 300));
      return { nb: entrees.length, file: WAREL.file.map(x => ({ palier: x.palier, tel: x.tel, montant: x.montant })), ignores: WAREL.ignores,
        html: document.getElementById('wa-rel-body').innerHTML, xss: window.__xss || 0, btn: !!document.querySelector('[onclick="waRelOuvrir()"]') };
    });
    assert.equal(r.nb, 1);
    assert.equal(r.xss, 0, 'aucun script injecté');
    assert.doesNotMatch(r.html, /<img src=x/);
    assert.equal(r.btn, true, 'bouton présent sur la page Relances');
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
