const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

function amorcer() {
  const cl = function (id, jour, fond, reel, ecart) {
    return { id: id, caisse_id: 'c1', date: '2026-10-0' + jour, statut: 'cloturee', fond_ouverture: fond, fond_cloture_theorique: reel - ecart, fond_cloture_reel: reel, ecart: ecart,
      ouverte_le: '2026-10-0' + jour + 'T08:00:00Z', cloturee_le: '2026-10-0' + jour + 'T17:00:00Z', ouverte_par: 'Caissière' };
  };
  DATA.caisse_sessions = [cl('s1', 1, 1000, 4000, -2000), cl('s2', 2, 4000, 3500, -200), cl('s3', 3, 5000, 5000, 0),
    { id: 'hist', caisse_id: 'c1', date: '2026-09-30', statut: 'cloturee', session_technique: true, reprise_historique: true, fond_ouverture: 0, fond_cloture_reel: 0, ecart: 0, ouverte_le: '2026-09-30T00:00:00Z', cloturee_le: '2026-09-30T00:01:00Z' }];
  DATA.caisse_mouvements = [
    { id: 'e1', session_id: 's1', caisse_id: 'c1', type: 'entree', montant: 5000, requiert_validation: false, valide: true },
    { id: 's2m', session_id: 's2', caisse_id: 'c1', type: 'sortie', montant: 300, requiert_validation: true, valide: true },
    { id: 'att', session_id: 's2', caisse_id: 'c1', type: 'sortie', montant: 900, requiert_validation: true, valide: false },
    { id: 'rej', session_id: 's2', caisse_id: 'c1', type: 'sortie', montant: 777, requiert_validation: true, valide: false, rejete: true },
    { id: 'tech', session_id: 'hist', caisse_id: 'c1', type: 'sortie', montant: 123456, requiert_validation: false, valide: true }];
}

test('rapprochement : écart réel cumulé, mouvements en attente à part, sessions techniques et rejets ignorés', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function (f) { eval('(' + f + ')')(); return caisseCalculerRapprochement('c1'); }, amorcer.toString());
    assert.equal(r.fondInitial, 1000);
    assert.equal(r.entrees, 5000);
    assert.equal(r.sorties, 300);
    assert.equal(r.attendu, 5700);
    assert.equal(r.reel, 5000);               /* dernier comptage : session s3 */
    assert.equal(r.ecartReel, -700);
    assert.equal(r.sommeEcarts, -2200);       /* ≠ écart réel : la chaîne est rompue à l'ouverture de s3 */
    assert.equal(r.attenteSorties, 900);
    assert.equal(r.attenteEntrees, 0);
    assert.equal(r.nbSessions, 3);
  } finally { await app.fermer(); }
});

test('rapprochement : les ruptures de chaîne (fond ≠ dernier comptage) sont listées', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function (f) { eval('(' + f + ')')(); return caisseCalculerRapprochement('c1').ruptures; }, amorcer.toString());
    assert.equal(r.length, 1);
    assert.equal(r[0].diff, 1500);            /* s3 ouverte à 5 000 alors que s2 s'est terminée sur 3 500 */
    assert.equal(r[0].fond, 5000);
    assert.equal(r[0].precedent, 3500);
  } finally { await app.fermer(); }
});

test('rapprochement : l\'écran s\'affiche (lecture seule) et une caisse sans session clôturée est signalée', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(function (f) {
      eval('(' + f + ')')();
      DATA.caisses.push({ id: 'c9', nom: 'CAISSE VIDE' });
      caisseRapprochement();
      return { texte: document.getElementById('crp-contenu').textContent.replace(/\s+/g, ' '), nbSessions: DATA.caisse_sessions.length };
    }, amorcer.toString());
    assert.match(r.texte, /Écart réel cumulé/);
    assert.match(r.texte, /-700 FCFA/);
    assert.match(r.texte, /Ruptures de chaîne/);
    assert.match(r.texte, /CAISSE VIDE/);
    assert.match(r.texte, /Aucune session clôturée/);
    assert.equal(r.nbSessions, 4);            /* rien n'a été modifié */
  } finally { await app.fermer(); }
});
