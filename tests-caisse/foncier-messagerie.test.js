/* Foncier Connect — messagerie de mission (P4) : fil texte seul promoteur ↔ intervenant. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page, statut) {
  return page.evaluate(async function (statut) {
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }, { id: 'u2', nom: 'Agent Foncier', login: 'af', role: 'service_foncier' }, { id: 'u3', nom: 'Compta', login: 'c', role: 'comptable' }];
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1' }];
    window.userPeutSurStore = function () { return true; }; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'admin' }; window.syncToSupabase = function () {};
    DATA.dossiers_fonciers = []; DATA.evenements_fonciers = []; DATA.intervenants_fonciers = []; DATA.missions_foncieres = []; DATA.notifications_foncieres = [];
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    var i = (await fcEnregistrerIntervenant({ nom_organisation: 'Cabinet Géo', type: 'geometre', email: 'geo@x.ci' })).intervenant;
    var m = (await fcCreerMission({ dossier_id: d.id, intervenant_id: i.id, titre: 'Bornage', livrables: ['Plan'], echeance: '2099-12-31', etape_code: 'reception_livrables' })).mission;
    if (statut !== 'brouillon') { await fcChangerStatutMission(m.id, 'envoyee'); }
    if (statut === 'annulee') await fcChangerStatutMission(m.id, 'annulee', { motif: 'x' });
    return { d: d.id, i: i.id, m: m.id };
  }, statut || 'envoyee');
}
/* Ce que fait fc_intervenant_envoyer_message (SQL) : ajoute le message et écrit l'événement au format fcEvenement. */
const portailEnvoie = (page, ids, texte, id) => page.evaluate(function (a) {
  var m = fcMission(a.m), maintenant = new Date().toISOString();
  m.messages = (m.messages || []).concat([{ id: a.id, date: maintenant, de: 'intervenant', auteur: 'Cabinet Géo', texte: a.texte }]); m._modifie = maintenant;
  DATA.evenements_fonciers.push({ id: 'ev' + a.id, dossier_id: m.dossier_id, etape_code: m.etape_code, type: 'message_intervenant', description: m.reference + ' : message de Cabinet Géo',
    ancien: '', nouveau: '', source: 'prestataire', source_ref: a.id, motif: a.texte.slice(0, 200), acteur: 'Cabinet Géo', acteur_id: a.i, acteur_role: 'intervenant', date: maintenant, mission_id: a.m });
}, Object.assign({ texte: texte, id: id }, ids));

test('le promoteur écrit : message enregistré, événement au journal, l\'intervenant est notifié', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (m) {
    var res = await fcEnvoyerMessageMission(m, '  Bonjour, merci d\'envoyer le plan.  ');
    var mi = fcMission(m);
    return { ok: res.ok, msgs: mi.messages, evt: DATA.evenements_fonciers.filter(function (e) { return e.type === 'message_promoteur'; }).length,
      notifs: DATA.notifications_foncieres.filter(function (n) { return n.template_code === 'message_promoteur'; }).map(function (n) { return [n.titre, n.destinataire_type || (n.destinataire && n.destinataire.type), n.message]; }) };
  }, ids.m);
  assert.equal(r.ok, true); assert.equal(r.msgs.length, 1); assert.equal(r.msgs[0].texte, "Bonjour, merci d'envoyer le plan."); assert.equal(r.msgs[0].de, 'promoteur');
  assert.equal(r.evt, 1); assert.equal(r.notifs.length, 1); assert.equal(r.notifs[0][0], 'Nouveau message du promoteur');
  assert.doesNotMatch(r.notifs[0][2], /plan\./, 'le contenu du message n\'est pas copié dans la notification');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('validations : vide, trop long, brouillon, annulée, clôturée, plafond de 500', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await app.page.evaluate(async function (m) {
    var out = {};
    out.vide = (await fcEnvoyerMessageMission(m, '   ')).erreur;
    out.long = (await fcEnvoyerMessageMission(m, 'a'.repeat(2001))).erreur;
    out.ok2000 = (await fcEnvoyerMessageMission(m, 'a'.repeat(2000))).ok;
    out.inconnue = (await fcEnvoyerMessageMission('zzz', 'x')).erreur;
    var mi = fcMission(m); mi.messages = Array.from({ length: 500 }, function (_, i) { return { id: 'x' + i, date: '2026-01-01T00:00:00.000Z', de: 'promoteur', texte: 't' }; });
    out.plafond = (await fcEnvoyerMessageMission(m, 'x')).erreur;
    mi.messages = []; mi.statut = 'cloturee'; out.cloturee = (await fcEnvoyerMessageMission(m, 'x')).erreur;
    mi.statut = 'brouillon'; out.brouillon = (await fcEnvoyerMessageMission(m, 'x')).erreur;
    mi.statut = 'annulee'; out.annulee = (await fcEnvoyerMessageMission(m, 'x')).erreur;
    return out;
  }, ids.m);
  assert.match(r.vide, /Écrivez/); assert.match(r.long, /trop long/); assert.equal(r.ok2000, true); assert.match(r.inconnue, /introuvable/);
  assert.match(r.plafond, /Limite/); assert.match(r.cloturee, /lecture seule/); assert.match(r.brouillon, /pas partagée/); assert.match(r.annulee, /pas partagée/);
});

test('message de l\'intervenant (portail) : le service Foncier est notifié, sans doublon ni autre profil', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await portailEnvoie(app.page, ids, 'Il manque le titre foncier mère.', 'mm1');
  const r = await app.page.evaluate(async function () {
    var n = await fcRattraperNotifications(), n2 = await fcRattraperNotifications();
    return { n: n, n2: n2, dest: DATA.notifications_foncieres.filter(function (x) { return x.event_id === 'evmm1'; }).map(function (x) { return x.destinataire_id; }).sort(), msg: DATA.notifications_foncieres.filter(function (x) { return x.event_id === 'evmm1'; })[0].message };
  });
  assert.deepEqual(r.dest, ['u1', 'u2']); assert.equal(r.n2, 0);
  assert.match(r.msg, /Il manque le titre foncier/);
});

test('lecture : l\'ouverture marque lus les messages de l\'intervenant, pas ceux du promoteur ; le badge suit', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await portailEnvoie(app.page, ids, 'un', 'a1'); await portailEnvoie(app.page, ids, 'deux', 'a2');
  const r = await app.page.evaluate(async function (m) {
    await fcEnvoyerMessageMission(m, 'réponse');
    var avant = fcMessagesNonLus(fcMission(m)), html1 = fcHtmlMessagerie(fcMission(m));
    var a = await fcMarquerMessagesLus(m), b = await fcMarquerMessagesLus(m), mi = fcMission(m);
    return { avant: avant, badge: /2 nouveau/.test(html1), a: a.marques, b: b.marques, apres: fcMessagesNonLus(mi), promoteurLu: mi.messages.filter(function (x) { return x.de === 'promoteur' && x.lu_le; }).length };
  }, ids.m);
  assert.equal(r.avant, 2); assert.equal(r.badge, true); assert.equal(r.a, 2); assert.equal(r.b, 0); assert.equal(r.apres, 0); assert.equal(r.promoteurLu, 0);
});

test('affichage : texte HTML inerte, mission clôturée en lecture seule, chaîne _baseModifie respectée', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  await portailEnvoie(app.page, ids, '<img src=x onerror=alert(1)><script>alert(2)</script>', 'x1');
  const r = await app.page.evaluate(async function (m) {
    var host = document.createElement('div'); host.id = 'fi-detail'; document.body.appendChild(host);
    fcRenderMissionDetail(m);
    var xss = host.querySelectorAll('img, script, [onerror]').length, texte = host.textContent.includes('<img src=x'), zone = !!document.getElementById('fi-msg-txt');
    var mi = fcMission(m); var avant = mi._modifie; await fcEnvoyerMessageMission(m, 'ok');
    var chaine = mi._baseModifie === avant && mi._modifie > avant;
    mi.statut = 'cloturee'; fcRenderMissionDetail(m);
    return { xss: xss, texte: texte, zone: zone, chaine: chaine, lectureSeule: !document.getElementById('fi-msg-txt') && host.textContent.includes('Lecture seule') };
  }, ids.m);
  assert.equal(r.xss, 0); assert.equal(r.texte, true); assert.equal(r.zone, true); assert.equal(r.chaine, true); assert.equal(r.lectureSeule, true);
  assert.deepEqual(app.etat.erreursPage, []);
});
