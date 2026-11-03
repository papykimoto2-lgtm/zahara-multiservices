/* Lot C : synchronisation multi-postes (audit « dysfonctionnements ») */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('C1 : un tombstone LOCAL seul ne supprime jamais la fiche d\'un collègue dans le cloud ; un tombstone PARTAGÉ si', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async () => {
      const o = {}; const appels = []; window.deleteFromSupabase = async function (t, id) { appels.push(t + ':' + id); };
      DATA.clients = []; DATA.suppressions_sync = [];
      tombAdd('clients', 'c9');                                              /* hérité d'un import annulé : LOCAL seulement */
      await _rtApply('pi_clients', 'INSERT', { id: 'c9', data: { id: 'c9', nom: 'Saisi par un collègue', _modifie: new Date().toISOString() } }, null);
      o.local = { suppressionCloud: appels.length, ajoute: DATA.clients.some(c => c.id === 'c9') };
      DATA.suppressions_sync = [{ id: 'ts::clients::c8', store: 'clients', record_id: 'c8' }]; tombAdd('clients', 'c8');   /* suppression réellement voulue et propagée */
      await _rtApply('pi_clients', 'INSERT', { id: 'c8', data: { id: 'c8', nom: 'Supprimée', _modifie: new Date().toISOString() } }, null);
      o.partage = { appels: appels.slice(), ajoute: DATA.clients.some(c => c.id === 'c8') };
      return o;
    });
    assert.deepEqual(r.local, { suppressionCloud: 0, ajoute: false });
    assert.deepEqual(r.partage, { appels: ['pi_clients:c8'], ajoute: false });
  } finally { await app.fermer(); }
});

test('C2 : seul l\'écho de NOTRE écriture est ignoré ; la modification ou suppression d\'un autre poste dans les 30 s est appliquée', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async () => {
      const o = {}; const t0 = '2026-03-01T10:00:00.000Z', t1 = '2026-03-01T10:00:20.000Z';
      DATA.clients = [{ id: 'c1', nom: 'A', _modifie: t0 }];
      _rtMarkMyWrite('c1', t0, false);                                        /* nous venons d'écrire c1 */
      await _rtApply('pi_clients', 'UPDATE', { id: 'c1', data: { id: 'c1', nom: 'A', _modifie: t0 } }, null);   /* écho */
      o.echo = DATA.clients[0].nom;
      await _rtApply('pi_clients', 'UPDATE', { id: 'c1', data: { id: 'c1', nom: 'B (collègue)', _modifie: t1 } }, null);   /* AUTRE poste, 20 s plus tard */
      o.autre = DATA.clients[0].nom;
      _rtMarkMyWrite('c1', t1, false);
      await _rtApply('pi_clients', 'DELETE', null, { id: 'c1' });             /* suppression par un autre poste */
      o.suppression = DATA.clients.some(c => c.id === 'c1');
      DATA.clients = [{ id: 'c2', nom: 'X', _modifie: t0 }]; _rtMarkMyWrite('c2', null, true);
      await _rtApply('pi_clients', 'DELETE', null, { id: 'c2' });             /* écho de NOTRE suppression */
      o.notreSuppression = DATA.clients.some(c => c.id === 'c2');
      return o;
    });
    assert.equal(r.echo, 'A'); assert.equal(r.autre, 'B (collègue)'); assert.equal(r.suppression, false); assert.equal(r.notreSuppression, true);
  } finally { await app.fermer(); }
});

test('C4 : curseur de pull plafonné (horloge en avance) et relu avec une marge de 2 min (horloge en retard)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async () => {
      const o = {}; localStorage.removeItem('immosuite_pull_curseurs');
      const loin = new Date(Date.now() + 3600e3).toISOString();               /* poste en avance d'1 h */
      _pullCurseurSet('pi_clients', loin); const stocke = _pullCurseurs()['pi_clients'];
      o.plafonne = stocke <= new Date(Date.now() + 301e3).toISOString() && stocke < loin;
      const T = '2026-03-01T10:00:00.000Z'; _pullCurseurSet('pi_clients', T); DATA.clients = [{ id: 'c1' }];
      let url = ''; window.sbFetch = async function (u) { url = u; return []; };
      await _pullTable('pi_clients');
      const m = /gt\.([^&]+)/.exec(url); o.curseurUtilise = m ? decodeURIComponent(m[1]) : '';
      return o;
    });
    assert.equal(r.plafonne, true); assert.equal(r.curseurUtilise, '2026-03-01T09:58:00.000Z');
  } finally { await app.fermer(); }
});

test('C5 : clôtures d\'exercice et numérotation partagées entre postes (fusion par horodatage, jamais effacées)', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async () => {
      const o = {}; const t1 = '2026-03-01T10:00:00Z', t2 = '2026-03-02T10:00:00Z';
      /* poste B : ne connaît pas la clôture 2024 faite sur A ; numérotation en retard */
      let loc = { seq_ecr: { 'JL-2026': 3 } }; _fusionnerClotures(loc, { cloture_2024: true, cloture_maj: { cloture_2024: t1 } }); _fusionnerSeqEcr(loc, { seq_ecr: { 'JL-2026': 7, 'JL-2025': 2 } });
      o.clos = loc.cloture_2024; o.seq = loc.seq_ecr;
      /* réouverture plus récente locale : n'est pas écrasée par la clôture distante plus ancienne */
      loc = { cloture_2024: false, cloture_maj: { cloture_2024: t2 } }; _fusionnerClotures(loc, { cloture_2024: true, cloture_maj: { cloture_2024: t1 } }); o.reouvert = loc.cloture_2024;
      /* clôture distante plus récente que notre réouverture : elle l'emporte */
      loc = { cloture_2024: false, cloture_maj: { cloture_2024: t1 } }; _fusionnerClotures(loc, { cloture_2024: true, cloture_maj: { cloture_2024: t2 } }); o.reclos = loc.cloture_2024;
      /* sans horodatage : « clos » l'emporte */
      loc = { cloture_2023: false }; _fusionnerClotures(loc, { cloture_2023: true }); o.sansDate = loc.cloture_2023;
      /* chemin réel : pull des params */
      window.getSBConfig = () => {}; SB.url = 'http://x'; SB.key = 'k'; Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.sbFetch = async function () { return [{ id: 'main', data: { id: 'main', params_maj: t2, cloture_2022: true, cloture_maj: { cloture_2022: t2 }, seq_ecr: { 'JL-2026': 11 } } }]; };
      DATA.params = { id: 'main', params_maj: t1 };
      await _pullPlanComptableCloud();
      o.pull = [exerciceEstClos('2022-06-01'), (DATA.params.seq_ecr || {})['JL-2026']];
      return o;
    });
    assert.equal(r.clos, true); assert.deepEqual(r.seq, { 'JL-2026': 7, 'JL-2025': 2 });
    assert.equal(r.reouvert, false); assert.equal(r.reclos, true); assert.equal(r.sansDate, true);
    assert.deepEqual(r.pull, [true, 11]);
  } finally { await app.fermer(); }
});
