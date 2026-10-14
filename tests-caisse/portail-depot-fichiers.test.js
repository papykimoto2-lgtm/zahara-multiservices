/* Portail : dépôt et ouverture de fichiers (souscripteur : pièces demandées ; intervenant : livrables) via l'Edge Function fc-portail-fichier. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path'), fs = require('fs');
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright').chromium; }
const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const exe = process.env.CHROMIUM_PATH || (fs.existsSync(base) ? fs.readdirSync(base).filter(d => d.startsWith('chromium-')).sort().reverse().map(d => path.join(base, d, 'chrome-linux', 'chrome')).find(f => fs.existsSync(f)) : undefined);
let nav; after(async () => { if (nav) await nav.close(); });
async function ouvrir() {
  nav = nav || await chromium.launch({ executablePath: exe });
  const page = await (await nav.newContext()).newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await page.goto('file://' + path.resolve(__dirname, '..', 'portail-unique.html'));
  await page.waitForFunction(() => typeof blocPiecesTitre === 'function' && typeof intDeposerFichier === 'function');
  return { page, erreurs };
}
/* Met un fichier dans un <input type=file> et enregistre les appels réseau. */
const preparerReseau = (page) => page.evaluate(() => {
  window.__appels = []; window.__rep = { status: 200, body: { ok: true, piece_id: 'pf1' } };
  window.fetch = async function (u, o) {
    var corps = null; if (o && o.body instanceof FormData) { corps = {}; o.body.forEach(function (v, k) { corps[k] = (v instanceof File) ? { nom: v.name, type: v.type, taille: v.size } : v; }); } else if (o && o.body) corps = o.body;
    window.__appels.push({ u: String(u), h: o && o.headers, corps: corps });
    return new Response(JSON.stringify(window.__rep.body), { status: window.__rep.status });
  };
  window.__fichier = function (id, nom, type, taille) { var i = document.getElementById(id) || document.querySelector('[data-champ="' + id + '"]'); var dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(taille)], nom, { type: type })); i.files = dt.files; };
});

const DEMANDES = { demandes: [{ dossier_id: 'd1', dossier: 'DF-1', etape_code: 'depot', etape: 'Dépôt du dossier', demande: 'Copie de la <b>CNI</b>' }],
  pieces: [{ id: 'p1', nom: 'cni.pdf', type: 'application/pdf', taille: 2000, date: '2026-10-10', etape: 'Dépôt du dossier', dossier: 'DF-1', de: 'vous', statut: 'refusee', motif_refus: 'Illisible', disponible: true },
           { id: 'p2', nom: 'plan.pdf', date: '2026-10-11', etape: 'Dépôt du dossier', de: 'promoteur', statut: '', motif_refus: '', disponible: true }, { id: 'p3', nom: 'x.pdf', date: '2026-10-12', etape: 'E', de: 'vous', statut: 'a_verifier', disponible: false }] };

test('souscripteur : pièces demandées, statuts, motif de refus ; rien à afficher sans pièce ; texte échappé', async () => {
  const { page, erreurs } = await ouvrir();
  const r = await page.evaluate((D) => { S.pieces = null; var a = blocPiecesTitre(); S.pieces = { demandes: [], pieces: [] }; var b = blocPiecesTitre(); S.pieces = D; return { a: a, b: b, h: blocPiecesTitre() }; }, DEMANDES);
  assert.equal(r.a, ''); assert.equal(r.b, '');
  assert.doesNotMatch(r.h, /<b>CNI/); assert.match(r.h, /Copie de la &lt;b&gt;CNI/); assert.match(r.h, /Envoyer le fichier/);
  assert.match(r.h, /cni\.pdf[\s\S]*Refusée[\s\S]*Envoyé par vous[\s\S]*Motif du refus : Illisible/); assert.match(r.h, /plan\.pdf[\s\S]*Transmis par le promoteur/);
  assert.equal((r.h.match(/ptOuvrir\(/g) || []).length, 2, 'pas de bouton Ouvrir pour une pièce sans fichier disponible');
  assert.deepEqual(erreurs, []);
});

test('souscripteur : contrôles avant envoi ; envoi multipart avec jeton, sans Content-Type forcé ; confirmation ; erreurs serveur', async () => {
  const { page, erreurs } = await ouvrir(); await preparerReseau(page);
  const r = await page.evaluate(async (D) => {
    var h = document.createElement('div'); h.id = 's-tit'; document.body.appendChild(h);
    S.suivi = { dossiers: [{}] }; S.client = { id: 'c1' }; S.pieces = D; SB_TOKEN = 'JETON'; rafraichirPiecesTitre();
    var o = {};
    await ptEnvoyer(0); o.sansFichier = S.ptMsg.m;
    __fichier('pt-f-0', 'gros.pdf', 'application/pdf', 5 * 1024 * 1024 + 1); await ptEnvoyer(0); o.gros = S.ptMsg.m;
    rafraichirPiecesTitre(); __fichier('pt-f-0', 'virus.exe', 'application/x-msdownload', 100); await ptEnvoyer(0); o.type = S.ptMsg.m; o.appelsAvant = __appels.length;
    rafraichirPiecesTitre(); __fichier('pt-f-0', 'cni.pdf', 'application/pdf', 1500); document.getElementById('pt-n-0').value = 'recto-verso';
    window.chargerPiecesTitre = async function () { return { demandes: [], pieces: [{ id: 'pf1', nom: 'cni.pdf', date: '2026-10-14', etape: 'E', de: 'vous', statut: 'a_verifier', disponible: true }] }; };
    await ptEnvoyer(0);
    o.ok = S.ptMsg; o.appel = __appels[0]; o.apres = S.pieces.pieces.length; o.occupe = S.ptOccupe;
    __rep.status = 403; __rep.body = { ok: false, erreur: 'Aucune pièce n\'est demandée sur cette étape.' };
    S.pieces = D; rafraichirPiecesTitre(); __fichier('pt-f-0', 'a.pdf', 'application/pdf', 100); await ptEnvoyer(0); o.refus = S.ptMsg;
    return o;
  }, DEMANDES);
  assert.equal(r.sansFichier, 'Choisissez un fichier.'); assert.match(r.gros, /5 Mo/); assert.match(r.type, /Format non accepté/); assert.equal(r.appelsAvant, 0, 'aucun envoi si le fichier est refusé côté navigateur');
  assert.match(r.appel.u, /\/functions\/v1\/fc-portail-fichier$/); assert.equal(r.appel.h.Authorization, 'Bearer JETON'); assert.equal(r.appel.h['Content-Type'], undefined, 'le navigateur fixe la limite multipart');
  assert.deepEqual(JSON.parse(r.appel.corps.cible), { kind: 'souscripteur', dossier_id: 'd1', etape_code: 'depot' }); assert.equal(r.appel.corps.note, 'recto-verso'); assert.deepEqual(r.appel.corps.fichier, { nom: 'cni.pdf', type: 'application/pdf', taille: 1500 });
  assert.equal(r.ok.t, 'ok'); assert.equal(r.apres, 1); assert.equal(r.occupe, false); assert.equal(r.refus.t, 'err'); assert.match(r.refus.m, /Aucune pièce n'est demandée/);
  assert.deepEqual(erreurs, []);
});

test('souscripteur : ouverture d\'un fichier par URL signée ; refus et session expirée', async () => {
  const { page, erreurs } = await ouvrir(); await preparerReseau(page);
  const r = await page.evaluate(async (D) => {
    var h = document.createElement('div'); h.id = 's-tit'; document.body.appendChild(h); S.suivi = { dossiers: [{}] }; S.pieces = D; SB_TOKEN = 'JETON';
    var ouverts = []; window.open = function () { var w = { closed: false, location: '', close: function () { this.closed = true; } }; ouverts.push(w); return w; };
    var o = {}; __rep.body = { ok: true, url: 'https://x.supabase.co/storage/v1/object/sign/pieces-foncieres/a?token=t' };
    await ptOuvrir(0); o.loc = ouverts[0].location; o.corps = __appels[0].corps;
    __rep.status = 403; __rep.body = { ok: false, erreur: 'Document indisponible.' }; await ptOuvrir(0); o.ferme = ouverts[1].closed; o.msg = S.ptMsg.m;
    __rep.status = 401; __rep.body = {}; window.logoutSouscripteur = function () { o.deconnecte = true; }; await ptOuvrir(0);
    return o;
  }, DEMANDES);
  assert.match(r.loc, /token=t/); assert.equal(r.corps, '{"action":"ouvrir","piece_id":"p1"}'); assert.equal(r.ferme, true); assert.equal(r.msg, 'Document indisponible.'); assert.equal(r.deconnecte, true);
  assert.deepEqual(erreurs, []);
});

test('intervenant : dépôt du fichier d\'un livrable (cible mission/livrable, note) ; contrôles ; rechargement ; formulaire proposé', async () => {
  const { page, erreurs } = await ouvrir(); await preparerReseau(page);
  const r = await page.evaluate(async () => {
    SB_TOKEN = 'JETON'; INT.id = 'g1'; INT.nom = 'Cabinet';
    INT.missions = [{ id: 'm1', reference: 'MF-1', titre: 'Bornage', statut: 'en_cours', echeance: '2099-12-31', dossier: { reference: 'DF-1' }, etapes: [], livrables: [{ id: 'l1', libelle: 'Plan', versions: [] }], messages: [] }];
    INT.ouverte = 'm1'; document.body.insertAdjacentHTML('beforeend', '<div id="int-dash"></div>'); rendreIntervenant();
    var o = {}; o.formulaire = /Déposer le fichier/.test(document.getElementById('int-dash').innerHTML);
    window.chargerIntervenant = async function () { o.recharge = true; };
    await intDeposerFichier('m1', 0); o.sans = INT.msg.m;
    __fichier('fich0', 'x.exe', 'application/x-msdownload', 10); await intDeposerFichier('m1', 0); o.type = INT.msg.m;
    document.querySelector('[data-champ="note0"]').value = 'v1 corrigée'; __fichier('fich0', 'plan.pdf', 'application/pdf', 3000); await intDeposerFichier('m1', 0);
    o.ok = INT.msg; o.appel = __appels[0]; o.occupe = INT.occupe;
    __rep.status = 403; __rep.body = { ok: false, erreur: 'Une version est déjà en attente de vérification.' }; __fichier('fich0', 'plan.pdf', 'application/pdf', 3000); await intDeposerFichier('m1', 0); o.refus = INT.msg;
    return o;
  });
  assert.equal(r.formulaire, true); assert.equal(r.sans, 'Choisissez un fichier.'); assert.match(r.type, /Format non accepté/);
  assert.deepEqual(JSON.parse(r.appel.corps.cible), { kind: 'livrable', mission_id: 'm1', livrable_id: 'l1' }); assert.equal(r.appel.corps.note, 'v1 corrigée'); assert.equal(r.appel.h.Authorization, 'Bearer JETON');
  assert.equal(r.ok.t, 'ok'); assert.match(r.ok.m, /soumettre la mission/); assert.equal(r.occupe, null); assert.equal(r.recharge, true); assert.equal(r.refus.t, 'err'); assert.match(r.refus.m, /déjà en attente/);
  assert.deepEqual(erreurs, []);
});
