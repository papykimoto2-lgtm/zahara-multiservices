import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
/* Test de portal-login (profil intervenant + non-régression), sans Deno ni base :
   le code de la fonction est exécuté sous Node avec un faux environnement Deno et une base simulée.
   Lancer :  node --experimental-strip-types --disable-warning=ExperimentalWarning supabase/functions/portal-login/login.test.mjs */
const target = process.argv[2] || new URL('./index.ts', import.meta.url).href;
const sha = (c, s) => createHash('sha256').update(c + s).digest('hex');
const SALT = 'a'.repeat(64);
const iv = (o) => ({ code_acces_hash: sha(o.code || 'K7P2M9QX', SALT), code_acces_salt: SALT, ...o.rec });
let TABLES = {};
globalThis.Deno = { env: { get: (k) => ({ SB_URL: 'https://x.supabase.co', SERVICE_ROLE_KEY: 'svc', SB_PROJECT_JWT_SECRET: 'secret' })[k] }, serve: (h) => { globalThis.__h = h; } };
globalThis.fetch = async (url) => {
  url = String(url);
  if (url.includes('/rest/v1/pi_suppressions')) { const id = decodeURIComponent(url.match(/id=eq\.([^&]+)/)[1]); return new Response(JSON.stringify((TABLES.__tomb || []).includes(id) ? [{ id }] : []), { status: 200 }); }
  const t = url.match(/rest\/v1\/([a-z_]+)\?/)[1];
  return new Response(JSON.stringify(TABLES[t] || []), { status: 200 });
};
await import(target);
const call = async (body, ip = '1.1.1.' + Math.floor(Math.random() * 250)) => {
  const r = await globalThis.__h(new Request('https://f/', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json() };
};
const claims = (tok) => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
const interv = (extra = {}) => ({ id: 'i1', data: { id: 'i1', nom_organisation: 'Cabinet Géo Plus', type: 'geometre', email: 'Geo@Plus.ci', telephone: '+225 07 68 65 37 63', statut_relation: 'actif', ...iv({ rec: {} }), ...extra } });
const res = [];
const ok = (n, c) => { res.push((c ? 'OK   ' : 'ECHEC') + ' ' + n); if (!c) process.exitCode = 1; };

TABLES = { pi_intervenants_fonciers: [interv()] };
let r = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'K7P2M9QX' });
ok('connexion par e-mail (casse ignorée) : 200', r.status === 200);
const c = r.body.access_token ? claims(r.body.access_token) : {};
ok('jeton : kind=intervenant, portal_kind, intervenant_id, sub', c.kind === 'intervenant' && c.portal_kind === 'intervenant' && c.intervenant_id === 'i1' && c.sub === 'i1' && c.scope_id === 'i1');
ok('jeton : rôle authenticated, expire dans ≤ 2 h', c.role === 'authenticated' && c.exp - c.iat === 7200);
ok('nom renvoyé = nom_organisation', r.body.nom === 'Cabinet Géo Plus' && r.body.intervenant_id === 'i1');
r = await call({ kind: 'intervenant', ident: '0768653763', code: 'K7P2M9QX' });
ok('connexion par téléphone (variante sans indicatif)', r.status === 200);
r = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'FAUX0000' });
ok('mauvais code : 401', r.status === 401);
r = await call({ kind: 'intervenant', ident: 'autre@x.ci', code: 'K7P2M9QX' });
ok('identifiant inconnu : 401', r.status === 401);

TABLES = { pi_intervenants_fonciers: [interv({ statut_relation: 'archive' })] };
r = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'K7P2M9QX' });
ok('intervenant archivé : 401', r.status === 401);
TABLES = { pi_intervenants_fonciers: [interv({ statut_relation: undefined })] };
r = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'K7P2M9QX' });
ok('statut absent : 401 (refus par défaut)', r.status === 401);
TABLES = { pi_intervenants_fonciers: [interv({ code_expiration: '2020-01-01' })] };
r = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'K7P2M9QX' });
ok('code expiré : 403', r.status === 403 && r.body.error === 'expired');
TABLES = { pi_intervenants_fonciers: [interv({ code_expiration: '2099-01-01' })] };
r = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'K7P2M9QX' });
ok('code non expiré : 200', r.status === 200);
TABLES = { pi_intervenants_fonciers: [interv({ _deleted: 'true' })] };
r = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'K7P2M9QX' });
ok('fiche supprimée (logique) : 401', r.status === 401);
TABLES = { pi_intervenants_fonciers: [interv()], __tomb: ['ts::intervenants_fonciers::i1'] };
r = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'K7P2M9QX' });
ok('pierre tombale : 401', r.status === 401);
TABLES = { pi_intervenants_fonciers: [interv({ code_acces_hash: undefined, code_acces_salt: undefined })] };
r = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'K7P2M9QX' });
ok('fiche sans code : 401', r.status === 401);
// limitation des tentatives (5 puis 429), même IP et même identifiant
TABLES = { pi_intervenants_fonciers: [interv()] };
let last; for (let i = 0; i < 6; i++) last = await call({ kind: 'intervenant', ident: 'geo@plus.ci', code: 'NOPE' + i }, '9.9.9.9');
ok('6e tentative erronée : 429', last.status === 429);
// non-régression : un autre profil
TABLES = { pi_clients: [{ id: 'c1', data: { id: 'c1', dossier: 'D-1', nom: 'Koné', code_acces_hash: sha('123456', SALT), code_acces_salt: SALT } }] };
r = await call({ kind: 'souscripteur', ident: 'D-1', code: '123456' });
ok('non-régression souscripteur : 200 avec client_id', r.status === 200 && claims(r.body.access_token).client_id === 'c1');
r = await call({ kind: 'inconnu', ident: 'x', code: 'y' });
ok('profil inconnu : 400', r.status === 400);
console.log(res.join('\n'));
