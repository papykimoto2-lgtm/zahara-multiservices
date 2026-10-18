/* Revue Foncier : dérogations cumulées, dates saisies, modèles sans étapes écartées, solde et résiliation,
   pièces remplacées, ICS, mutations protégées. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('revue foncier : corrections', async () => {
  const app = await ouvrirApp();
  try {
    app.etat.prompts.push('ordre', 'cloture');
    const r = await app.page.evaluate(async () => {
      const o = {};
      o.dates = [fcDateSaisie('18/12/2026'), fcDateSaisie('2026-12-18'), fcDateSaisie('18-12'), fcDateSaisie('')];
      const d = { date_ouverture: '2026-01-01', etapes: [{ code: 'a', ordre: 1, statut: 'a_faire' }, { code: 'b', ordre: 2, statut: 'annule' }, { code: 'c', ordre: 3, statut: 'a_faire' }] };
      const rm = fcAppliquerModele(d, { etapes: { a: { jours: 10 }, b: { jours: 14 }, c: { jours: 5 } } });
      o.modele = [rm.jours, d.etapes[2].date_cible, d.etapes[1].date_cible];
      DATA.params = Object.assign({}, DATA.params, { fc_titre_solde_requis: false });
      window.attSoldeSolde = () => ({ solde: true, totalContrat: 0, verse: 0 });
      o.solde = [fcSoldeLot([{ statut: 'actif' }]).solde, fcSoldeLot([{ statut: 'resilie' }]).solde];
      o.ics = fcIcsEchapper('Bornage ; contre-bornage');
      o.protege = ['fcComptabiliserFraisTitre', 'fcReglerFraisTitre', 'fcEncaisserNoteDebours', 'fcDeposerPieceSouscripteur', 'fcDefinirEcheance'].map(n => !!window[n].__protegee);
      const appels = [];
      const reponses = [{ ok: false, dependance: true, erreur: 'ordre' }, { ok: false, completude: true, erreur: 'complétude' }, { ok: true }];
      window.fcChangerStatutEtape = async (id, code, st, opts) => { appels.push(JSON.parse(JSON.stringify(opts))); return reponses.shift(); };
      window.fcRender = () => {};
      await fcStatutUI('d1', 'cloture', { value: 'termine' });
      o.derog = appels;
      return o;
    });
    assert.deepEqual(r.dates, ['2026-12-18', '2026-12-18', null, '']);
    assert.deepEqual(r.modele, [15, '2026-01-16', undefined]);
    assert.deepEqual(r.solde, [true, false]);
    assert.equal(r.ics, 'Bornage ' + String.fromCharCode(92) + '; contre-bornage');
    assert.deepEqual(r.protege, [true, true, true, true, true]);
    assert.equal(r.derog.length, 3);
    assert.deepEqual(r.derog[2], { motif: 'ordre · cloture', derogation_ordre: true, derogation_completude: true });
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});
