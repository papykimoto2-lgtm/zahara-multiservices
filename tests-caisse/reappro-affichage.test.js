/* Réapprovisionnement : À traiter / Historique, bandeau de synthèse, retard de service, détail repliable, annulation. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

test('réappro : onglets, tuiles, retard, détail, arborescence de l\'historique, annulation motivée', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(async () => {
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; APP._reapOnglet = null; APP._reapFiltre = null; APP._reapOuvert = {}; APP._caArbo = {};
      const il = n => new Date(Date.now() - n * 86400000).toISOString(), mois = new Date().toISOString().slice(0, 7);
      DATA.caisses = [{ id: 'c1', nom: 'Caisse A' }, { id: 'c2', nom: 'Caisse B' }];
      DATA.demandes_reappro = [
        { id: 'b1', numero: 'R-B1', statut: 'brouillon', caisse_id: 'c1', montant_demande: 1000, demande_le: il(1) },
        { id: 's1', numero: 'R-S1', statut: 'soumise', caisse_id: 'c1', montant_demande: 50000, demande_le: il(2), motif: 'Achat fournitures de bureau pour le trimestre' },
        { id: 'v1', numero: 'R-V1', statut: 'validee', caisse_id: 'c2', montant_demande: 30000, montant_accorde: 20000, demande_le: il(20), valide_le: il(15), valide_par: 'DG' },
        { id: 'v2', numero: 'R-V2', statut: 'validee', caisse_id: 'c1', montant_demande: 10000, montant_accorde: 10000, demande_le: il(3), valide_le: il(2) },
        { id: 'h1', numero: 'R-H1', statut: 'servie', caisse_id: 'c1', montant_demande: 40000, montant_accorde: 40000, demande_le: mois + '-01T08:00:00Z', servi_le: new Date().toISOString(), servi_par: 'Trésorier', provenance_externe: 'Banque' },
        { id: 'h2', numero: 'R-H2', statut: 'rejetee', caisse_id: 'c2', montant_demande: 5000, demande_le: '2026-09-02T08:00:00Z', motif_rejet: 'Non justifié' }];
      document.getElementById('caisse-reappro-box') || document.body.insertAdjacentHTML('beforeend', '<div id="caisse-reappro-box"></div>');
      const box = document.getElementById('caisse-reappro-box'), o = {};
      const lignes = () => [...box.querySelectorAll('tr[data-reap]')].map(t => t.dataset.reap);
      reapRender();
      o.onglets = [...box.querySelectorAll('[data-reap-onglet]')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      o.tuiles = [...box.querySelectorAll('[data-reap-tuile]')].map(b => b.dataset.reapTuile + ':' + b.textContent.replace(/\D/g, ''));
      o.ordre = lignes();
      o.retard = [!!box.querySelector('tr[data-reap="v1"]').style.background, /il y a 15 j/.test(box.querySelector('tr[data-reap="v1"]').textContent), !box.querySelector('tr[data-reap="v2"]').style.background];
      o.montant = /30\s000 F → 20\s000 F/.test(box.querySelector('tr[data-reap="v1"]').textContent);
      box.querySelector('[data-reap-tuile="retard"]').click(); o.filtreRetard = lignes();
      box.querySelector('[data-reap-tuile="soumise"]').click(); o.filtreSoumise = lignes();
      reapBasculeDetail('s1'); o.detail = /Achat fournitures/.test((box.querySelector('[data-reap-detail="s1"]') || {}).textContent || '');
      box.querySelector('[data-reap-onglet="histo"]').click();
      o.histo = [lignes().sort().join(','), !!box.querySelector('[data-caarbo="reap"]'), box.querySelectorAll('[data-caarbo="reap"] > details').length];
      const p = window.prompt; window.prompt = () => ''; await reapAnnuler('v1'); o.sansMotif = DATA.demandes_reappro[2].statut;
      window.prompt = () => 'Fonds remis hors logiciel'; await reapAnnuler('v1'); window.prompt = p;
      o.annule = [DATA.demandes_reappro[2].statut, DATA.demandes_reappro[2].motif_annulation, DATA.demandes_reappro[2].annule_par];
      await reapAnnuler('s1'); o.annuleSoumise = DATA.demandes_reappro[1].statut;
      reapOnglet('traiter'); o.apres = lignes();
      return o;
    });
    assert.deepEqual(r.onglets, ['⏳ À traiter 4', '📁 Historique 2']);
    assert.deepEqual(r.tuiles, ['soumise:500001', 'validee:300002', 'retard:7200001', 'histo:400001']);
    assert.deepEqual(r.ordre, ['s1', 'v1', 'v2', 'b1']);
    assert.deepEqual(r.retard, [true, true, true]);
    assert.equal(r.montant, true);
    assert.deepEqual(r.filtreRetard, ['v1']);
    assert.deepEqual(r.filtreSoumise, ['s1']);
    assert.equal(r.detail, true);
    assert.deepEqual(r.histo, ['h1,h2', true, 2]);
    assert.equal(r.sansMotif, 'validee');
    assert.deepEqual(r.annule, ['annulee', 'Fonds remis hors logiciel', 'Directeur']);
    assert.equal(r.annuleSoumise, 'soumise');
    assert.deepEqual(r.apres, ['s1', 'v2', 'b1']);
    assert.deepEqual(app.etat.erreursPage, []);
  } finally { await app.fermer(); }
});

test('réappro : « servie » dont les bons ne sont pas validés signale que les fonds ne sont pas effectifs', async () => {
  const app = await ouvrirApp();
  try {
    const r = await app.page.evaluate(() => {
      APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' }; APP._reapOnglet = 'histo'; APP._reapFiltre = null; APP._reapOuvert = {}; APP._caArbo = {};
      DATA.caisses = [{ id: 'c1', nom: 'A' }, { id: 'c2', nom: 'B' }];
      DATA.caisse_mouvements = [
        { id: 'e1', requiert_validation: true, valide: false }, { id: 's1', requiert_validation: true, valide: false },
        { id: 'e2', requiert_validation: true, valide: true }, { id: 's2', requiert_validation: true, valide: true }];
      const base = { statut: 'servie', caisse_id: 'c1', montant_demande: 1000, servi_le: new Date().toISOString(), demande_le: new Date().toISOString() };
      DATA.demandes_reappro = [
        Object.assign({ id: 'a', numero: 'R-A', mouvement_id: 'e1', mouvement_source_id: 's1' }, base),
        Object.assign({ id: 'b', numero: 'R-B', mouvement_id: 'e2', mouvement_source_id: 's2' }, base)];
      document.getElementById('caisse-reappro-box') || document.body.insertAdjacentHTML('beforeend', '<div id="caisse-reappro-box"></div>');
      reapRender();
      const box = document.getElementById('caisse-reappro-box');
      return [reapEtatFonds(DATA.demandes_reappro[0]), reapEtatFonds(DATA.demandes_reappro[1]),
        /bons à valider/.test(box.querySelector('tr[data-reap="a"]').textContent), /bons à valider/.test(box.querySelector('tr[data-reap="b"]').textContent)];
    });
    assert.deepEqual(r, ['attente', 'effectif', true, false]);
  } finally { await app.fermer(); }
});
