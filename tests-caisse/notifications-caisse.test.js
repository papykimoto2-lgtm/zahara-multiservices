const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function amorcer(page) {
  await page.evaluate(function () {
    var il = new Date(Date.now() - 30 * 3600000).toISOString();
    DATA.caisses = [{ id: 'c1', nom: 'CAISSE TEST', caissiere_ids: [] }];
    DATA.caisse_sessions = [{ id: 's1', caisse_id: 'c1', date: il.slice(0, 10), statut: 'ouverte', fond_ouverture: 100000, ouverte_par: 'Kou', ouverte_le: il }];
    DATA.caisse_mouvements = [{ id: 'a', session_id: 's1', caisse_id: 'c1', type: 'sortie', montant: 5000, requiert_validation: true, valide: false, numero: 'BS-1' }];
    DATA.users = [{ id: 'u1', nom: 'Directrice', login: 'dg', role: 'admin', actif: true, tel: '07 00 00 00 00', email: 'dg@exemple.com' }, { id: 'u2', nom: 'Sans contact', login: 'x', actif: true }];
    window.caissesVisibles = function () { return DATA.caisses; };
  });
}

test('message de synthèse : caisse, solde, bon en attente et alerte session > 24 h', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const t = await app.page.evaluate(function () { return caisseNotifTexte(); });
    assert.match(t, /CAISSE TEST : OUVERTE/);
    assert.match(t, /1 bon\(s\) en attente de validation/);
    assert.match(t, /Session ouverte depuis plus de 24 h : CAISSE TEST/);
  } finally { await app.fermer(); }
});

test('fenêtre d\'envoi : destinataires avec contact, pré-remplissage, WhatsApp sur le bon numéro', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(function () {
      var ouverts = []; window.open = function (u) { ouverts.push(u); };
      caisseNotifOuvrir();
      var nb = document.querySelectorAll('#cn-dest option').length;
      document.getElementById('cn-dest').value = 'u1'; caisseNotifChoisir();
      var tel = document.getElementById('cn-tel').value, mail = document.getElementById('cn-mail').value;
      caisseNotifEnvoyerWA();
      return { nb: nb, tel: tel, mail: mail, url: ouverts[0] || '' };
    });
    assert.equal(r.nb, 2);                       /* « Choisir » + Directrice (l'utilisateur sans contact est exclu) */
    assert.equal(r.tel, '07 00 00 00 00'); assert.equal(r.mail, 'dg@exemple.com');
    assert.match(r.url, /^https:\/\/wa\.me\/2250700000000\?text=/);
  } finally { await app.fermer(); }
});

test('e-mail : adresse invalide refusée, sinon ouverture de la messagerie', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      caisseNotifOuvrir();
      document.getElementById('cn-mail').value = 'pas-une-adresse';
      var toasts = []; var t0 = window.toast; window.toast = function (m, k) { toasts.push(m); };
      await caisseNotifEnvoyerEmail();
      window.toast = t0;
      return toasts;
    });
    assert.ok(r.some(function (m) { return /invalide/.test(m); }));
  } finally { await app.fermer(); }
});

test('envoi automatique : un e-mail par destinataire, une seule fois par période, rien si désactivé ou sous le seuil', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      var envois = [];
      window.emailjs = { init: function () {}, send: function (s, t, d) { envois.push(d); return Promise.resolve(); } };
      window.caisseRoleAdminLike = function () { return true; };
      DATA.params = DATA.params || {}; DATA.params.emailjs_service = 's'; DATA.params.emailjs_template = 't'; DATA.params.emailjs_key = 'k';
      DATA.params.caisse_notif_auto = { actif: false, seuil_h: 24, relance_h: 24, emails: 'dg@exemple.com, compta@exemple.com', dernier: {} };
      var desact = await caisseNotifAutoCycle();
      DATA.params.caisse_notif_auto.actif = true;
      DATA.params.caisse_notif_auto.seuil_h = 48;                 /* session ouverte depuis 30 h : sous le seuil */
      var sous = await caisseNotifAutoCycle();
      DATA.params.caisse_notif_auto.seuil_h = 24;
      var un = await caisseNotifAutoCycle();
      var deux = await caisseNotifAutoCycle();                    /* même période : pas de renvoi */
      return { desact: desact, sous: sous, un: un, deux: deux, n: envois.length, a: envois.map(function (e) { return e.to_email; }), sujet: envois[0] && envois[0].subject, dernier: Object.keys(DATA.params.caisse_notif_auto.dernier) };
    });
    assert.equal(r.desact.ignore, 'inactif');
    assert.equal(r.sous.rien, true);
    assert.equal(r.un.envoyes, 2);
    assert.equal(r.deux.rien, true);
    assert.deepEqual(r.a, ['dg@exemple.com', 'compta@exemple.com']);
    assert.match(r.sujet, /1 caisse\(s\) ouverte\(s\) depuis plus de 24 h/);
    assert.deepEqual(r.dernier, ['s1']);
  } finally { await app.fermer(); }
});

test('envoi automatique : en mode serveur le navigateur n\'envoie rien (évite les doublons)', async () => {
  const app = await ouvrirApp();
  try {
    await amorcer(app.page);
    const r = await app.page.evaluate(async function () {
      var envois = [];
      window.emailjs = { init: function () {}, send: function (s, t, d) { envois.push(d); return Promise.resolve(); } };
      window.caisseRoleAdminLike = function () { return true; };
      DATA.params = DATA.params || {}; DATA.params.emailjs_service = 's'; DATA.params.emailjs_template = 't'; DATA.params.emailjs_key = 'k';
      DATA.params.caisse_notif_auto = { actif: true, serveur: true, seuil_h: 24, relance_h: 24, emails: 'dg@exemple.com', dernier: {} };
      var res = await caisseNotifAutoCycle();
      return { res: res, n: envois.length };
    });
    assert.equal(r.res.ignore, 'serveur'); assert.equal(r.n, 0);
  } finally { await app.fermer(); }
});
