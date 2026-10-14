// ═══════════════════════════════════════════════════════════════════════════
// fc-portail-fichier — dépôt et ouverture de FICHIERS depuis le portail unique (Foncier Connect).
//
// Déploiement : supabase functions deploy fc-portail-fichier --no-verify-jwt   (jeton du portail vérifié par PostgREST, comme portal-login)
//
// Dépôt  (multipart/form-data : kind-cible JSON `cible`, `note`, fichier `fichier`) :
//   1. contrôle du fichier : taille ≤ 5 Mo ; type déterminé par la SIGNATURE des octets (PDF, JPEG, PNG, WebP), pas par le nom ni le type annoncé ;
//   2. fc_depot_preparer (SQL, jeton du déposant) : droits et identifiant de la pièce — rien n'est envoyé si le dépôt n'est pas autorisé ;
//   3. empreinte SHA-256, envoi dans le bucket privé « pieces-foncieres » avec la clé de service (le déposant n'a aucun droit sur le stockage) ;
//   4. fc_depot_valider (SQL, jeton du déposant) : REvérifie tout puis enregistre la pièce et le journal. Échec => le fichier envoyé est retiré.
// Ouverture (JSON { action: "ouvrir", piece_id }) : fc_portail_piece_chemin (SQL) contrôle le droit, puis URL signée de 60 s.
// Cette fonction ne décide RIEN : toute autorisation vient de la base, avec le jeton de l'appelant.
// ═══════════════════════════════════════════════════════════════════════════
const SB_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "pieces-foncieres";
const MAX_OCTETS = 5 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "https://zahara-multiservices.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });

// Limitation (mémoire d'instance, comme portal-login) : 20 dépôts / 10 minutes par jeton.
const ESSAIS = new Map<string, { n: number; t: number }>();
function limite(cle: string): boolean {
  const now = Date.now(), e = ESSAIS.get(cle);
  if (!e || now - e.t > 10 * 60 * 1000) { ESSAIS.set(cle, { n: 1, t: now }); return false; }
  e.n++; return e.n > 20;
}
function cleJeton(auth: string): string {
  try { const p = JSON.parse(atob(auth.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return String(p.sub || p.client_id || p.intervenant_id || "?"); } catch { return "?"; }
}

// Type réel d'après les premiers octets.
function typeReel(b: Uint8Array): string | null {
  const s = (i: number, t: string) => t.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length > 5 && s(0, "%PDF-")) return "application/pdf";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && s(1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length > 12 && s(0, "RIFF") && s(8, "WEBP")) return "image/webp";
  return null;
}
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");

async function rpc(fn: string, body: unknown, auth: string, apikey: string) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: { "content-type": "application/json", apikey, authorization: auth }, body: JSON.stringify(body),
  });
  if (r.status === 401 || r.status === 403) return { http: 401, data: null };
  if (!r.ok) return { http: 502, data: null };
  return { http: 200, data: await r.json() };
}
async function urlSignee(chemin: string): Promise<string | null> {
  const s = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${encodeURI(chemin)}`, {
    method: "POST", headers: { "content-type": "application/json", apikey: SB_SERVICE_ROLE, authorization: `Bearer ${SB_SERVICE_ROLE}` }, body: JSON.stringify({ expiresIn: 60 }),
  });
  if (!s.ok) return null;
  const j = await s.json(); const rel = j.signedURL || j.signedUrl;
  return rel ? `${SB_URL}/storage/v1${rel}` : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const auth = req.headers.get("authorization") || "", apikey = req.headers.get("apikey") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return json({ ok: false, erreur: "Session expirée : reconnectez-vous." }, 401);

  const type = req.headers.get("content-type") || "";

  // ── Ouverture d'un fichier (souscripteur) ──
  if (type.includes("application/json")) {
    let b: { action?: string; piece_id?: string } = {};
    try { b = await req.json(); } catch { return json({ ok: false, erreur: "Requête invalide." }, 400); }
    if (b.action !== "ouvrir" || !b.piece_id || String(b.piece_id).length > 80) return json({ ok: false, erreur: "Requête invalide." }, 400);
    const r = await rpc("fc_portail_piece_chemin", { p_piece: String(b.piece_id) }, auth, apikey);
    if (r.http === 401) return json({ ok: false, erreur: "Session expirée : reconnectez-vous." }, 401);
    if (r.http !== 200 || !r.data?.ok || !r.data.chemin || (r.data.bucket && r.data.bucket !== BUCKET)) return json({ ok: false, erreur: "Document indisponible." }, 403);
    try { const u = await urlSignee(r.data.chemin); if (!u) return json({ ok: false, erreur: "Document indisponible." }, 502); return json({ ok: true, url: u, nom: r.data.nom || "document", type: r.data.type || "" }); }
    catch { return json({ ok: false, erreur: "Document indisponible." }, 502); }
  }

  // ── Dépôt d'un fichier ──
  if (!type.includes("multipart/form-data")) return json({ ok: false, erreur: "Requête invalide." }, 400);
  if (limite(cleJeton(auth))) return json({ ok: false, erreur: "Trop de dépôts : réessayez dans quelques minutes." }, 429);
  const taille = parseInt(req.headers.get("content-length") || "0", 10);
  if (taille > MAX_OCTETS + 200 * 1024) return json({ ok: false, erreur: "Fichier trop volumineux (5 Mo au plus)." }, 413);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ ok: false, erreur: "Requête invalide." }, 400); }
  const fichier = form.get("fichier");
  if (!(fichier instanceof File)) return json({ ok: false, erreur: "Aucun fichier reçu." }, 400);
  if (fichier.size < 1 || fichier.size > MAX_OCTETS) return json({ ok: false, erreur: "Fichier vide ou trop volumineux (5 Mo au plus)." }, 400);
  let cible: Record<string, unknown>;
  try { cible = JSON.parse(String(form.get("cible") || "{}")); } catch { return json({ ok: false, erreur: "Requête invalide." }, 400); }
  if (!cible || typeof cible !== "object" || ["souscripteur", "livrable"].indexOf(String(cible.kind)) === -1) return json({ ok: false, erreur: "Requête invalide." }, 400);
  const note = String(form.get("note") || "").slice(0, 2000);

  const octets = new Uint8Array(await fichier.arrayBuffer());
  const mime = typeReel(octets);
  if (!mime) return json({ ok: false, erreur: "Format non accepté (PDF, JPG, PNG ou WebP uniquement)." }, 400);
  const nom = (fichier.name || "document").split(/[\\/]/).pop()!.replace(/[\r\n\t<>]/g, " ").trim().slice(0, 160) || "document";

  // 1. Droits, avant tout envoi.
  const prep = await rpc("fc_depot_preparer", { p_cible: cible }, auth, apikey);
  if (prep.http === 401) return json({ ok: false, erreur: "Session expirée : reconnectez-vous." }, 401);
  if (prep.http !== 200 || !prep.data?.ok) return json({ ok: false, erreur: prep.data?.erreur || "Dépôt impossible pour le moment." }, prep.http === 200 ? 403 : 502);
  const { piece_id: pieceId, chemin } = prep.data as { piece_id: string; chemin: string };

  // 2. Empreinte + envoi dans le stockage privé (jamais écrasé : pas de x-upsert).
  const empreinte = hex(await crypto.subtle.digest("SHA-256", octets));
  const up = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encodeURI(chemin)}`, {
    method: "POST", headers: { apikey: SB_SERVICE_ROLE, authorization: `Bearer ${SB_SERVICE_ROLE}`, "content-type": mime }, body: octets,
  });
  if (!up.ok) return json({ ok: false, erreur: "Envoi du fichier impossible pour le moment. Réessayez." }, 502);

  // 3. Enregistrement (REcontrôle des droits). Échec => on retire le fichier envoyé.
  const val = await rpc("fc_depot_valider", { p_cible: cible, p_piece_id: pieceId, p_nom: nom, p_type: mime, p_taille: octets.length, p_empreinte: empreinte, p_note: note }, auth, apikey);
  if (val.http !== 200 || !val.data?.ok) {
    try { await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encodeURI(chemin)}`, { method: "DELETE", headers: { apikey: SB_SERVICE_ROLE, authorization: `Bearer ${SB_SERVICE_ROLE}` } }); } catch { /* orphelin inoffensif : jamais référencé */ }
    return json({ ok: false, erreur: val.data?.erreur || "Dépôt impossible pour le moment." }, val.http === 401 ? 401 : (val.http === 200 ? 403 : 502));
  }
  return json({ ok: true, piece_id: pieceId, version: val.data.version ?? null });
});
