/* Portail souscripteur : la vue serveur expose les étapes publiées (sans notes internes) et la frise les affiche. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
const fs = require('node:fs');
const path = require('node:path');
after(fermerNavigateur);

test('fcVueSouscripteur : étapes visibles uniquement, champs limités', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }];
    DATA.parcelles = [{ id: 'p1', ref: 'P1', localisation: 'X', programme_id: 'g1' }];
    DATA.lots = [{ id: 'l1', numero: 'L1', parcelle_id: 'p1' }];
    DATA.clients = [{ id: 'c1', nom: 'A', lot_id: 'l1' }];
    DATA.users = [{ id: 'u1', nom: 'R', login: 'r' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'u1', nom: 'R', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
    const g = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    g.etapes.forEach((e, i) => { e.visibilite = i < 2 ? 'souscripteur' : 'interne'; e.note_interne = 'SECRET'; });
    g.etapes[0].statut = 'termine';
    const v = fcVueSouscripteur('c1').dossiers[0];
    return { n: v.etapes.length, cles: Object.keys(v.etapes[0]).sort().join(','), json: JSON.stringify(v.etapes), st: v.etapes[0].statut };
  });
  assert.equal(r.n, 2); assert.equal(r.st, 'termine');
  assert.equal(r.cles, 'date_cible,libelle,phase,statut');
  assert.ok(!/SECRET/.test(r.json));
  await app.fermer?.();
});

test('portail : friseEtapes rend les phases et repère l\'étape en cours', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'portail-unique.html'), 'utf8');
  const m = html.match(/var FRISE_ST=[\s\S]*?function blocSuiviTitre/)[0].replace(/function blocSuiviTitre$/, '');
  const fn = new Function('esc', 'dshort', m + '; return friseEtapes;')(s => String(s), s => s);
  const out = fn([{ libelle: 'Dépôt', phase: 'C', statut: 'termine' }, { libelle: 'Instruction', phase: 'C', statut: 'attente_administration', date_cible: '2026-12-01' }, { libelle: 'Clôture', phase: 'E', statut: 'a_venir' }]);
  assert.match(out, /Dépôt et instruction/); assert.match(out, /Contrôle et clôture/);
  assert.equal((out.match(/fr-now/g) || []).length, 1);
  assert.match(out, /fr-att fr-now/); assert.match(out, /Chez l'administration · prévue 2026-12-01/);
  assert.equal(fn([]), '');
});
