/* Équipe interne : fonctions par étape, rôles configurables, répartition équilibrée entre plusieurs personnes. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

const USERS = [
  { id: 'dir', nom: 'Directeur', login: 'dir', role: 'admin' },
  { id: 's1', nom: 'Foncier 1', login: 's1', role: 'service_foncier' }, { id: 's2', nom: 'Foncier 2', login: 's2', role: 'service_foncier' },
  { id: 'c1', nom: 'Comptable', login: 'c1', role: 'comptable' }
];
async function preparer(page, users) {
  await page.evaluate(async (users) => {
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false; DATA.params.fc_fonctions_roles = undefined;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }]; DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }]; DATA.lots = []; DATA.clients = [];
    DATA.users = users;
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
  }, users);
}

test('chaque étape de chaque procédure a une fonction qui l\'exécute (fonctions valides)', async () => {
  const app = await ouvrirApp(); await preparer(app.page, USERS);
  const r = await app.page.evaluate(() => {
    const m = [], inv = [];
    Object.keys(FC_PROCEDURES).forEach(t => fcEtapesPour(t, '').forEach(e => {
      const q = FC_EQUIPE_ETAPES[e.code]; if (!q) { m.push(t + ':' + e.code); return; }
      [q[0], q[1]].concat(q[2], q[3]).filter(Boolean).forEach(f => { if (!FC_FONCTIONS[f]) inv.push(e.code + '→' + f); });
    }));
    const exec = {}; Object.keys(FC_EQUIPE_ETAPES).forEach(c => { exec[FC_EQUIPE_ETAPES[c][0]] = 1; });
    return { m, inv, fonctions: Object.keys(exec).sort(), nb: Object.keys(FC_FONCTIONS).length };
  });
  assert.deepEqual(r.m, []); assert.deepEqual(r.inv, []);
  assert.equal(r.fonctions.length, r.nb, 'toutes les fonctions sont sollicitées : aucune personne ne fait tout');
});

test('rôles par fonction : valeurs par défaut et réglage personnalisé', async () => {
  const app = await ouvrirApp(); await preparer(app.page, USERS);
  const r = await app.page.evaluate(async () => {
    const o = { foncier: fcUsersFonction('foncier').map(u => u.id).sort(), finance: fcUsersFonction('finance').map(u => u.id), juridique: fcUsersFonction('juridique').length, direction: fcUsersFonction('direction').map(u => u.id) };
    DATA.params.fc_fonctions_roles = { juridique: ['comptable'] }; o.juridiqueApres = fcUsersFonction('juridique').map(u => u.id);
    return o;
  });
  assert.deepEqual(r.foncier, ['s1', 's2']); assert.deepEqual(r.finance, ['c1']); assert.equal(r.juridique, 0); assert.deepEqual(r.direction, ['dir']); assert.deepEqual(r.juridiqueApres, ['c1']);
});

test('ouverture avec répartition : étapes confiées à la fonction concernée, charge équilibrée, fonctions sans équipe signalées', async () => {
  const app = await ouvrirApp(); await preparer(app.page, USERS);
  const r = await app.page.evaluate(async () => {
    const res = await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir', repartition_auto: true });
    const d = res.dossier, par = {}; d.etapes.forEach(e => { par[e.responsable_id] = (par[e.responsable_id] || 0) + 1; });
    const fin = d.etapes.filter(e => fcEquipeEtape(e.code).exec === 'finance').map(e => e.responsable_id);
    const dirE = d.etapes.filter(e => fcEquipeEtape(e.code).exec === 'direction').map(e => e.responsable_id);
    const sansEquipe = d.etapes.filter(e => ['juridique', 'technique', 'commercial', 'assistance'].indexOf(fcEquipeEtape(e.code).exec) !== -1).map(e => e.responsable_id);
    return { par, fin, sansEquipe, avert: res.avertissements.filter(a => /Aucun utilisateur/.test(a)).length, evt: DATA.evenements_fonciers.filter(e => e.type === 'repartition').length,
             nbFoncier: d.etapes.filter(e => fcEquipeEtape(e.code).exec === 'foncier').length };
  });
  assert.ok(r.fin.length > 0 && r.fin.every(x => x === 'c1'));
  assert.ok(r.sansEquipe.every(x => x === 'dir'), 'sans personne pour la fonction : le responsable du dossier garde l\'étape');
  assert.equal(r.avert, 4, 'juridique, technique, commercial, assistance signalées');
  assert.ok(Math.abs(r.par.s1 - r.par.s2) <= 1 && r.par.s1 > 0, JSON.stringify(r.par)); assert.equal(r.par.s1 + r.par.s2, r.nbFoncier);
  assert.equal(r.evt, 1);
});

test('équilibrage de charge entre dossiers, étape personnalisée respectée, ouverture sans option inchangée', async () => {
  const app = await ouvrirApp(); await preparer(app.page, USERS);
  const r = await app.page.evaluate(async () => {
    const a = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir', repartition_auto: true })).dossier;
    // s1 reçoit une charge supplémentaire : le second dossier doit favoriser s2
    for (let i = 0; i < 6; i++) { const e = a.etapes.filter(x => x.responsable_id === 's2')[i]; if (e) e.responsable_id = 's1'; }
    const b = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir', forcer: true, repartition_auto: true })).dossier;
    const nb = (d, u) => d.etapes.filter(e => e.responsable_id === u).length;
    // étape personnalisée : confiée à un autre que le responsable du dossier, elle n'est pas écrasée
    const c0 = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir', forcer: true })).dossier;
    const sansOption = c0.etapes.every(e => e.responsable_id === 'dir');
    c0.etapes[3].responsable_id = 'c1'; fcRepartirEquipe(c0);
    return { b1: nb(b, 's1'), b2: nb(b, 's2'), perso: c0.etapes[3].responsable_id, sansOption };
  });
  assert.ok(r.b2 > r.b1, 's2 moins chargé : reçoit davantage ' + r.b1 + '/' + r.b2); assert.equal(r.perso, 'c1'); assert.equal(r.sansOption, true);
});

test('interface : panneau Équipe, ligne par étape, répartition manuelle, éditeur des rôles', async () => {
  const app = await ouvrirApp(); await preparer(app.page, USERS);
  const r = await app.page.evaluate(async () => {
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'dir' })).dossier;
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-detail"></div><div id="fm-root"></div>');
    fcRenderDetail(d.id);
    const h = document.getElementById('fc-detail').innerHTML;
    const o = { panneau: /Équipe interne du dossier/.test(h), ligne: /exécute/.test(h), alerte: /Aucun utilisateur n.est rattaché à/.test(h), btn: /Répartir les étapes selon les fonctions/.test(h) };
    const avant = d.etapes.filter(e => e.responsable_id === 's1').length;
    const rep = await fcRepartirEquipeDossier(d.id); o.assignees = rep.assignees > 0; o.apres = fcDossier(d.id).etapes.filter(e => e.responsable_id === 's1').length > avant;
    APP.currentUser = { id: 'x', nom: 'Agent', role: 'foncier' }; const refus = await fcRepartirEquipeDossier(d.id); o.refus = refus.ok === false; APP.currentUser = { id: 'dir', nom: 'Directeur', role: 'admin' };
    APP._fmType = 'acd'; fcRenderModeles(); const m = document.getElementById('fm-root').innerHTML; o.editeur = /Équipe interne — fonctions et rôles/.test(m) && !!document.getElementById('fq-juridique-comptable');
    document.getElementById('fq-juridique-comptable').checked = true; await fcSauverEquipeUI(); o.sauve = DATA.params.fc_fonctions_roles.juridique.slice().sort(); o.pool = fcUsersFonction('juridique').map(u => u.id);
    return o;
  });
  assert.equal(r.panneau, true); assert.equal(r.ligne, true); assert.equal(r.alerte, true); assert.equal(r.btn, true); assert.equal(r.assignees, true); assert.equal(r.apres, true); assert.equal(r.refus, true);
  assert.equal(r.editeur, true); assert.deepEqual(r.sauve, ['comptable', 'juridique']); assert.deepEqual(r.pool, ['c1']);
  assert.deepEqual(app.etat.erreursPage, []);
});
