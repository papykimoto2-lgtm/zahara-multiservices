const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function amorcer(page) {
  await page.evaluate(function () {
    DATA.caisse_sessions = [{ id: 's1', caisse_id: 'c1', date: '2026-09-03', statut: 'ouverte', fond_ouverture: 100000, ouverte_par: 'T', ouverte_par_id: 'u1', ouverte_le: new Date().toISOString() }];
    DATA.caisse_mouvements = [
      { id: 'a', session_id: 's1', caisse_id: 'c1', type: 'sortie', montant: 5000, requiert_validation: true, valide: false, numero: 'BS-1', motif: 'x', demande_par: 'Comptable Test', demande_par_id: 'u1' },
      { id: 'b', session_id: 's1', caisse_id: 'c1', type: 'sortie', montant: 7000, requiert_validation: true, valide: false, numero: 'BS-2', motif: 'y', demande_par: 'Autre Personne', demande_par_id: 'u9' },
      { id: 'c', session_id: 's1', caisse_id: 'c1', type: 'sortie', montant: 3000, requiert_validation: true, valide: false, numero: 'BS-3', motif: 'z', demande_par: ' COMPTABLE test ' }];
    window.__bon = function (montant, benef) {
      document.getElementById('cb-mvt-id').value = ''; document.getElementById('cb-caisse-id').value = 'c1'; document.getElementById('cb-type').value = 'sortie';
      document.getElementById('cb-date').value = new Date().toISOString().slice(0, 10); document.getElementById('cb-montant').value = montant;
      document.getElementById('cb-motif').value = 'Carburant'; document.getElementById('cb-beneficiaire').value = benef; document.getElementById('cb-piece').value = 'P';
    };
  });
}

test('validation : on ne valide pas sa propre demande (par identifiant ou, à défaut, par nom)', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      await caisseValiderDecaissement('a'); await caisseValiderDecaissement('c'); await caisseValiderDecaissement('b');
      const v = function (id) { return DATA.caisse_mouvements.find(function (m) { return m.id === id; }).valide; };
      return { a: v('a'), b: v('b'), c: v('c') };
    });
    assert.deepEqual(r, { a: false, b: true, c: false }); /* a : sa propre demande (id) ; b : demande d'un autre ; c : sa propre demande (nom hérité) */
  } finally { await app.fermer(); }
});

test('garde-fous de saisie : bon sans session, session inconnue, numéro déjà utilisé', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(function () {
      return {
        sans: caisseGardeNouveauMouvement({ id: 'n', caisse_id: 'c1', numero: 'BS-9', session_id: '' }),
        inconnue: caisseGardeNouveauMouvement({ id: 'n', caisse_id: 'c1', numero: 'BS-9', session_id: 'zzz' }),
        double: caisseGardeNouveauMouvement({ id: 'n', caisse_id: 'c1', numero: 'BS-1', session_id: 's1' }),
        ok: caisseGardeNouveauMouvement({ id: 'n', caisse_id: 'c1', numero: 'BS-10', session_id: 's1' })
      };
    });
    assert.match(r.sans, /aucune session/);
    assert.match(r.inconnue, /aucune session/);
    assert.match(r.double, /existe déjà/);
    assert.equal(r.ok, null);
  } finally { await app.fermer(); }
});

test('saisie : un bon identique à moins de 10 minutes demande confirmation', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const premier = await app.page.evaluate(async function () { __bon('20000', 'Station'); const n0 = DATA.caisse_mouvements.length; await caisseSaveBon(); return DATA.caisse_mouvements.length - n0; });
    assert.equal(premier, 1);
    app.etat.confirm = false; app.etat.dialogues.length = 0;
    const refuse = await app.page.evaluate(async function () { __bon('20000', 'Station'); const n0 = DATA.caisse_mouvements.length; await caisseSaveBon(); return DATA.caisse_mouvements.length - n0; });
    assert.equal(refuse, 0);
    assert.ok(app.etat.dialogues.some(function (d) { return /bon identique/.test(d); }));
    app.etat.confirm = true;
    const confirme = await app.page.evaluate(async function () { __bon('20000', 'Station'); const n0 = DATA.caisse_mouvements.length; await caisseSaveBon(); return DATA.caisse_mouvements.length - n0; });
    assert.equal(confirme, 1);
  } finally { await app.fermer(); }
});
