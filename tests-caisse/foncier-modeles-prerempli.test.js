/* Modèles de dossier préremplis (délais indicatifs + responsables par défaut), proposés à l'ouverture d'un dossier. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, users) {
  await page.evaluate(async (users) => {
    DATA.params.fc_modeles = {}; DATA.params.fc_delais_auto = false;
    DATA.programmes = [{ id: 'g1', nom: 'Prog' }];
    DATA.parcelles = [{ id: 'p1', ref: 'P1', programme_id: 'g1' }];
    DATA.lots = []; DATA.clients = [];
    DATA.users = users || [{ id: 'u1', nom: 'Resp', login: 'r', role: 'service_foncier' }];
    window.userPeutSurStore = () => true; APP.currentUser = { id: 'u1', nom: 'Resp', role: 'admin' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers', 'missions_foncieres', 'intervenants_fonciers'].forEach(s => { DATA[s] = []; });
    window.syncToSupabase = () => {};
  }, users || null);
}

test('chaque étape de chaque procédure a un délai indicatif', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const manquants = await app.page.evaluate(() => {
    const m = [];
    Object.keys(FC_PROCEDURES).forEach(t => fcEtapesPour(t, '').forEach(e => { if (!(FC_DELAIS_DEFAUT[e.code] > 0)) m.push(t + ':' + e.code); }));
    return m;
  });
  assert.deepEqual(manquants, []);
});

test('modèle par défaut : délais pour toutes les étapes ; responsable par rôle seulement si un seul utilisateur', async () => {
  const app = await ouvrirApp();
  await preparer(app.page, [{ id: 'u1', nom: 'Resp', login: 'r', role: 'service_foncier' }, { id: 'c1', nom: 'Compta', login: 'c', role: 'comptable' }]);
  const r1 = await app.page.evaluate(() => { const m = fcModeleParDefaut('acd'); return { n: Object.keys(m.etapes).length, nb: fcEtapesPour('acd', '').length, frais: m.etapes.ind_droits_frais, ctl: m.etapes.controle_pieces, defaut: m.defaut }; });
  assert.equal(r1.n, r1.nb); assert.equal(r1.defaut, true); assert.equal(r1.ctl.responsable_id, 'u1');
  await app.page.evaluate(() => { DATA.users.push({ id: 'c2', nom: 'Compta 2', login: 'c2', role: 'comptable' }); });
  const r2 = await app.page.evaluate(() => fcModeleParDefaut('acd').etapes.enregistrement_publicite);
  assert.equal(r2.responsable_id, '', 'deux comptables : pas d\'affectation arbitraire');
});

test('ouverture avec modèle_defaut : échéances cumulées et journal ; sans option ou sans_modele : aucune échéance', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    const a = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', modele_defaut: true })).dossier;
    const b = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', forcer: true })).dossier;
    const c = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', forcer: true, modele_defaut: true, sans_modele: true })).dossier;
    const total = fcEtapesPour('acd', '').reduce((s, e) => s + FC_DELAIS_DEFAUT[e.code], 0);
    return { avecDates: a.etapes.filter(e => e.date_cible).length, n: a.etapes.length, derniere: a.etapes[a.etapes.length - 1].date_cible, attendue: fcAjouterJours(a.date_ouverture, total), cible: a.date_cible,
             sans: b.etapes.filter(e => e.date_cible).length, sansModele: c.etapes.filter(e => e.date_cible).length,
             evt: DATA.evenements_fonciers.filter(e => e.type === 'modele' && /indicatifs/.test(e.description)).length };
  });
  assert.equal(r.avecDates, r.n); assert.equal(r.derniere, r.attendue); assert.equal(r.cible, r.attendue);
  assert.equal(r.sans, 0, 'comportement historique inchangé sans l\'option'); assert.equal(r.sansModele, 0); assert.equal(r.evt, 1);
});

test('un modèle enregistré prime sur les valeurs indicatives', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    DATA.params.fc_modeles = { acd: { actif: true, etapes: { creation_dossier: { jours: 2, responsable_id: '' } } } };
    const d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1', modele_defaut: true })).dossier;
    return { dates: d.etapes.filter(e => e.date_cible).length, premiere: d.etapes[0].date_cible, attendue: fcAjouterJours(d.date_ouverture, 2), apercu: fcApercuModele('acd').source };
  });
  assert.equal(r.dates, 1); assert.equal(r.premiere, r.attendue); assert.equal(r.apercu, 'enregistre');
});

test('interface : aperçu à l\'ouverture (mis à jour au changement de procédure) et écran Modèles prérempli', async () => {
  const app = await ouvrirApp(); await preparer(app.page);
  const r = await app.page.evaluate(async () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="page-foncier-portefeuille"></div><div id="fm-root"></div>');
    const html = fcApercuModeleHtml('acd'); const urb = fcApercuModeleHtml('immatriculation_urbaine');
    document.body.insertAdjacentHTML('beforeend', '<div id="fc-n-modele-info"></div><select id="fc-n-type"><option value="acd">a</option><option value="immatriculation_urbaine">u</option></select>');
    const sel = document.getElementById('fc-n-type'); sel.value = 'immatriculation_urbaine'; fcTypeChange(sel);
    const maj = document.getElementById('fc-n-modele-info').innerHTML;
    APP._fmType = 'acd'; fcRenderModeles();
    const banniere = /Aucun modèle enregistré/.test(document.getElementById('fm-root').innerHTML), j = document.getElementById('fm-j-depot').value, btn = /Préremplir les champs vides/.test(document.getElementById('fm-root').innerHTML);
    document.getElementById('fm-j-depot').value = ''; fcPrerempliModeleUI(); const apres = document.getElementById('fm-j-depot').value;
    return { html, urb, maj, banniere, j, btn, apres };
  });
  assert.match(r.html, /Délais indicatifs/); assert.match(r.html, /échéance finale estimée/); assert.notEqual(r.html, r.urb);
  assert.equal(r.maj, r.urb); assert.ok(r.banniere); assert.equal(r.j, '3'); assert.ok(r.btn); assert.equal(r.apres, '3');
  assert.deepEqual(app.etat.erreursPage, []);
});
