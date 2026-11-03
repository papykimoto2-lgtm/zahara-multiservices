// ═════════════════════════════════════════════════════════════════
// Edge Function : portail-geo — MENKO HOLDING
//
// Renseigne le pays et la ville d'une visite du portail (ligne session_start de
// pi_portail_analytics). L'adresse IP est lue sur la requête, envoyée une seule fois à un service de
// géolocalisation, puis OUBLIÉE : elle n'est ni stockée ni journalisée. Seuls pays et ville sont conservés.
//
// POST JSON { session_id } (clé anon du portail) → { ok }.   Aucun jeton requis.
// Garde-fous : session_id au format du portail ; on ne renseigne qu'une ligne session_start encore vide ;
// la localisation écrite est toujours celle de l'appelant, jamais une valeur fournie par lui.
// Secrets : SB_URL, SERVICE_ROLE_KEY (comme hub-sync). Optionnel : GEOIP_URL (modèle avec {ip}, réponse
// JSON { success, country, city }) ; par défaut https://ipwho.is/{ip}?fields=success,country,city
// ═════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEOIP_URL = Deno.env.get("GEOIP_URL") ?? "https://ipwho.is/{ip}?fields=success,country,city";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let b: any; try { b = await req.json(); } catch { return json({ ok: false, error: "payload" }, 400); }
  const sid = clip(b.session_id, 64);
  if (sid.length < 8) return json({ ok: false, error: "session" }, 400);

  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (!ip || !/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return json({ ok: true, localise: false });

  let pays = "", ville = "";
  try {
    const r = await fetch(GEOIP_URL.replace("{ip}", encodeURIComponent(ip)), { signal: AbortSignal.timeout(4000) });
    const g = await r.json();
    if (g && g.success !== false) { pays = clip(g.country ?? g.country_name, 60).trim(); ville = clip(g.city, 80).trim(); }
  } catch { /* service indisponible : la visite reste simplement sans localisation */ }
  if (!pays && !ville) return json({ ok: true, localise: false });

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error } = await db.from("pi_portail_analytics").update({ pays: pays || null, ville: ville || null })
    .eq("session_id", sid).eq("event_type", "session_start").is("ville", null).is("pays", null);
  if (error) return json({ ok: false, error: "ecriture" }, 500);
  return json({ ok: true, localise: true });
});
