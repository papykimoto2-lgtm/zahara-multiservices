// ═════════════════════════════════════════════════════════════════
// Edge Function : wa-webhook — retours WhatsApp (statuts de remise) et désinscriptions (STOP).
// Déploiement : supabase functions deploy wa-webhook --no-verify-jwt     (appelée par Meta, sans jeton Supabase)
// Secrets     : WA_APP_SECRET (secret de l'application Meta : signature X-Hub-Signature-256),
//               WA_VERIFY_TOKEN (chaîne libre saisie dans Meta › Webhooks), SB_URL, SERVICE_ROLE_KEY.
// Meta        : URL de rappel = https://<projet>.supabase.co/functions/v1/wa-webhook ; champ abonné : « messages ».
// ═════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_SECRET = Deno.env.get("WA_APP_SECRET"), VERIFY = Deno.env.get("WA_VERIFY_TOKEN");
const STOP = /^\s*(stop|arret|arrêt|arreter|arrêter|desinscription|désinscription|unsubscribe)\s*[.!]*\s*$/i;
const RANG: Record<string, number> = { en_cours: 0, envoye: 1, delivre: 2, lu: 3, echec: 9 };
const MAP: Record<string, string> = { sent: "envoye", delivered: "delivre", read: "lu", failed: "echec" };

async function signatureValide(corps: string, entete: string | null): Promise<boolean> {
  if (!APP_SECRET || !entete?.startsWith("sha256=")) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(corps)));
  const attendu = Array.from(sig).map((x) => x.toString(16).padStart(2, "0")).join("");
  const recu = entete.slice(7);
  if (recu.length !== attendu.length) return false;
  let diff = 0; for (let i = 0; i < attendu.length; i++) diff |= attendu.charCodeAt(i) ^ recu.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  if (req.method === "GET") {   // vérification de l'URL par Meta
    return VERIFY && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === VERIFY
      ? new Response(u.searchParams.get("hub.challenge") || "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const corps = await req.text();
  if (!(await signatureValide(corps, req.headers.get("x-hub-signature-256")))) return new Response("signature", { status: 401 });
  let b: any; try { b = JSON.parse(corps); } catch { return new Response("json", { status: 400 }); }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  for (const entry of b?.entry || []) for (const ch of entry?.changes || []) {
    const v = ch?.value || {};
    for (const s of v.statuses || []) {   // sent / delivered / read / failed — jamais de recul de statut
      const nouveau = MAP[s?.status]; if (!nouveau || !s?.id) continue;
      const { data: l } = await db.from("wa_relances_log").select("id,statut").eq("wa_message_id", s.id).maybeSingle();
      if (!l || RANG[nouveau] <= RANG[l.statut] && nouveau !== "echec") continue;
      await db.from("wa_relances_log").update({ statut: nouveau, erreur: nouveau === "echec" ? String(s?.errors?.[0]?.title || "echec").slice(0, 300) : null, maj_le: new Date().toISOString() }).eq("id", l.id);
    }
    for (const m of v.messages || []) {   // STOP : désinscription immédiate
      const txt = m?.type === "text" ? m?.text?.body : m?.type === "button" ? m?.button?.text : "";
      if (m?.from && STOP.test(String(txt || ""))) await db.from("wa_optout").upsert({ tel: String(m.from), motif: "stop" }, { onConflict: "tel" });
    }
  }
  return new Response("ok", { status: 200 });   // toujours 200 après signature valide : Meta ne rejoue pas
});
