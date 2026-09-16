// ═══════════════════════════════════════════════════════════════════════════
// Edge Function : staff-login — ZAHARA MULTISERVICES (v7)
//
// [FIX v7 — DOUBLONS DE LOGIN CASSAIENT TOUTE AUTHENTIFICATION]
// pi_users contient des doublons (jusqu'à 10 lignes pour login="KESSIE",
// probablement issus d'un import/seed initial). L'ancien code faisait
// .eq("login", login).maybeSingle() : dès que PLUSIEURS lignes correspondent,
// maybeSingle() renvoie une erreur PGRST116 ("multiple rows") — jamais
// vérifiée ici (seul `data` était déstructuré, pas `error`). `data` valait
// alors null, et le code retombait sur "Identifiant introuvable" (401) —
// message trompeur : le login existe bel et bien, il existe juste en trop
// d'exemplaires. Résultat mesuré : AUCUNE connexion serveur possible pour un
// login dupliqué, quel que soit le mot de passe saisi, indéfiniment.
//
// Corrigé : on récupère TOUTES les lignes partageant ce login, et on essaie
// le mot de passe contre chacune (en priorité les comptes actifs) jusqu'à
// trouver la correspondance — la connexion aboutit dès qu'UN des doublons a
// le bon mot de passe, sans qu'il soit nécessaire de nettoyer les doublons
// en base au préalable. Le nettoyage des doublons reste recommandé côté
// application, mais n'est plus bloquant pour se connecter.
//
// [FIX v6 — VERROU ANTI-BRUTE-FORCE REFERMÉ SUR L'APPLICATION]
// Le compteur de tentatives interrogeait TOUTES les lignes d'échec de
// pi_logs_connexion sur 24 h. Or cette table reçoit aussi les échecs écrits
// par le NAVIGATEUR (logConnexion(), appelée à chaque saisie erronée côté
// client, y compris hors ligne). Un employé qui se trompait 5 fois dans la
// journée saturait donc le compteur SERVEUR : staff-login répondait ensuite
// 429 à tout le monde pendant 24 h, même avec le bon mot de passe.
// Conséquence mesurée en production : aucun jeton `authenticated` n'était
// plus émis, et l'ERP entier retombait sur la clé anonyme — exactement ce
// que les politiques RLS sont censées empêcher.
//
// Corrigé sur deux points :
//   1. Seuls les échecs VÉRIFIÉS ICI sont comptés (marqueur data.src="srv").
//      Les lignes écrites par le client n'ont pas ce marqueur et n'entrent
//      plus dans le calcul — elles restent en base pour l'audit.
//   2. Fenêtre glissante de 15 minutes au lieu de 24 h, plafond porté à 10.
//      Une attaque par force brute reste stoppée net ; une faute de frappe
//      ne condamne plus la journée.
// Le garde-fou client (5 essais/jour, localStorage) est inchangé.
//
// Déploiement : Supabase Dashboard → Edge Functions → staff-login → Deploy.
// Secrets requis : SB_PROJECT_JWT_SECRET (Legacy JWT Secret DU PROJET ZAHARA).
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROJECT_JWT_SECRET = Deno.env.get("SB_PROJECT_JWT_SECRET")!;
const MAX_ATTEMPTS = 10;                 // échecs vérifiés serveur, par identifiant
const ATTEMPT_WINDOW_MIN = 15;           // fenêtre glissante
const TOKEN_TTL_SEC = 8 * 3600;
const PBKDF2_ITER  = 210000;

const CORS = {
  "Access-Control-Allow-Origin": "https://zahara-multiservices.vercel.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Salt(pwd: string, salt: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(pwd + salt)));
}
async function pbkdf2(pwd: string, salt: string, iter: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pwd), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: iter }, key, 256);
  return toHex(bits);
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function signSupabaseJwt(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(PROJECT_JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(sig))}`;
}

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  let login = "", password = "";
  try {
    const body = await req.json();
    login = body.login || "";
    password = body.password || body.motdepasse || "";
  } catch { return json({ ok: false, error: "payload" }, 400); }
  login = (login || "").trim();
  if (!login || !password) return json({ ok: false, error: "champs" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MIN * 60 * 1000).toISOString();

  // ── Anti-brute-force : uniquement les échecs vérifiés par CETTE fonction ──
  const { count } = await db.from("pi_logs_connexion")
    .select("id", { count: "exact", head: true })
    .eq("data->>login", login)
    .eq("data->>success", "false")
    .eq("data->>src", "srv")
    .gte("data->>date", since);
  if ((count ?? 0) >= MAX_ATTEMPTS)
    return json({ ok: false, error: "bloque",
                  message: `Trop de tentatives. Réessayez dans ${ATTEMPT_WINDOW_MIN} minutes.` }, 429);

  const logFail = (detail: string) =>
    db.from("pi_logs_connexion").insert({
      id: crypto.randomUUID(),
      data: {
        login, success: false, date: new Date().toISOString(), detail, src: "srv",
        userAgent: (req.headers.get("user-agent") || "").slice(0, 120), ip_hint: "",
      },
      updated_at: new Date().toISOString(),
    });

  // [FIX v7] .maybeSingle() cassait tout dès qu'un login existait en double
  // (erreur PGRST116 jamais vérifiée, silencieusement traitée comme "pas
  // trouvé"). On récupère toutes les lignes et on essaie le mot de passe
  // contre chacune — les comptes actifs d'abord.
  const { data: candidats } = await db.from("pi_users").select("*").eq("login", login);
  if (!candidats || candidats.length === 0) {
    await logFail("Identifiant introuvable");
    return json({ ok: false, error: "invalide" }, 401);
  }
  const ordonnes = [...candidats].sort((a, b) => {
    const aActif = !a.statut || a.statut === "actif" ? 0 : 1;
    const bActif = !b.statut || b.statut === "actif" ? 0 : 1;
    return aActif - bActif;
  });

  let user: any = null, upgrade = false;
  for (const candidat of ordonnes) {
    if (candidat.statut && candidat.statut !== "actif") continue;
    let valid = false, candUpgrade = false;
    if (candidat.pwd_algo === "pbkdf2" && candidat.password_hash && candidat.salt) {
      valid = safeEq(await pbkdf2(password, candidat.salt, candidat.pwd_iter || PBKDF2_ITER), candidat.password_hash);
    } else if (candidat.password_hash && candidat.salt) {
      valid = safeEq(await sha256Salt(password, candidat.salt), candidat.password_hash);
      candUpgrade = valid;
    } else if (candidat.password) {
      valid = safeEq(candidat.password, password);
      candUpgrade = valid;
    }
    if (valid) { user = candidat; upgrade = candUpgrade; break; }
  }

  if (!user) {
    // Compte(s) trouvé(s) mais tous inactifs, ou mot de passe incorrect partout.
    const tousInactifs = ordonnes.every((c) => c.statut && c.statut !== "actif");
    if (tousInactifs) { await logFail("Compte inactif"); return json({ ok: false, error: "inactif" }, 403); }
    await logFail("Mot de passe incorrect");
    return json({ ok: false, error: "invalide" }, 401);
  }

  if (upgrade) {
    const newHash = await pbkdf2(password, user.salt, PBKDF2_ITER);
    await db.from("pi_users").update({
      password_hash: newHash, pwd_algo: "pbkdf2", pwd_iter: PBKDF2_ITER, password: null,
    }).eq("id", user.id);
  }

  await db.from("pi_logs_connexion").insert({
    id: crypto.randomUUID(),
    data: {
      login, success: true, date: new Date().toISOString(),
      detail: "Connexion réussie (serveur)", src: "srv",
      userAgent: (req.headers.get("user-agent") || "").slice(0, 120), ip_hint: "",
    },
    updated_at: new Date().toISOString(),
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const token = await signSupabaseJwt({
    aud: "authenticated",
    role: "authenticated",
    app_role: user.role,
    sub: user.id,
    login: user.login,
    iat: nowSec,
    exp: nowSec + TOKEN_TTL_SEC,
  });

  return json({
    ok: true, token, expires_in: TOKEN_TTL_SEC,
    user: {
      id: user.id, login: user.login, nom: user.nom, role: user.role,
      email: user.email, tel: user.tel, statut: user.statut,
      must_change: !!user.must_change,
    },
  });
});
