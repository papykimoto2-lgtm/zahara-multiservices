/* Foncier Connect — phase 4 : notifications, échéances, relances (cahier §10, RM-10, RM-11). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, opts) {
  return page.evaluate(async function (opts) {
    DATA.programmes = [{ id: 'g1', nom: 'Résidence Les Palmiers' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1', localisation: 'Bingerville', programme_id: 'g1' }];
    DATA.lots = [{ id: 'l1', parcelle_id: 'p1' }];
    DATA.clients = [{ id: 'c1', nom: 'Aminata Koné', lot_id: 'l1', email: 'aminata@exemple.ci' }, { id: 'c2', nom: 'Sans courriel', lot_id: 'l1' }];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf', email: 'resp@exemple.ci', role: 'foncier' }, { id: 'u2', nom: 'Agent', login: 'ag', role: 'foncier' }, { id: 'u3', nom: 'Directeur', login: 'dir', role: 'admin', email: 'dir@exemple.ci' }];
    DATA.params = Object.assign(DATA.params || {}, { fc_relances: undefined, fc_canaux: undefined, fc_escalade_user_id: undefined });
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u2', nom: 'Agent', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'intervenants_fonciers', 'missions_foncieres', 'publications_foncieres', 'demandes_fonciers', 'notifications_foncieres'].forEach(function (s) { DATA[s] = []; });
    window.__sync = 0; window.syncToSupabase = function () { window.__sync++; };
    window.__emailOriginal = window.__emailOriginal || FC_FOURNISSEURS.email; window.__envoyes = []; FC_FOURNISSEURS.email = async function (n) { window.__envoyes.push(n.adresse + '|' + n.titre); return true; };
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var iv = (await fcEnregistrerIntervenant({ nom_organisation: 'Cabinet Géo', type: 'geometre', email: 'geo@exemple.ci', telephone: '+225 07 00 00 00 00' })).intervenant;
    return { d: d.id, iv: iv.id };
  }, opts || null);
}
const notifs = (page, filtre) => page.evaluate(function (f) { return DATA.notifications_foncieres.filter(function (n) { return !f || (f.canal ? n.canal === f.canal : true) && (f.dest ? n.destinataire_id === f.dest : true) && (f.titre ? n.titre.indexOf(f.titre) !== -1 : true); }).map(function (n) { return { canal: n.canal, dest: n.destinataire_id, titre: n.titre, statut: n.delivery_status, message: n.message, adresse: n.adresse }; }); }, filtre || null);

test('un événement notifie le responsable dans ImmoSuite ; l\'auteur n\'est pas notifié de ses propres actes', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const n = await notifs(app.page, { canal: 'interne', dest: 'u1', titre: 'Dossier ouvert' });
  assert.equal(n.length, 1); assert.equal(n[0].statut, 'livree'); assert.match(n[0].message, /DF-\d{4}-001/);
  await app.page.evaluate(async function () { APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' }; await fcChangerStatutEtape(fcDossier(DATA.dossiers_fonciers[0].id).id, 'creation_dossier', 'termine', {}); });
  assert.equal((await notifs(app.page, { dest: 'u1', titre: 'Étape terminée' })).length, 0);
  assert.deepEqual(app.etat.erreursPage, []); assert.ok(ids.d);
});

test('un blocage est urgent : notifié même à son auteur, aussi par e-mail', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await app.page.evaluate(async function (id) { APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' }; await fcChangerStatutEtape(id, 'creation_dossier', 'bloque', { motif: 'litige' }); }, ids.d);
  const n = await notifs(app.page, { dest: 'u1', titre: 'Étape bloquée' });
  assert.deepEqual(n.map(function (x) { return x.canal; }).sort(), ['email', 'interne']);
});

test('prévention des doublons : même événement, même destinataire, même canal = une seule notification', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    var avant = DATA.notifications_foncieres.length, d = fcDossier(id), e = DATA.evenements_fonciers[0];
    await fcNotifierEvenement(d, e); await fcNotifierEvenement(d, e);
    var rat = await fcRattraperNotifications();
    return { avant: avant, apres: DATA.notifications_foncieres.length, rat: rat };
  }, ids.d);
  assert.equal(r.avant, r.apres); assert.equal(r.rat, 0);
});

test('RM-10 : une notification qui échoue n\'annule pas l\'opération ; elle est rattrapée ensuite', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    var original = fcCreerNotification; var avant = DATA.notifications_foncieres.length;
    window.fcCreerNotification = async function () { throw new Error('panne de la file'); };
    var op = await fcChangerStatutEtape(id, 'creation_dossier', 'bloque', { motif: 'pièce illisible' });
    var evBloque = DATA.evenements_fonciers.filter(function (e) { return e.type === 'changement_statut'; }).length;
    var manque = DATA.notifications_foncieres.length === avant;
    window.fcCreerNotification = original;
    var rat = await fcRattraperNotifications();
    return { op: op, evBloque: evBloque, manque: manque, rat: rat, statut: fcEtape(fcDossier(id), 'creation_dossier').statut, ap: DATA.notifications_foncieres.filter(function (n) { return n.titre === 'Étape bloquée'; }).length };
  }, ids.d);
  assert.equal(r.op.ok, true); assert.equal(r.evBloque, 1); assert.equal(r.manque, true); assert.equal(r.statut, 'bloque');
  assert.ok(r.rat >= 1); assert.ok(r.ap >= 1);
});

test('mission envoyée : l\'intervenant est prévenu par e-mail sans aucune donnée interne du dossier', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await app.page.evaluate(async function (a) {
    DATA.dossiers_fonciers[0].observations = 'NOTE INTERNE CONFIDENTIELLE';
    var m = (await fcCreerMission({ dossier_id: a.d, intervenant_id: a.iv, titre: 'Bornage', livrables: ['Plan de bornage'], echeance: '2999-01-01' })).mission;
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    await fcChangerStatutMission(m.id, 'envoyee');
  }, ids);
  const ext = await notifs(app.page, { canal: 'email', dest: ids.iv });
  assert.equal(ext.length, 1); assert.equal(ext[0].adresse, 'geo@exemple.ci'); assert.match(ext[0].message, /MF-\d{4}-001/); assert.match(ext[0].message, /Plan de bornage/);
  assert.equal(/DF-\d{4}|PARC-1|Bingerville|INTERNE|Palmiers/.test(JSON.stringify(ext)), false);
});

test('publication : le souscripteur est prévenu par e-mail avec le seul titre public ; sans e-mail, rien n\'est envoyé', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await app.page.evaluate(async function (id) {
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    fcEtape(fcDossier(id), 'depot').observations = 'SECRET INTERNE';
    await fcPublierInformation(id, 'depot', { libelle: 'Dossier déposé', source: 'promoteur' });
  }, ids.d);
  const c1 = await notifs(app.page, { canal: 'email', dest: 'c1' }), c2 = await notifs(app.page, { dest: 'c2' });
  assert.equal(c1.length, 1); assert.match(c1[0].message, /Dossier déposé/); assert.equal(/SECRET|DF-\d{4}|PARC-1/.test(JSON.stringify(c1)), false);
  assert.equal(c2.length, 0);
});

test('SMS et WhatsApp : sans fournisseur, jamais « envoyée » ; avec un fournisseur branché, envoi réel', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (a) {
    DATA.params.fc_canaux = { sms: true, whatsapp: true };
    var m = (await fcCreerMission({ dossier_id: a.d, intervenant_id: a.iv, titre: 'T1', livrables: ['L'], echeance: '2999-01-01' })).mission;
    await fcChangerStatutMission(m.id, 'envoyee');
    var sans = DATA.notifications_foncieres.filter(function (n) { return n.canal === 'sms' || n.canal === 'whatsapp'; }).map(function (n) { return n.canal + ':' + n.delivery_status; });
    var tel = []; FC_FOURNISSEURS.sms = async function (n) { tel.push(n.adresse); return true; };
    var m2 = (await fcCreerMission({ dossier_id: a.d, intervenant_id: a.iv, titre: 'T2', livrables: ['L'], echeance: '2999-01-01' })).mission;
    await fcChangerStatutMission(m2.id, 'envoyee'); await fcTraiterFile();
    var apres = DATA.notifications_foncieres.filter(function (n) { return n.canal === 'sms' && n.titre.indexOf('T2') !== -1; }).map(function (n) { return n.delivery_status; });
    FC_FOURNISSEURS.sms = null;
    return { sans: sans.sort(), tel: tel, apres: apres };
  }, ids);
  assert.deepEqual(r.sans, ['sms:non_disponible', 'whatsapp:non_disponible']); assert.deepEqual(r.tel, ['+225 07 00 00 00 00']); assert.deepEqual(r.apres, ['envoyee']);
});

test('file e-mail : tentatives espacées, abandon après 3 échecs, relance possible, reprise après incident', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    FC_FOURNISSEURS.email = async function () { throw new Error('serveur de messagerie injoignable'); };
    await fcChangerStatutEtape(id, 'creation_dossier', 'bloque', { motif: 'x' });
    var n = DATA.notifications_foncieres.find(function (x) { return x.canal === 'email'; });
    var t0 = new Date().toISOString(), out = [];
    await fcTraiterFile(t0); out.push([n.delivery_status, n.attempt_count, n.scheduled_at > t0]);
    await fcTraiterFile(t0); out.push([n.delivery_status, n.attempt_count]);
    var t1 = new Date(Date.now() + 3 * 3600000).toISOString(); await fcTraiterFile(t1); out.push([n.delivery_status, n.attempt_count]);
    var t2 = new Date(Date.now() + 6 * 3600000).toISOString(); await fcTraiterFile(t2); out.push([n.delivery_status, n.attempt_count, n.error_message]);
    var envoyes = []; FC_FOURNISSEURS.email = async function (x) { envoyes.push(x.id); return true; };
    var rel = await fcRelancerEchecs(); out.push([n.delivery_status, n.attempt_count, rel.relancees]);
    n.delivery_status = 'envoi_en_cours'; n.scheduled_at = new Date(Date.now() - 20 * 60000).toISOString();
    var rep = await fcTraiterFile(); out.push([n.delivery_status, rep.reprises]);
    return out;
  }, ids.d);
  assert.deepEqual(r[0], ['echec', 1, true]); assert.deepEqual(r[1], ['echec', 1]);
  assert.deepEqual(r[2], ['echec', 2]); assert.equal(r[3][0], 'abandonnee'); assert.equal(r[3][1], 3); assert.match(r[3][2], /injoignable/);
  assert.deepEqual(r[4], ['envoyee', 1, 1]); assert.deepEqual(r[5], ['envoyee', 1]);
});

test('EmailJS non configuré : « canal non disponible », sans consommer de tentative ni se faire passer pour envoyé', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    FC_FOURNISSEURS.email = Object.getPrototypeOf(function () {}) && (function () { var p = DATA.params; return function (n) { var e = new Error('EmailJS n\'est pas configuré'); e.nonConfigure = true; throw e; }; })();
    await fcChangerStatutEtape(id, 'creation_dossier', 'bloque', { motif: 'x' }); await fcTraiterFile();
    var n = DATA.notifications_foncieres.find(function (x) { return x.canal === 'email'; });
    return { s: n.delivery_status, t: n.attempt_count, e: n.error_message };
  }, ids.d);
  assert.equal(r.s, 'non_disponible'); assert.equal(r.t, 0); assert.match(r.e, /configuré/);
});

test('échéance interne : avant (3 puis 1 jour), le jour même, après (1 puis 7 jours), escalade à 14 jours', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(function (id) {
    fcEtape(fcDossier(id), 'depot').date_cible = '2026-10-20';
    var a = function (t) { var x = fcAnalyserEcheances(t).filter(function (y) { return y.etape_code === 'depot'; })[0]; return x ? x.niveau + ':' + x.seuil : null; };
    return ['2026-10-10', '2026-10-17', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-25', '2026-10-27', '2026-11-03', '2026-11-10'].map(a);
  }, ids.d);
  assert.deepEqual(r, [null, 'avant:3', 'avant:1', 'jour:0', 'apres:1', 'apres:1', 'apres:7', 'escalade:14', 'escalade:14']);
});

test('délai administratif : règles propres, jamais d\'escalade, formulation neutre (RM-11)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    var e = fcEtape(fcDossier(id), 'depot'); e.date_cible = '2026-10-01';
    await fcChangerStatutEtape(id, 'depot', 'attente_administration', {});
    var a = function (t) { var x = fcAnalyserEcheances(t).filter(function (y) { return y.etape_code === 'depot'; })[0]; return x ? x.type + ':' + x.niveau + ':' + x.seuil : null; };
    var res = ['2026-09-28', '2026-10-01', '2026-10-05', '2026-10-09', '2026-10-31', '2026-12-31'].map(a);
    var g = await fcGenererAlertes('2026-10-09');
    var n = DATA.notifications_foncieres.filter(function (x) { return x.template_code === 'echeance_apres' && x.canal === 'interne'; })[0];
    return { res: res, msg: n && n.message, titre: n && n.titre, esc: DATA.notifications_foncieres.filter(function (x) { return x.template_code === 'echeance_escalade'; }).length };
  }, ids.d);
  assert.deepEqual(r.res, [null, null, null, 'administratif:apres:7', 'administratif:apres:30', 'administratif:apres:30']);
  assert.equal(r.titre, 'Délai administratif dépassé'); assert.match(r.msg, /ni un rejet ni une faute/); assert.equal(r.esc, 0);
});

test('génération : une seule notification par seuil franchi et par date d\'échéance ; seuil le plus urgent seulement', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    fcEtape(fcDossier(id), 'depot').date_cible = '2026-10-01';
    var n0 = DATA.notifications_foncieres.length;
    var g1 = await fcGenererAlertes('2026-10-10');  /* 9 jours de retard : seuil 7 seulement, pas 1 */
    var n1 = DATA.notifications_foncieres.filter(function (n) { return n.template_code === 'echeance_apres'; });
    var g2 = await fcGenererAlertes('2026-10-10'); var g3 = await fcGenererAlertes('2026-10-11');
    var n2 = DATA.notifications_foncieres.filter(function (n) { return n.template_code === 'echeance_apres'; }).length;
    fcEtape(fcDossier(id), 'depot').date_cible = '2026-10-20';  /* nouvelle échéance : le compteur repart */
    var g4 = await fcGenererAlertes('2026-10-19');
    return { c1: g1.creees, seuils: n1.map(function (n) { return n.dedup; }), g2: g2.creees, g3: g3.creees, n2: n2, g4: g4.creees > 0, base: n0 };
  }, ids.d);
  assert.ok(r.c1 >= 1); assert.equal(r.seuils.every(function (k) { return /apres7/.test(k); }), true);
  assert.equal(r.g2, 0); assert.equal(r.g3, 0); assert.equal(r.g4, true);
});

test('escalade : la hiérarchie est prévenue pour une échéance interne, jamais pour un délai administratif', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    fcEtape(fcDossier(id), 'depot').date_cible = '2026-09-01';
    await fcGenererAlertes('2026-10-13');
    var vers = DATA.notifications_foncieres.filter(function (n) { return n.template_code === 'echeance_escalade' && n.canal === 'interne'; }).map(function (n) { return n.destinataire_id; }).sort();
    DATA.params.fc_escalade_user_id = 'u2'; fcEtape(fcDossier(id), 'completude_documents').date_cible = '2026-09-01';
    await fcGenererAlertes('2026-10-13');
    return vers;
  }, ids.d);
  assert.deepEqual(r, ['u1', 'u3']);
});

test('mission : rappel d\'échéance à l\'intervenant et au responsable', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (a) {
    var m = (await fcCreerMission({ dossier_id: a.d, intervenant_id: a.iv, titre: 'Bornage', livrables: ['Plan'], echeance: '2026-10-15' })).mission;
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    await fcChangerStatutMission(m.id, 'envoyee');
    var avant = DATA.notifications_foncieres.length;
    await fcGenererAlertes('2026-10-13');
    return DATA.notifications_foncieres.slice(avant).map(function (n) { return n.destinataire_id + ':' + n.canal + ':' + n.titre; }).sort();
  }, ids);
  assert.ok(r.some(function (x) { return /u1:interne:Échéance proche/.test(x); })); assert.ok(r.some(function (x) { return new RegExp(ids.iv + ':email:Rappel d\'échéance de mission').test(x); }));
});

test('règles de relance configurables', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(function (id) {
    fcEtape(fcDossier(id), 'depot').date_cible = '2026-10-20';
    DATA.params.fc_relances = { interne: { avant: [10], jour: false, apres: [3], escalade_apres: 0 } };
    var a = function (t) { var x = fcAnalyserEcheances(t).filter(function (y) { return y.etape_code === 'depot'; })[0]; return x ? x.niveau + ':' + x.seuil : null; };
    return [a('2026-10-12'), a('2026-10-20'), a('2026-10-24'), a('2026-12-01')];
  }, ids.d);
  assert.deepEqual(r, ['avant:10', null, 'apres:3', 'apres:3']);
});

test('lecture : seul le destinataire (ou un administrateur) marque une notification lue ; compteur de non lues', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function () {
    var n = DATA.notifications_foncieres.find(function (x) { return x.canal === 'interne' && x.destinataire_id === 'u1'; });
    var avant = fcNotifNonLues('u1');
    APP.currentUser = { id: 'u2', nom: 'Agent', role: 'foncier' };
    var refus = await fcMarquerLue(n.id);
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    var ok = await fcMarquerLue(n.id);
    return { avant: avant, refus: refus, ok: ok, apres: fcNotifNonLues('u1') };
  });
  assert.ok(r.avant >= 1); assert.equal(r.refus.ok, false); assert.equal(r.ok.ok, true); assert.equal(r.apres, r.avant - 1); assert.ok(ids.d);
});

test('cycle, interface, store local et aucune synchronisation cloud', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    fcEtape(fcDossier(id), 'depot').date_cible = '2026-01-01';
    var cycle = await fcCycleNotifications();
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    fcRenderNotifications(); fcMajBadgeNotif();
    return {
      cycle: !!(cycle && cycle.alertes && cycle.file), html: document.getElementById('fn-root').innerHTML, badge: document.getElementById('fn-badge') ? document.getElementById('fn-badge').textContent : null,
      store: ALL_STORES.indexOf('notifications_foncieres') !== -1 && SANIX_STORES_LOCAL_UNIQUEMENT.indexOf('notifications_foncieres') === -1 && SUPA_STORE_MAP.some(function (p) { return p[1] === 'notifications_foncieres'; }),
      sync: window.__sync, onglet: !!document.getElementById('tab-foncier-notifications')
    };
  }, ids.d);
  assert.equal(r.cycle, true); assert.match(r.html, /Échéance interne dépassée/); assert.match(r.html, /Règles de relance/); assert.ok(Number(r.badge) >= 1);
  assert.equal(r.store, true); assert.equal(r.sync, 0); assert.equal(r.onglet, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('fournisseur e-mail réel sans configuration EmailJS : canal non disponible, aucun envoi simulé', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (id) {
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    FC_FOURNISSEURS.email = window.__emailOriginal; DATA.params.emailjs_service = ''; DATA.params.emailjs_template = ''; DATA.params.emailjs_key = '';
    await fcChangerStatutEtape(id, 'creation_dossier', 'bloque', { motif: 'x' }); await fcTraiterFile();
    var n = DATA.notifications_foncieres.find(function (x) { return x.canal === 'email'; });
    return { s: n.delivery_status, t: n.attempt_count, e: n.error_message };
  }, ids.d);
  assert.equal(r.s, 'non_disponible'); assert.equal(r.t, 0); assert.match(r.e, /EmailJS/);
});
