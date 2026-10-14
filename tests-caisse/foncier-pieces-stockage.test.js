/* Foncier Connect — stockage privé des pièces : le fichier part dans le bucket, la ligne publiée n'a que des métadonnées. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ouvrirApp, fermerNavigateur } = require('./harness');
after(fermerNavigateur);

async function preparer(page) {
  return page.evaluate(async function () {
    DATA.parcelles = [{ id: 'p1', ref: 'PARC-1' }]; DATA.clients = []; DATA.users = [{ id: 'u1', nom: 'Resp Foncier', login: 'rf' }];
    window.userPeutSurStore = function () { return true; };
    APP.currentUser = { id: 'u1', nom: 'Resp Foncier', role: 'foncier' };
    ['dossiers_fonciers', 'evenements_fonciers', 'notifications_foncieres', 'pieces_foncieres', 'publications_foncieres', 'demandes_fonciers'].forEach(function (s) { DATA[s] = []; });
    window.syncToSupabase = function () {};
    var d = (await fcOuvrirDossier({ parcelle_id: 'p1', type: 'acd', responsable_id: 'u1' })).dossier;
    window.PDF = { nom: 'acd.pdf', type: 'application/pdf', taille: 2000, contenu: 'data:application/pdf;base64,' + btoa('%PDF-1.4 titre foncier') };
    var r = await fcAjouterPiece(d.id, 'depot', PDF, { visibilite: 'interne', categorie: 'autre' });
    window.SB = Object.assign(window.SB || {}, { url: 'https://x.supabase.co', key: 'k' }); window.sbAuth = function () { return 'jwt'; };
    window.__appels = []; window.__reponse = { status: 200, body: '{}' };
    window.fetch = async function (u, o) {
      window.__appels.push({ u: String(u), m: (o && o.method) || 'GET', h: (o && o.headers) || {}, n: o && o.body && o.body.length });
      if (/\/object\/sign\//.test(u) && o && o.method === 'POST') return new Response(JSON.stringify({ signedURL: '/object/sign/pieces-foncieres/x?token=t' }), { status: 200 });
      if (/token=t/.test(u)) return new Response(window.__contenu || 'x', { status: 200 });
      return new Response(window.__reponse.body, { status: window.__reponse.status });
    };
    return { d: d.id, p: r.piece.id };
  });
}
const run = (page, fn, arg) => page.evaluate(fn, arg || null);

test('envoi : chemin {dossier}/{pièce}, bucket privé, copie cloud sans contenu, contenu local conservé', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await run(app.page, async (ids) => {
    var p = fcPiece(ids.p), cloud = await fcPieceVersCloud(p), a = window.__appels[0];
    return { chemin: p.chemin, bucket: p.bucket, url: a.u, methode: a.m, type: a.h['Content-Type'], auth: a.h.Authorization, octets: a.n, cloudContenu: cloud.contenu, cloudChemin: cloud.chemin, localContenu: !!p.contenu, nom: cloud.nom };
  }, ids);
  assert.equal(r.chemin, ids.d + '/' + ids.p); assert.equal(r.bucket, 'pieces-foncieres');
  assert.match(r.url, /\/storage\/v1\/object\/pieces-foncieres\//); assert.equal(r.methode, 'POST'); assert.equal(r.type, 'application/pdf'); assert.equal(r.auth, 'Bearer jwt');
  assert.ok(r.octets > 10); assert.equal(r.cloudContenu, undefined); assert.equal(r.cloudChemin, r.chemin); assert.equal(r.localContenu, true); assert.equal(r.nom, 'acd.pdf');
  assert.deepEqual(app.etat.erreursPage, []);
});

test('échec d\'envoi : ligne non publiée, rien de perdu ; reprise ensuite ; déjà présent (409) = succès', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await run(app.page, async (ids) => {
    var p = fcPiece(ids.p), o = {};
    window.__reponse = { status: 500, body: 'boom' }; o.echec = await fcPieceVersCloud(p); o.cheminApresEchec = p.chemin || '';
    o.sync = await fcSynchroniserPieces(); o.restantes = o.sync.restantes;
    window.__reponse = { status: 409, body: '{"error":"Duplicate","message":"The resource already exists"}' }; o.doublon = !!(await fcPieceVersCloud(p)); o.cheminDoublon = p.chemin;
    delete p.chemin; window.__reponse = { status: 200, body: '{}' }; o.reprise = await fcSynchroniserPieces(); o.cheminReprise = p.chemin; o.contenuGarde = !!p.contenu;
    return o;
  }, ids);
  assert.equal(r.echec, null); assert.equal(r.cheminApresEchec, ''); assert.equal(r.restantes, 1);
  assert.equal(r.doublon, true); assert.equal(r.cheminDoublon, ids.d + '/' + ids.p);
  assert.deepEqual(r.reprise, { envoyees: 1, restantes: 0 }); assert.equal(r.cheminReprise, ids.d + '/' + ids.p); assert.equal(r.contenuGarde, true);
});

test('autre poste : pièce sans contenu → URL signée courte, téléchargement, contrôle d\'intégrité (conforme puis altéré)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await run(app.page, async (ids) => {
    var p = fcPiece(ids.p), o = {}, original = p.contenu;
    await fcEnvoyerPieceStorage(p);
    window.__contenu = '%PDF-1.4 titre foncier';
    delete p.contenu; delete _fcContenusCache[p.id];
    o.contenu = await fcContenuPiece(p); o.pareil = o.contenu === original;
        o.integre = (await fcVerifierIntegrite(p.id)).conforme;
    delete _fcContenusCache[p.id]; window.__contenu = '%PDF-1.4 FALSIFIE';
    o.altere = (await fcVerifierIntegrite(p.id)).conforme;
    return o;
  }, ids);
  assert.equal(r.pareil, true); assert.equal(r.integre, true); assert.equal(r.altere, false);
});

test('hors ligne / sans stockage : pas d\'exception, pas de fausse réussite ; fichier indisponible signalé', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const r = await run(app.page, async (ids) => {
    var p = fcPiece(ids.p), o = {}; window.SB.url = '';
    o.envoi = await fcEnvoyerPieceStorage(p); o.cloud = await fcPieceVersCloud(p);
    window.SB.url = 'https://x.supabase.co'; delete p.contenu; delete p.chemin;
    o.contenu = await fcContenuPiece(p); o.integrite = await fcVerifierIntegrite(p.id);
    return o;
  }, ids);
  assert.equal(r.envoi, false); assert.equal(r.cloud, null); assert.equal(r.contenu, ''); assert.equal(r.integrite.ok, false); assert.match(r.integrite.erreur, /pas disponible/);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('synchro réelle : le fichier part dans le bucket, la ligne publiée ne contient pas le contenu ; échec → rien de publié', async () => {
  const app = await ouvrirApp();
  assert.equal(await app.page.evaluate(() => typeof window.__syncReel === 'function'), true, 'la vraie fonction de synchro est conservée par le harnais');
  const o = await app.page.evaluate(async function () {
    window.SB = Object.assign(window.SB || {}, { url: 'https://x.supabase.co', key: 'k' }); window.sbAuth = function () { return 'jwt'; };
    var stock = [], rest = []; window.__ok = true;
    window.fetch = async function (u) { stock.push(String(u)); return new Response('[]', { status: window.__ok ? 200 : 500 }); };
    window.sbFetch = async function (chemin, methode, corps) { rest.push({ chemin: chemin, corps: JSON.stringify(corps) }); return []; };   /* le harnais neutralise sbFetch : on l'observe */
    var p = { id: 'pz1', dossier_id: 'dz1', nom: 'a.pdf', type: 'application/pdf', contenu: 'data:application/pdf;base64,' + btoa('%PDF-1.4 x') };
    var res = await window.__syncReel('pi_pieces_foncieres', p), ok = { res: res, stock: stock.filter(function (a) { return /object\/pieces-foncieres\/dz1\/pz1/.test(a); }).length, rest: rest.length,
      sansContenu: rest.length && rest[0].corps.indexOf('base64') === -1 && rest[0].corps.indexOf('dz1/pz1') !== -1, chemin: p.chemin, localGarde: !!p.contenu };
    window.__ok = false; rest.length = 0;
    var q = { id: 'pz2', dossier_id: 'dz1', nom: 'b.pdf', type: 'application/pdf', contenu: 'data:application/pdf;base64,' + btoa('%PDF-1.4 y') };
    var res2 = await window.__syncReel('pi_pieces_foncieres', q);
    return { ok: ok, echec: { res: res2, rest: rest.length, chemin: q.chemin || '', localGarde: !!q.contenu } };
  });
  assert.equal(o.ok.res, true); assert.equal(o.ok.stock, 1); assert.equal(o.ok.rest, 1); assert.equal(o.ok.sansContenu, true); assert.equal(o.ok.chemin, 'dz1/pz1'); assert.equal(o.ok.localGarde, true);
  assert.equal(o.echec.res, false); assert.equal(o.echec.rest, 0); assert.equal(o.echec.chemin, ''); assert.equal(o.echec.localGarde, true);
  assert.deepEqual(app.etat.erreursPage, []);
});

test('livrable déposé depuis le portail : la version porte le lien vers le fichier (ouvrable par le responsable)', async () => {
  const app = await ouvrirApp(); const ids = await preparer(app.page);
  const html = await app.page.evaluate(function (ids) {
    DATA.intervenants_fonciers = [{ id: 'g1', type: 'geometre', nom_organisation: 'Cabinet Géo', statut_relation: 'actif' }]; DATA.users = [{ id: 'u1', nom: 'Resp', login: 'rf' }];
    DATA.pieces_foncieres.push({ id: 'pfp', dossier_id: ids.d, etape_code: 'depot', nom: 'plan.pdf', type: 'application/pdf', chemin: ids.d + '/pfp', retire: false });
    DATA.missions_foncieres = [{ id: 'm1', reference: 'MF-1', titre: 'Bornage', dossier_id: ids.d, intervenant_id: 'g1', statut: 'livrable_soumis', responsable_validation_id: 'u1', echeance: '2099-12-31', messages: [],
      livrables: [{ id: 'l1', libelle: 'Plan', versions: [{ numero: 1, reference: 'Fichier : plan.pdf', note: '', date: '2026-10-14', depose_par: 'Cabinet Géo', statut: 'soumis', refus: null, piece_id: 'pfp' }, { numero: 2, reference: 'Fichier : x.pdf', statut: 'soumis', piece_id: 'inconnue' }] }] }];
    document.body.insertAdjacentHTML('beforeend', '<div id="fi-detail"></div>');
    fcRenderMissionDetail('m1'); return document.getElementById('fi-detail').innerHTML;
  }, ids);
  assert.match(html, /Fichier : plan\.pdf[\s\S]*fcTelechargerPieceUI\('pfp'\)[\s\S]*ouvrir le fichier/);
  assert.equal((html.match(/ouvrir le fichier/g) || []).length, 1, 'pas de lien si la pièce est inconnue de ce poste');
  assert.deepEqual(app.etat.erreursPage, []);
});
