/* Revue Caisse : échappement des attributs, bons en attente/rejetés hors totaux (impressions, états, tableaux),
   navigation par mois, verrous (transfert, double clic), revue mensuelle. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('revue caisse : sécurité, chiffres effectifs, navigation, verrous', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async () => {
      const o = {};
      o.esc = escHtml('x" onmouseover="alert(1)\' <b>&');
      document.body.insertAdjacentHTML('beforeend', '<div id="zz-chips"></div><input id="zz-cible">');
      cbRenderChips('zz-chips', [{ label: 'a" onfocus="alert(1)' }], 'zz-cible');
      const btn = document.querySelector('#zz-chips button.chip');
      o.chip = [btn.getAttribute('onfocus'), btn.dataset.val];
      btn.click(); o.chipVal = document.getElementById('zz-cible').value;
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
      DATA.caisses = [{ id: 'c1', nom: 'Caisse A', compte: '571' }];
      DATA.caisse_sessions = [{ id: 's1', caisse_id: 'c1', date: '2026-10-05', statut: 'cloturee', fond_ouverture: 100000, ouverte_par: 'Awa' }];
      DATA.caisse_mouvements = [
        { id: 'm1', caisse_id: 'c1', session_id: 's1', type: 'sortie', montant: 20000, date: '2026-10-05T10:00:00', numero: 'BS-1', requiert_validation: true, valide: true, motif: 'ok' },
        { id: 'm2', caisse_id: 'c1', session_id: 's1', type: 'sortie', montant: 50000, date: '2026-10-05T11:00:00', numero: 'BS-2', requiert_validation: true, valide: false, motif: 'attente' },
        { id: 'm3', caisse_id: 'c1', session_id: 's1', type: 'sortie', montant: 70000, date: '2026-10-05T12:00:00', numero: 'BS-3', requiert_validation: true, valide: false, rejete: true, motif: 'rejet' }];
      o.flux = caisseFluxPeriode('2026-10-01', '2026-10-31');
      o.aVentiler = caisseAVentilerStats().nb;
      const crm = _crmCalculer('2026-10', 'c1'); o.crm = [crm.totD, crm.enAttente.length];
      let html = ''; window.openPrintPreview = h => { html = h; };
      CAISSE_UI.brouillardMode = 'session'; CAISSE_UI.brouillardSessionId = 's1'; caisseImprimerBrouillard();
      o.print = [/80\s000/.test(html), /— en attente —/.test(html), /— rejeté —/.test(html), /30\s000/.test(html)];
      CAISSE_UI.brouillardMode = 'periode'; CAISSE_UI.brouillardCaisseId = 'c1'; CAISSE_UI.brouillardDebut = '2026-10-01'; CAISSE_UI.brouillardFin = '2026-10-31'; caisseImprimerBrouillardPeriode();
      o.printPeriode = /— en attente —/.test(html) && !/30\s000/.test(html);
      o.texte = /Total sorties : 20\s000/.test(_caisseTexteJournalier(DATA.caisse_sessions[0], DATA.caisses[0]));
      CAISSE_DASH.periode = 'mois'; CAISSE_DASH.ancre = '2026-10-31'; window.caisseRenderDashboard = () => {};
      caisseNavPeriode(-1); o.nav = CAISSE_DASH.ancre.slice(0, 7);
      o.transfert = caisseCanEditBon({ id: 'x', transfert_id: 't1', session_id: 's1', created_by: 'Directeur' });
      o.verrous = ['reapServirConfirmer', 'caisseTransfererFonds', 'caisseCloturer', 'caisseValiderDecaissement'].map(n => !!window[n]._sansDoublon);
      return o;
    });
    assert.equal(r.esc, 'x&quot; onmouseover=&quot;alert(1)&#39; &lt;b&gt;&amp;');
    assert.deepEqual(r.chip, [null, 'a" onfocus="alert(1)']);
    assert.equal(r.chipVal, 'a" onfocus="alert(1)');
    assert.deepEqual(r.flux, { entrees: 0, sorties: 20000, net: -20000, nb: 1 });
    assert.equal(r.aVentiler, 1);
    assert.deepEqual(r.crm, [20000, 1]);
    assert.deepEqual(r.print, [true, true, true, false]);
    assert.equal(r.printPeriode, true);
    assert.equal(r.texte, true);
    assert.equal(r.nav, '2026-09');
    assert.equal(r.transfert, false);
    assert.deepEqual(r.verrous, [true, true, true, true]);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
