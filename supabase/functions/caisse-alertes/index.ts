// ═════════════════════════════════════════════════════════════════
// Edge Function : caisse-alertes — MENKO HOLDING
//
// Envoi automatique, 24 h/24, par e-mail, des sessions de caisse ouvertes depuis trop longtemps.
// Appelée toutes les 30 min par pg_cron (voir supabase/caisse_alertes_serveur.sql). Ne fait RIEN tant que
// l'envoi serveur n'est pas activé dans Menko Immo (Caisses › Envoyer l'état › Envoi automatique › Mode serveur).
//
// Réglages lus dans pi_params (id « main ») → data.caisse_notif_auto :
//   { actif, serveur, seuil_h, relance_h, emails, emailjs:{ service, template, key } }
// Secret requis : EMAILJS_PRIVATE_KEY (EmailJS › Account › Security : « Allow EmailJS API for non-browser
// applications » doit être activé). Optionnels : EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY.
// Secrets de base : SB_URL, SERVICE_ROLE_KEY (comme hub-sync).
// Suivi anti-doublon : table caisse_alertes_envoyees (une ligne par session, date du dernier envoi).
// POST { dry:true } : n'envoie rien, renvoie les sessions qui seraient signalées (ignore actif/serveur).
// ═════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMAILJS_URL = "https://api.emailjs.com/api/v1.0/email/send";
const MAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const dateFr = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? "?" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Abidjan" }); };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let b: any = {}; try { b = await req.json(); } catch { /* corps vide accepté */ }
  const dry = b?.dry === true;
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: prm } = await db.from("pi_params").select("data").eq("id", "main").maybeSingle();
  const params: any = prm?.data || {}, cfg: any = params.caisse_notif_auto || {};
  if (!dry && !(cfg.actif && cfg.serveur)) return json({ ok: true, ignore: "inactif" });

  const dest: string[] = String(cfg.emails || "").split(/[,;\s]+/).filter((x) => MAIL_OK.test(x));
  const ej = cfg.emailjs || {};
  const service = Deno.env.get("EMAILJS_SERVICE_ID") || ej.service, template = Deno.env.get("EMAILJS_TEMPLATE_ID") || ej.template;
  const pub = Deno.env.get("EMAILJS_PUBLIC_KEY") || ej.key, priv = Deno.env.get("EMAILJS_PRIVATE_KEY");
  if (!dry) {
    if (!dest.length) return json({ ok: true, ignore: "sans_destinataire" });
    if (!service || !template || !pub || !priv) return json({ ok: false, error: "emailjs_non_configure" }, 200);
  }

  const seuilH = Math.max(1, Number(cfg.seuil_h) || 24), relanceMs = Math.max(1, Number(cfg.relance_h) || 24) * 3600000, now = Date.now();
  const { data: sess } = await db.from("pi_caisse_sessions").select("id,data").eq("data->>statut", "ouverte");
  const anciennes = (sess || []).filter((s: any) => {
    const d = s.data || {}; if (d.session_technique || !d.ouverte_le) return false;
    return (now - new Date(d.ouverte_le).getTime()) / 3600000 > seuilH;
  });
  if (!anciennes.length) return json({ ok: true, rien: true, dry });

  const { data: deja } = await db.from("caisse_alertes_envoyees").select("session_id,envoye_le").in("session_id", anciennes.map((s: any) => s.id));
  const vu = new Map((deja || []).map((r: any) => [r.session_id, new Date(r.envoye_le).getTime()]));
  const dues = anciennes.filter((s: any) => !vu.has(s.id) || now - (vu.get(s.id) as number) >= relanceMs);
  if (!dues.length) return json({ ok: true, rien: true, dry });

  const { data: caisses } = await db.from("pi_caisses").select("id,data").in("id", [...new Set(dues.map((s: any) => s.data.caisse_id))]);
  const nomCaisse = new Map((caisses || []).map((c: any) => [c.id, c.data?.nom || "?"]));
  const lignes = dues.map((s: any) => {
    const h = Math.round((now - new Date(s.data.ouverte_le).getTime()) / 3600000);
    return `• ${nomCaisse.get(s.data.caisse_id) || "?"} — ouverte le ${dateFr(s.data.ouverte_le)} par ${s.data.ouverte_par || "—"} (${h} h)`;
  });
  if (dry) return json({ ok: true, dry: true, sessions: lignes });

  const soc = params.societe || "ImmoSuite ERP";
  const message = `⚠️ Sessions de caisse ouvertes depuis plus de ${seuilH} h — ${soc}\n\n${lignes.join("\n")}\n\n` +
    "Clôturez-les avec un comptage réel avant d'en ouvrir une autre : une clôture tardive fausse les fonds d'ouverture suivants.";
  let ok = 0;
  for (const to of dest) {
    try {
      const r = await fetch(EMAILJS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        service_id: service, template_id: template, user_id: pub, accessToken: priv,
        template_params: { to_email: to, to_name: "", subject: `⚠️ ${soc} — ${dues.length} caisse(s) ouverte(s) depuis plus de ${seuilH} h`, message, from_name: soc, reply_to: params.email || "" } }) });
      if (r.ok) ok++; else console.error("emailjs", r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.error("emailjs réseau", String(e)); }
  }
  if (ok) await db.from("caisse_alertes_envoyees").upsert(dues.map((s: any) => ({ session_id: s.id, envoye_le: new Date().toISOString() })), { onConflict: "session_id" });
  return json({ ok: true, envoyes: ok, destinataires: dest.length, sessions: dues.length });
});
