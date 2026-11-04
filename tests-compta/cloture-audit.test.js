const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

/* Clôture / réouverture / FEC : droits, motif obligatoire, journal d'audit, suppression refusée, hiérarchie des exercices. */
function jeu() {
  const v = { valide_le: '2025-12-30T10:00:00.000Z', valide_par: 'T', statut_ecr: 'valide' };
  DATA.ecritures = [E('p1', '2025-03-01', '521', '701', 1000, v), E('p2', '2025-04-01', '601', '521', 200, v)];
  window.__audit = [];
  window.logAction = function (t, d) { window.__audit.push(t + ' | ' + d); };
}

test('clôture : tracée au journal d\'audit', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) { eval('(' + f + ')')(); await cloturerExercice(2025, ''); return window.__audit; }, jeu.toString());
    assert.equal(r.length, 1);
    assert.match(r[0], /^CLOTURE_EXERCICE \| 2025/);
  } finally { await app.fermer(); }
});

test('réouverture : motif de 10 caractères obligatoire, puis tracée avec son motif', async () => {
  const app = await ouvrirApp();
  try {
    app.etat.prompts.push('court', 'Correction d\'une erreur de cut-off');
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      await cloturerExercice(2025, ''); window.__audit = [];
      await rouvrirExercice(2025, '');                      /* motif trop court : refus */
      const clos1 = exerciceEstClos('2025-06-01');
      await rouvrirExercice(2025, '');                      /* motif valide */
      return { clos1, clos2: exerciceEstClos('2025-06-01'), audit: window.__audit };
    }, jeu.toString());
    assert.equal(r.clos1, true);
    assert.equal(r.clos2, false);
    assert.equal(r.audit.length, 1);
    assert.match(r.audit[0], /^REOUVERTURE_EXERCICE \| 2025.*motif : Correction d'une erreur de cut-off/);
  } finally { await app.fermer(); }
});

test('réouverture : une suppression refusée interrompt l\'opération, l\'exercice reste clôturé', async () => {
  const app = await ouvrirApp();
  try {
    app.etat.prompts.push('Correction d\'une erreur de cut-off');
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      await cloturerExercice(2025, '');
      const reel = window.deleteRecord;
      window.deleteRecord = async function () { return false; };
      window.__audit = [];
      await rouvrirExercice(2025, '');
      window.deleteRecord = reel;
      return { clos: exerciceEstClos('2025-06-01'), audit: window.__audit, toasts: window.__toasts.join(' | ') };
    }, jeu.toString());
    assert.equal(r.clos, true);
    assert.match(r.audit[0], /^REOUVERTURE_EXERCICE_ECHEC/);
    assert.match(r.toasts, /Réouverture interrompue/);
  } finally { await app.fermer(); }
});

test('réouverture consolidée refusée tant qu\'un exercice postérieur est clôturé dans une division', async () => {
  const app = await ouvrirApp();
  try {
    app.etat.prompts.push('Correction d\'une erreur de cut-off');
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      await cloturerExercice(2025, '');
      DATA.params['cloture_2026-d1'] = true;
      await rouvrirExercice(2025, '');
      return { clos: exerciceEstClos('2025-06-01'), toasts: window.__toasts.join(' | ') };
    }, jeu.toString());
    assert.equal(r.clos, true);
    assert.match(r.toasts, /Réouverture consolidée refusée/);
  } finally { await app.fermer(); }
});

test('export FEC : droit requis et trace au journal d\'audit', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async function (f) {
      eval('(' + f + ')')();
      const blobs = []; URL.createObjectURL = function (b) { blobs.push(b); return 'blob:x'; }; HTMLAnchorElement.prototype.click = function () {};
      const droit = window.exigerDroit;
      window.exigerDroit = function () { return false; };
      exporterFEC(2025, '');
      const refuse = blobs.length + '/' + window.__audit.length;
      window.exigerDroit = droit;
      exporterFEC(2025, '');
      return { refuse, ok: blobs.length, audit: window.__audit };
    }, jeu.toString());
    assert.equal(r.refuse, '0/0');
    assert.equal(r.ok, 1);
    assert.match(r.audit[0], /^EXPORT_FEC \| 2025 — consolidé/);
  } finally { await app.fermer(); }
});
