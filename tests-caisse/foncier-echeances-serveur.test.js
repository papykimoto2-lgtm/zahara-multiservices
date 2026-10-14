/* Foncier Connect — alertes d'échéances côté serveur (supabase/foncier_echeances_serveur.sql, pg_cron).
   Le serveur écrit des notifications au format de l'application, avec la même clé anti-doublon : l'application
   ne doit ni les recréer, ni les ignorer (e-mail en file envoyé à l'ouverture d'un poste). */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1' }]; DATA.clients = [];
    DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf', email: 'resp@x.ci', role: 'foncier' }, { id: 'u3', nom: 'Directeur', login: 'dir', role: 'admin', email: 'dir@x.ci' }];
    DATA.params = Object.assign(DATA.params || {}, { fc_relances: undefined, fc_canaux: undefined, fc_escalade_user_id: undefined });
    window.userPeutSurStore = function () { return true; }; APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'intervenants_fonciers', 'missions_foncieres', 'notifications_foncieres'].forEach(function (s) { DATA[s] = []; });
    window.syncToSupabase = function () {};
    window.__envoyes = []; FC_FOURNISSEURS.email = async function (n) { window.__envoyes.push(n.adresse + '|' + n.titre); return true; };
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    DATA.notifications_foncieres = [];
    fcEtape(d, 'depot').date_cible = '2026-10-01';
    return d.id;
  });
}

test('clé anti-doublon de l\'application = format écrit par le serveur : ech:{dossier}/{étape}:{échéance}:{niveau}{seuil}|{destinataire}|{canal}', async () => {
  const app = await ouvrirApp(); const d = await preparer(app.page);
  const cles = await app.page.evaluate(async function () {
    await fcGenererAlertes('2026-10-09');
    return DATA.notifications_foncieres.map(function (n) { return n.dedup; }).sort();
  });
  const ancre = d + '/depot:2026-10-01:apres7';
  assert.ok(cles.includes('ech:' + ancre + '|u1|interne'), cles.join('\n'));
  assert.ok(cles.includes('ech:' + ancre + '|u1|email'));
});

test('notification créée par le serveur : l\'application ne la recrée pas (interne ni e-mail)', async () => {
  const app = await ouvrirApp(); const d = await preparer(app.page);
  const r = await app.page.evaluate(async function (d) {
    var maintenant = new Date().toISOString(), dedup = 'ech:' + d + '/depot:2026-10-01:apres7';
    ['interne', 'email'].forEach(function (canal) {
      DATA.notifications_foncieres.push({ id: 'srv_' + canal, dedup: dedup + '|u1|' + canal, canal: canal, destinataire_type: 'user', destinataire_id: 'u1', destinataire_nom: 'Resp Foncier',
        adresse: canal === 'email' ? 'resp@x.ci' : '', titre: 'Échéance interne dépassée', message: 'x', template_code: 'echeance_apres', dossier_id: d, mission_id: '', event_id: '', niveau: 'apres',
        delivery_status: canal === 'interne' ? 'livree' : 'en_attente', attempt_count: 0, scheduled_at: maintenant, sent_at: '', delivered_at: '', error_message: '', lu: false, created_at: maintenant, origine: 'serveur' });
    });
    var g = await fcGenererAlertes('2026-10-09');
    var doublons = DATA.notifications_foncieres.filter(function (n) { return n.destinataire_id === 'u1' && n.niveau === 'apres'; }).length;
    return { creees: g.creees, doublons: doublons };
  }, d);
  assert.equal(r.creees, 0, 'rien à recréer'); assert.equal(r.doublons, 2);
});

test('e-mail mis en file par le serveur : envoyé par le premier poste qui s\'ouvre, une seule fois', async () => {
  const app = await ouvrirApp(); const d = await preparer(app.page);
  const r = await app.page.evaluate(async function (d) {
    var maintenant = new Date(Date.now() - 3600000).toISOString();
    DATA.notifications_foncieres.push({ id: 'srv_e', dedup: 'ech:' + d + '/depot:2026-10-01:apres7|u1|email', canal: 'email', destinataire_type: 'user', destinataire_id: 'u1', destinataire_nom: 'Resp Foncier',
      adresse: 'resp@x.ci', titre: 'Échéance interne dépassée', message: 'Bornage : échéance dépassée', template_code: 'echeance_apres', dossier_id: d, mission_id: '', event_id: '', niveau: 'apres',
      delivery_status: 'en_attente', attempt_count: 0, scheduled_at: maintenant, sent_at: '', delivered_at: '', error_message: '', lu: false, created_at: maintenant, origine: 'serveur' });
    var f1 = await fcTraiterFile(), f2 = await fcTraiterFile();
    return { f1: f1.envoyees, f2: f2.envoyees, envoyes: window.__envoyes.filter(function (e) { return /Échéance interne dépassée/.test(e); }), statut: DATA.notifications_foncieres[0].delivery_status };
  }, d);
  assert.equal(r.f1, 1); assert.equal(r.f2, 0); assert.deepEqual(r.envoyes, ['resp@x.ci|Échéance interne dépassée']); assert.equal(r.statut, 'envoyee');
});
