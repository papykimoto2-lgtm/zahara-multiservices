/* Espace souscripteur : nom et contacts des intervenants, uniquement si la mission est partagée, envoyée et non annulée. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
const fs = require('node:fs');
const path = require('node:path');
after(fermerNavigateur);
const lire = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('ERP : partage réservé au titre individuel, journalisé, case dans la mission', async () => {
  const app = await ouvrirApp();
  const r = await app.page.evaluate(async () => {
    DATA.params.fc_titre_solde_requis = false;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }];
    DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1', statut: 'tf_definitif' }];
    DATA.lots = [{ id: 'l1', numero: 'L1', parcelle_id: 'p1' }];
    DATA.clients = [{ id: 'c1', nom: 'A', lot_id: 'l1' }];
    DATA.users = [{ id: 'u1', nom: 'R', login: 'r' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'u1', nom: 'R', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
    const g = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    const ind = (await fcOuvrirDossierIndividuel({ lot_id: 'l1', forcer: true, motif_derogation: 'test' })).dossier;
    const iv = (await fcEnregistrerIntervenant({ nom_organisation: 'Étude Kouassi', type: 'notaire', contact_nom: 'Me Kouassi', telephone: '0102030405', email: 'n@etude.ci' })).intervenant;
    const mk = async (d) => (await fcCreerMission({ dossier_id: d.id, intervenant_id: iv.id, titre: 'Rédaction acte', livrables: ['Acte'], echeance: '2026-12-31' })).mission;
    const mg = await mk(g), mi = await mk(ind);
    const refus = await fcPartagerMissionSouscripteur(mg.id, true);
    const ok = await fcPartagerMissionSouscripteur(mi.id, true);
    fcRenderMissionDetail(mi.id);
    // fcRenderMissionDetail a besoin de #fi-detail
    return { refus: refus.erreur, ok: ok.ok, flag: mi.partage_souscripteur, evt: DATA.evenements_fonciers.filter(e => e.type === 'partage_souscripteur').length };
  });
  assert.match(r.refus, /titre individuel/); assert.equal(r.ok, true); assert.equal(r.flag, true); assert.equal(r.evt, 1);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('SQL : intervenants filtrés (partagé, ni brouillon ni annulée, intervenant actif, titre individuel)', () => {
  const sql = lire('supabase/foncier_connect_portail.sql');
  const bloc = sql.slice(sql.indexOf("'intervenants'"));
  assert.match(bloc, /partage_souscripteur/); assert.match(bloc, /not in \('brouillon', 'annulee'\)/);
  assert.match(bloc, /statut_relation[^\n]*'actif'/); assert.match(bloc, /niveau' = 'individuel'/);
  assert.ok(!/reference_professionnelle/.test(bloc), 'référence professionnelle non exposée');
});

test('portail : carte « Vos interlocuteurs » avec liens tel: et mailto:', () => {
  const html = lire('portail-unique.html');
  const m = html.match(/function blocSuiviTitre\(\)\{[\s\S]*?\n  \}\n\n  function sProgNom/)[0].replace(/function sProgNom$/, '');
  const S = { suivi: { dossiers: [{ libelle_niveau: 'Votre titre individuel — lot L1', intervenants: [{ organisation: 'Étude <b>K</b>', role: 'Notaire', contact: 'Me K', telephone: '+225 01 02', email: 'n@e.ci', missions: ['Acte'] }], etapes: [] }], demandes: [] } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const out = new Function('S', 'esc', 'dshort', 'friseEtapes', m + '; return blocSuiviTitre();')(S, esc, (s) => s, () => '');
  assert.match(out, /Vos interlocuteurs/); assert.match(out, /href="tel:\+2250102"/); assert.match(out, /mailto:n@e\.ci/);
  assert.ok(!/<b>K<\/b>/.test(out), 'échappement');
});
