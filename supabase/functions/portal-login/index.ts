// ═══════════════════════════════════════════════════════════════════════════
// Supabase Edge Function : portal-login  (ImmoSuite ERP)
// Authentifie les 9 profils du portail unique côté serveur et renvoie un JWT
// scoped. Le hash du code ne quitte JAMAIS le serveur.
//
//   supabase functions deploy portal-login --no-verify-jwt
//
// Secrets : les mêmes que staff-login, déjà configurés sur ce projet — voir
// staff-login/index.ts (SB_URL/SUPABASE_URL, SERVICE_ROLE_KEY/
// SUPABASE_SERVICE_ROLE_KEY, SB_PROJECT_JWT_SECRET). Rien à créer.
//
// [FIX 15/09] La version précédemment déployée (v1, jamais issue de ce
// fichier — écrite et poussée directement sur Supabase, jamais reversée ici)
// appelait des RPC Postgres `portal_trouver_compte` / `portal_trouver_proprio`
// qui n'ont jamais existé dans la base : CHAQUE tentative de connexion, pour
// les 9 profils, échouait avant même d'atteindre la comparaison de code — quel
// que soit l'identifiant ou le code saisi. Elle lisait aussi des secrets
// (SB_SERVICE_ROLE, SB_JWT_SECRET) qui ne correspondent à AUCUN de ceux
// réellement configurés sur ce projet (voir plus haut), ce qui aurait de toute
// façon fait échouer createClient() en dehors de tout try/catch — d'où
// l'absence totale d'en-têtes CORS observée côté navigateur (la fonction
// plantait avant d'exécuter le moindre `return json(...)`). Cette version
// revient à une résolution de compte 100% autonome (lecture REST paginée via
// la clé service_role, sans dépendance à une fonction SQL externe) et aux
// noms de secrets confirmés fonctionnels par staff-login.
//
// CE QUI CHANGE PAR RAPPORT À LA VERSION PRÉCÉDENTE (repo, jamais déployée)
//
// 1. Identifiants normalisés. L'ancienne version ne retirait QUE les espaces :
//    une fiche portant « +225 07 68 65 37 63 » ne répondait pas à « 0768653763 »
//    et renvoyait 401 avec le bon code. La comparaison se fait désormais sur
//    l'ensemble des écritures plausibles d'un même numéro — indicatif présent
//    ou non, zéro national présent ou non, ponctuation quelconque — ce qui
//    couvre aussi les numéros de la diaspora (voir identVariants).
// 2. Tous les identifiants de la fiche sont acceptés. L'acteur ne sait pas si
//    on attend son n° de dossier, son email ou son téléphone ; les trois
//    fonctionnent quand ils figurent sur sa fiche.
// 3. Les 9 profils du portail sont couverts (confirmé contre les appels
//    portalLogin() de portail-unique.html : souscripteur, apporteur, foncier,
//    mandant, financier, amenageur, partenaire_lot, proprio_foncier,
//    coproprietaire — « diaspora »/« locataire » sont des espaces d'AFFICHAGE
//    qui envoient tous kind:'souscripteur' côté serveur, pas des kinds à part).
// 4. Lecture paginée. Un `limit=5000` masquerait les fiches au-delà de ce
//    seuil sans le moindre message d'erreur pour les acteurs concernés.
// 5. Comparaison du hash à temps constant.
//
// COMPATIBILITÉ DES CLAIMS — NE PAS RETIRER `kind` NI `scope_id`
// portal_rls.sql filtre sur auth.jwt()->>'kind' et auth.jwt()->>'scope_id'.
// Les vues plus récentes lisent portal_kind et un claim par profil
// (client_id, prop_id, partenaire_id…). Les deux jeux sont donc émis
// ensemble : retirer les anciens couperait l'accès aux données du portail.
//
// VÉRIFIÉ CONTRE L'ERP : hashPassword(code, salt) = SHA-256(code + salt), sans
// itération, sel de 32 octets en hexadécimal. hashCode() en est la réplique
// exacte. Si hashPassword change côté ERP, changer ici aussi.
//
// LIMITE CONNUE : un acquéreur foncier ayant plusieurs cessions se voit
// rattacher à la première dont le code correspond. Le portail n'affiche donc
// qu'une cession. Corriger cela suppose de renvoyer une liste et d'adapter
// l'écran correspondant du portail.
// ═══════════════════════════════════════════════════════════════════════════
const SB_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SB_JWT_SECRET = Deno.env.get("SB_PROJECT_JWT_SECRET")!;

const CORS = {
  "Access-Control-Allow-Origin": "https://zahara-multiservices.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
};

// ── Limitation des tentatives ──────────────────────────────────────────────
// Un code à 6 chiffres = 10^6 combinaisons, cassables par script en quelques
// minutes. Le compteur du portail vit dans le localStorage du navigateur : il
// ne protège rien contre un appel direct à cette fonction. Cette limite-ci est
// la seule réelle. Elle est gardée en mémoire d'instance : elle repart donc à
// zéro au recyclage de l'instance et n'est pas partagée entre instances — une
// table Postgres serait plus robuste si l'attaque devient un vrai sujet.
const ATTEMPTS = new Map<string, { n: number; t: number }>();
const WINDOW_MS = 10 * 60 * 1000, MAX_TRY = 5;
function blocked(k: string) {
  const e = ATTEMPTS.get(k), now = Date.now();
  if (!e || now - e.t > WINDOW_MS) { ATTEMPTS.set(k, { n: 0, t: now }); return false; }
  return e.n >= MAX_TRY;
}
function fail(k: string) {
  const e = ATTEMPTS.get(k), now = Date.now();
  if (!e || now - e.t > WINDOW_MS) ATTEMPTS.set(k, { n: 1, t: now }); else e.n++;
}

// ── Empreinte du code ──────────────────────────────────────────────────────
async function hashCode(code: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(code + salt);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Signature du jeton — implémentation locale, sans dépendance externe ────
// Identique à staff-login/index.ts (fonction confirmée fonctionnelle en
// production sur ce projet) : un import distant (ex. deno.land/x/djwt) ajoute
// un point de défaillance au cold-start (résolution DNS, disponibilité du
// CDN) qui n'a pas sa place dans un chemin d'authentification.
function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function signSupabaseJwt(payload: Record<string, unknown>): Promise<string> {
  const enc = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SB_JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(sig))}`;
}

// Comparaison à temps constant : évite de laisser fuiter la validité d'un
// préfixe de hash par la durée de la réponse.
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Normalisation d'un identifiant ─────────────────────────────────────────
// Réduit une valeur à sa forme comparable : emails en minuscules, raisons
// sociales sans espaces ni tirets, téléphones réduits à leurs chiffres.
function normBase(s: unknown): string {
  const v = String(s ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v.includes("@")) return v;
  // Ressemble-t-il à un téléphone (chiffres et ponctuation de mise en forme) ?
  if (!/^[\d\s+().-]+$/.test(v)) return v.replace(/[\s-]/g, "");
  return v.replace(/\D/g, "");
}

// Indicatifs reconnus, essayés du plus long au plus court pour qu'un préfixe
// court (« 1 ») ne morde jamais sur un indicatif long (« 225 »). Volontairement
// limité aux pays réellement concernés — Côte d'Ivoire, sous-région, et les
// destinations habituelles de la diaspora. Un indicatif absent d'ici n'est pas
// une panne : le numéro reste comparable dans sa forme brute.
const INDICATIFS = [
  "225", "221", "223", "224", "226", "227", "228", "229", "233", "235", "237",
  "212", "213", "216", "351", "352", "971",
  "33", "32", "41", "44", "49", "39", "34", "31", "27", "30", "45", "46", "47",
  "48", "90", "86", "1", "7",
].sort((a, b) => b.length - a.length);

// Un même numéro s'écrit de plusieurs façons légitimes, et le zéro de départ
// ne se comporte PAS pareil d'un pays à l'autre :
//   Côte d'Ivoire  +225 07 68 65 37 63  ↔  0768653763   (le 0 fait partie du n°)
//   France         +33 6 12 34 56 78    ↔  0612345678   (le 0 est un préfixe
//                                                        national, absent à
//                                                        l'international)
// Chercher UNE forme canonique oblige donc à connaître la règle de chaque pays.
// On produit plutôt, des deux côtés de la comparaison, l'ensemble des formes
// plausibles : deux valeurs correspondent dès que leurs ensembles se croisent.
// C'est ce qui permet à un investisseur de la diaspora de saisir son numéro
// comme il en a l'habitude, quelle que soit la façon dont sa fiche a été
// remplie.
function identVariants(s: unknown): string[] {
  const base = normBase(s);
  if (!base) return [];
  // Email, raison sociale, n° de dossier alphanumérique : une seule forme.
  if (!/^\d+$/.test(base)) return [base];
  // Trop court pour être un téléphone : n° de dossier purement numérique.
  if (base.length < 6) return [base];

  const out = new Set<string>();
  const ajouter = (n: string) => {
    if (n.length < 6) return;
    out.add(n);
    // Avec et sans le zéro national, puisqu'on ignore lequel des deux pays
    // écrit le numéro stocké.
    if (n.startsWith("0")) out.add(n.slice(1)); else out.add("0" + n);
  };

  ajouter(base);
  for (const cc of INDICATIFS) {
    if (!base.startsWith(cc)) continue;
    const reste = base.slice(cc.length);
    // Un indicatif n'est retenu que s'il laisse derrière lui un numéro national
    // de longueur plausible : sans ce garde-fou, « 1 » rognerait le premier
    // chiffre de numéros qui n'ont rien d'américain.
    if (reste.length < 8 || reste.length > 10) continue;
    ajouter(reste);
    break;
  }
  return [...out];
}

// ── Carte des profils ──────────────────────────────────────────────────────
// Pour chaque profil : la table, les champs pouvant servir d'identifiant, la
// clé du tableau imbriqué s'il y a lieu, et le claim porté par le JWT.
// Les tables correspondent une à une à celles que le portail interroge juste
// après la connexion ; les champs d'identifiant reprennent ceux des
// générateurs de code de l'ERP et des écrans de connexion du portail.
// Un champ d'identifiant peut désigner une valeur imbriquée, notée en
// pointillé : chez l'acquéreur foncier, le contact vit dans data.acheteur.tel
// et non à la racine de la fiche. Oublier ce cas suffit à rendre tout un
// espace inaccessible alors que le numéro figure bien au dossier.
function lire(obj: any, chemin: string): unknown {
  return chemin.split(".").reduce((o: any, k) => (o == null ? o : o[k]), obj);
}

const KINDS: Record<string, {
  table: string;
  identFields: string[];
  nested?: string;
  idClaim: string;
}> = {
  souscripteur:    { table: "pi_clients",                  identFields: ["dossier", "tel", "email"],                  idClaim: "client_id" },
  apporteur:       { table: "pi_apporteurs",               identFields: ["email", "tel"],                             idClaim: "apporteur_id" },
  // L'identifiant remis à l'acquéreur est son n° de dossier (cf.
  // genererCodeAcquereurFoncier), mais ses coordonnées vivent sous `acheteur`.
  foncier:         { table: "pi_cessions_foncieres",       identFields: ["dossier", "acheteur.tel", "acheteur.email", "contact", "tel", "email"], idClaim: "cession_id" },
  mandant:         { table: "pi_proprietaires_bailleurs",  identFields: ["tel", "email"],                             idClaim: "proprietaire_id" },
  coproprietaire:  { table: "pi_lots_copro",               identFields: ["proprietaire_email", "proprietaire_tel"],   idClaim: "lot_id" },
  // whatsapp est un champ à part entière de la fiche partenaire, et c'est
  // souvent le seul numéro qu'il connaisse. contact/telephone sont des alias
  // défensifs : les deux instances n'ont pas la même ancienneté de données.
  partenaire_lot:  { table: "pi_partenaires_lot",          identFields: ["tel", "whatsapp", "email", "contact", "telephone"], idClaim: "partenaire_id" },
  amenageur:       { table: "pi_amenageurs",               identFields: ["tel", "email", "contact"],                  idClaim: "amenageur_id" },
  // L'écran « financier » du portail accepte « Nom / raison sociale,
  // téléphone ou email » : les quatre champs sont donc acceptés.
  financier:       { table: "pi_af_financiers",            identFields: ["nom", "raison_sociale", "tel", "email"],    idClaim: "financier_id" },
  // Les propriétaires terriens ne sont pas des lignes de table : ils vivent
  // dans un tableau JSON à l'intérieur de l'opération foncière.
  proprio_foncier: { table: "pi_af_operations",            identFields: ["contact", "tel", "email", "nom"], nested: "proprietaires", idClaim: "prop_id" },
};

// ── Lecture paginée d'une table ────────────────────────────────────────────
// PostgREST plafonne le nombre de lignes par réponse (souvent 1000). Demander
// « limit=5000 » ne lève pas ce plafond et masque le problème : au-delà, les
// fiches suivantes n'existent tout simplement pas pour la fonction, et les
// acteurs concernés ne peuvent plus jamais se connecter. On pagine donc
// jusqu'à épuisement.
async function fetchAllRows(table: string): Promise<Array<{ id: string; data: any }>> {
  const PAGE = 1000;
  const out: Array<{ id: string; data: any }> = [];
  for (let from = 0; ; from += PAGE) {
    const resp = await fetch(`${SB_URL}/rest/v1/${table}?select=id,data`, {
      headers: {
        apikey: SB_SERVICE_ROLE,
        Authorization: `Bearer ${SB_SERVICE_ROLE}`,
        "Range-Unit": "items",
        Range: `${from}-${from + PAGE - 1}`,
      },
    });
    if (!resp.ok) throw new Error("server");
    const batch = await resp.json();
    if (!Array.isArray(batch)) throw new Error("server");
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

// ── Vérification du code ───────────────────────────────────────────────────
// Le repli en clair est conservé À DESSEIN : des fiches anciennes portent
// encore code_acces / mot_de_passe sans hash, et les supprimer ici priverait
// ces acteurs d'accès du jour au lendemain. L'ERP re-hache chaque code à sa
// régénération ; ce repli pourra disparaître une fois toutes les fiches
// migrées (vérifier qu'aucune ligne n'a code_acces sans code_acces_hash).
async function codeValide(rec: any, code: string): Promise<boolean> {
  if (!rec || !code) return false;
  if (rec.code_acces_hash && rec.code_acces_salt) {
    return safeEqual(await hashCode(code, rec.code_acces_salt), String(rec.code_acces_hash));
  }
  if (rec.code_acces) return String(rec.code_acces) === code;
  if (rec.mot_de_passe) return String(rec.mot_de_passe) === code;
  return false;
}

type Resolution = {
  kind: string;
  id: string;
  parent_id: string;
  idClaim: string;
  nom: string;
  nested: boolean;
  expiration: string | null;
};

async function resolvePortalLogin(kind: string, ident: string, code: string): Promise<Resolution | null> {
  const cfg = KINDS[kind];
  if (!cfg) return null;

  const cibles = new Set(identVariants(ident));
  if (!cibles.size || !code) return null;

  const rows = await fetchAllRows(cfg.table);

  for (const row of rows) {
    const base = row.data || {};
    const candidats = cfg.nested
      ? (base[cfg.nested] || []).map((p: any) => ({ rec: p, parentId: row.id }))
      : [{ rec: base, parentId: row.id }];

    for (const { rec, parentId } of candidats) {
      if (!rec) continue;
      // On accepte n'importe lequel des identifiants présents sur la fiche :
      // l'acteur ne sait pas lequel on attend de lui.
      const matches = cfg.identFields.some((f) => {
        const val = lire(rec, f);
        return val && identVariants(val).some((v) => cibles.has(v));
      });
      if (!matches) continue;
      if (!(await codeValide(rec, code))) continue;

      return {
        kind,
        id: String(cfg.nested ? (rec.id ?? parentId) : parentId),
        parent_id: String(parentId),
        idClaim: cfg.idClaim,
        nom: rec.nom ?? rec.raison_sociale ?? rec.proprietaire_nom ?? rec.acquereur ?? "",
        nested: !!cfg.nested,
        expiration: rec.code_expiration ?? rec.date_expiration ?? null,
      };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: { kind?: string; ident?: string; code?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const kind = String(body.kind || "souscripteur");
  const ident = (body.ident || "").trim();
  const code = (body.code || "").trim();
  if (!ident || !code) return json({ error: "missing" }, 400);
  // Un profil inconnu est refusé explicitement. L'ancienne version le
  // rabattait sur « souscripteur », ce qui produisait un 401 incompréhensible
  // pour un écran pourtant correctement configuré.
  if (!KINDS[kind]) return json({ error: "unknown_kind" }, 400);

  const ip = req.headers.get("x-forwarded-for") || "0.0.0.0";
  // normBase et non une variante : la clé doit rester stable pour un même
  // identifiant saisi, sans dépendre de l'ordre des variantes produites.
  const rlKey = kind + "|" + ip + "|" + normBase(ident);
  if (blocked(rlKey)) return json({ error: "rate_limited" }, 429);

  let res: Resolution | null;
  try {
    res = await resolvePortalLogin(kind, ident, code);
  } catch {
    return json({ error: "server" }, 500);
  }
  if (!res) { fail(rlKey); return json({ error: "invalid_credentials" }, 401); }

  if (res.expiration && new Date(res.expiration) < new Date()) return json({ error: "expired" }, 403);

  const nowSec = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    aud: "authenticated",
    role: "authenticated",
    sub: res.id,
    iat: nowSec,
    exp: nowSec + 2 * 60 * 60,
    // Anciens claims — lus par portal_rls.sql. Ne pas retirer.
    kind: res.kind,
    scope_id: res.id,
    // Nouveaux claims — lus par les vues RLS par profil.
    portal_kind: res.kind,
    [res.idClaim]: res.id,
  };
  const token = await signSupabaseJwt(claims);

  return json({
    access_token: token,
    expires_in: 7200,
    kind: res.kind,
    id: res.id,
    nom: res.nom,
    // Le portail lit lg.prop_id pour les propriétaires terriens, et
    // l'équivalent par profil pour les autres espaces.
    [res.idClaim]: res.id,
    parent_id: res.parent_id,
    // Un propriétaire terrien peut figurer dans plusieurs opérations : c'est
    // le couple (propriétaire, opération) qui identifie ses apports, d'où
    // l'opération renvoyée à part.
    ...(res.nested ? { operation_id: res.parent_id } : {}),
  });
});

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
}
