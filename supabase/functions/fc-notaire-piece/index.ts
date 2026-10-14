// ═══════════════════════════════════════════════════════════════════════════
// fc-notaire-piece — URL signée (60 s) vers UNE pièce transmise à un notaire.
//
// Déploiement : supabase functions deploy fc-notaire-piece --no-verify-jwt
// (comme portal-login : le jeton du portail n'est pas un jeton utilisateur Supabase ; il est vérifié par PostgREST).
//
// Principe : cette fonction NE DÉCIDE RIEN. Elle transmet le jeton du notaire à fc_notaire_piece_chemin() (SQL, SECURITY DEFINER) qui
//  · vérifie que le jeton est celui d'un notaire dont l'accès est actif ;
//  · vérifie que la pièce est transmise à un souscripteur qui le désigne, non retirée, non restreinte, avec fichier ;
//  · JOURNALISE la consultation dans le journal du dossier ;
//  · renvoie le chemin. Alors seulement, la fonction signe une URL de 60 secondes avec la clé de service
//    (le notaire n'a aucun droit direct sur le stockage). Un refus renvoie toujours le même message (pas d'énumération).
// ═══════════════════════════════════════════════════════════════════════════
const SB_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "pieces-foncieres";

const CORS = {
  "Access-Control-Allow-Origin": "https://zahara-multiservices.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const REFUS = { error: "indisponible", message: "Document indisponible." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const auth = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return json(REFUS, 401);

  let pieceId = "";
  try { pieceId = String((await req.json()).piece_id || "").trim(); } catch { return json({ error: "bad_request" }, 400); }
  if (!pieceId || pieceId.length > 80) return json({ error: "bad_request" }, 400);

  // 1. Contrôle d'accès + journal, avec le jeton DU NOTAIRE (jamais la clé de service).
  let acces: { ok?: boolean; bucket?: string; chemin?: string; nom?: string; type?: string } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/fc_notaire_piece_chemin`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey, authorization: auth },
      body: JSON.stringify({ p_piece: pieceId }),
    });
    if (r.status === 401 || r.status === 403) return json(REFUS, 401);
    if (!r.ok) return json({ error: "server" }, 502);
    acces = await r.json();
  } catch { return json({ error: "server" }, 502); }
  if (!acces || acces.ok !== true || !acces.chemin || (acces.bucket && acces.bucket !== BUCKET)) return json(REFUS, 403);

  // 2. Signature d'une URL très courte (60 s) avec la clé de service.
  try {
    const s = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${encodeURI(acces.chemin)}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SB_SERVICE_ROLE, authorization: `Bearer ${SB_SERVICE_ROLE}` },
      body: JSON.stringify({ expiresIn: 60 }),
    });
    if (!s.ok) return json({ error: "storage" }, 502);
    const j = await s.json();
    const rel = j.signedURL || j.signedUrl;
    if (!rel) return json({ error: "storage" }, 502);
    return json({ url: `${SB_URL}/storage/v1${rel}`, nom: acces.nom || "document", type: acces.type || "" });
  } catch { return json({ error: "storage" }, 502); }
});
