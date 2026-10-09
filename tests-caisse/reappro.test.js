const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function amorcer(page) {
  await page.evaluate(function () {
    const o = new Date().toISOString();
    DATA.caisses = [{ id: 'c1', nom: 'CENTRALE', compte: '571' }, { id: 'c2', nom: 'AGRO', compte: '572' }];
    DATA.caisse_sessions = [
      { id: 's1', caisse_id: 'c1', date: o.slice(0, 10), statut: 'ouverte', fond_ouverture: 1000000, ouverte_par: 'T', ouverte_par_id: 'u1', ouverte_le: o },
      { id: 's2', caisse_id: 'c2', date: o.slice(0, 10), statut: 'ouverte', fond_ouverture: 0, ouverte_par: 'T', ouverte_par_id: 'u1', ouverte_le: o }];
    DATA.demandes_reappro = [{ id: 'd1', numero: 'REAP-T1', statut: 'validee', caisse_id: 'c2', montant_demande: 100000, montant_accorde: 100000, demande_par: 'X', valide_par: 'Y' }];
    window.reapRender = function () {};
  });
}

test('réappro : un virement de même caisse et même montant se rattache à la demande validée (elle passe « servie »)', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      document.getElementById('ct-source-id').value = 'c1';
      const sel = document.getElementById('ct-destination'); sel.innerHTML = '<option value="c2">AGRO</option>'; sel.value = 'c2';
      document.getElementById('ct-date').value = new Date().toISOString().slice(0, 10); document.getElementById('ct-motif').value = 'appro';
      document.getElementById('ct-montant').value = '100000'; await caisseTransfererFonds();
      const d = DATA.demandes_reappro[0];
      const lies = DATA.caisse_mouvements.filter(function (m) { return m.reappro_id === 'd1'; }).length;
      document.getElementById('ct-montant').value = '55000'; await caisseTransfererFonds();
      return { statut: d.statut, mvt: !!d.mouvement_id, src: d.caisse_source_id, lies: lies, sansDemande: DATA.caisse_mouvements.filter(function (m) { return !m.reappro_id; }).length };
    });
    assert.equal(r.statut, 'servie');
    assert.equal(r.mvt, true);
    assert.equal(r.src, 'c1');
    assert.equal(r.lies, 2);
    assert.equal(r.sansDemande, 2);           /* un virement sans demande équivalente reste indépendant */
  } finally { await app.fermer(); }
});

test('réappro : une demande identique à moins de 24 h demande confirmation', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const form = function (montant) {
      document.getElementById('rea-id').value = ''; document.getElementById('rea-division').innerHTML = '<option value="dv">dv</option>'; document.getElementById('rea-division').value = 'dv';
      document.getElementById('rea-caisse').innerHTML = '<option value="c2">AGRO</option>'; document.getElementById('rea-caisse').value = 'c2';
      document.getElementById('rea-montant').value = montant; document.getElementById('rea-motif').value = 'APPRO';
    };
    const premier = await app.page.evaluate(async function (f) { eval('(' + f + ')')('70000'); const n = DATA.demandes_reappro.length; await reapSauver(); return DATA.demandes_reappro.length - n; }, form.toString());
    assert.equal(premier, 1);
    app.etat.confirm = false;
    const refuse = await app.page.evaluate(async function (f) { eval('(' + f + ')')('70000'); const n = DATA.demandes_reappro.length; await reapSauver(); return DATA.demandes_reappro.length - n; }, form.toString());
    assert.equal(refuse, 0);
    assert.ok(app.etat.dialogues.some(function (d) { return /demande identique/.test(d); }));
  } finally { await app.fermer(); }
});

test('réappro : on ne valide pas sa propre demande (identifiant), un autre validateur le peut', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      DATA.demandes_reappro.push({ id: 'd2', numero: 'REAP-T2', statut: 'soumise', caisse_id: 'c2', montant_demande: 40000, demande_par: 'Comptable Test', demande_par_id: 'u1' });
      const d = DATA.demandes_reappro[1];
      await reapValider('d2'); const moi = d.statut;
      APP.currentUser = { id: 'u2', nom: 'Autre Valideur', role: 'comptable' };
      await reapValider('d2');
      return { moi: moi, autre: d.statut };
    });
    assert.equal(r.moi, 'soumise');
    assert.equal(r.autre, 'validee');
  } finally { await app.fermer(); }
});

test('synchro : un statut plus avancé du cloud n\'est jamais écrasé par une copie périmée (demandes et sessions)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function () {
      SB.url = 'https://x.supabase.co'; SB.key = 'k'; __enLigne(true);
      const appels = [];
      const cloud = function (table, statut, extra) {
        window.sbFetch = async function (path, method) {
          appels.push((method || 'GET') + ' ' + path.split('?')[0]);
          if ((method || 'GET') === 'POST') return [];
          if (path.indexOf('select=id,s:') > -1) return [{ id: 'x1', s: statut }];
          if (path.indexOf('select=*') > -1) return [{ id: 'x1', data: Object.assign({ id: 'x1', statut: statut }, extra || {}) }];
          return [];
        };
      };
      const res = {};
      cloud('pi_demandes_reappro', 'servie', { mouvement_id: 'm1' });
      let o = { id: 'x1', statut: 'validee' }; appels.length = 0;
      await __syncReel('pi_demandes_reappro', o);
      res.demande = { statut: o.statut, mvt: o.mouvement_id, post: appels.some(function (a) { return a.indexOf('POST') === 0; }) };
      cloud('pi_demandes_reappro', 'validee');
      o = { id: 'x1', statut: 'servie' }; appels.length = 0;
      await __syncReel('pi_demandes_reappro', o);
      res.progression = { statut: o.statut, post: appels.some(function (a) { return a.indexOf('POST') === 0; }) };
      cloud('pi_caisse_sessions', 'cloturee', { caisse_id: 'c1', fond_cloture_reel: 100 });
      o = { id: 'x1', caisse_id: 'c1', statut: 'ouverte' }; appels.length = 0;
      await __syncReel('pi_caisse_sessions', o);
      res.session = { statut: o.statut, post: appels.some(function (a) { return a.indexOf('POST') === 0; }) };
      return res;
    });
    assert.deepEqual(r.demande, { statut: 'servie', mvt: 'm1', post: false });
    assert.deepEqual(r.progression, { statut: 'servie', post: true });
    assert.deepEqual(r.session, { statut: 'cloturee', post: false });
  } finally { await app.fermer(); }
});
