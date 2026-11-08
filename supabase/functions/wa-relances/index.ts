// ═════════════════════════════════════════════════════════════════
// Edge Function : wa-relances — envoi des relances WhatsApp (Cloud API) avec lien de paiement.
// Déploiement : supabase functions deploy wa-relances            (verify_jwt ACTIVÉ : jeton du personnel exigé)
// Secrets     : WA_TOKEN (jeton permanent Meta), WA_PHONE_ID (identifiant du numéro d'envoi),
//               WA_LANG (défaut fr), WA_GRAPH_VERSION (défaut v21.0). SB_URL / SERVICE_ROLE_KEY comme caisse-alertes.
// Réglages    : pi_params(id « main») → data.wa_relances = { actif, provider:'cinetpay'|'paydunya', devise:'XOF', societe }
// Entrée      : POST { items:[{ client_id, palier:'J-3'|'J0'|'J3'|'J10', cycle:'AAAA-MM-JJ', montant, mois_retard }], dry? }
// Sécurité    : le numéro et le nom viennent de pi_clients (jamais du client) ; désinscrits exclus ;
//               anti-doublon par (client, cycle, palier) ; ≥ 3 mois de retard refusé ; 100 envois max par appel.
// ═════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_TOKEN = Deno.env.get("WA_TOKEN"), WA_PHONE = Deno.env.get("WA_PHONE_ID");
const GRAPH = Deno.env.get("WA_GRAPH_VERSION") || "v21.0", LANG = Deno.env.get("WA_LANG") || "fr";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const TEMPLATES: Record<string, string> = { "J-3": "rel_j_moins3", "J0": "rel_j0", "J3": "rel_j3", "J10": "rel_j10" };
const MAX_ITEMS = 100, MAX_MOIS_AUTO = 3, PAUSE_MS = 250;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function claims(req: Request): Record<string, unknown> {
  try { return JSON.parse(atob((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch { return {}; }
}
function tel(raw: unknown): string {
  const d = String(raw ?? "").replace(/[\s.\-()\/]/g, "");
  if (/[^0-9+]/.test(d)) return "";
  const c = (d.startsWith("00") ? d.slice(2) : d).replace(/\D/g, "");
  if (d.startsWith("+") || d.startsWith("00")) return c.length >= 8 && c.length <= 15 ? c : "";
  if (c.length === 10) return "225" + c;
  return c.length === 13 && c.startsWith("225") ? c : "";
}
const fcfa = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lien(prov: string, devise: string, c: any, it: any, cid: string, ref: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/pay-initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ provider: prov, ref, transaction_id: ref, client_id: cid, client_nom: `${c.nom || ""} ${c.prenoms || ""}`.trim(),
      client_tel: String(c.tel || ""), client_email: String(c.email || ""), montant: it.montant, type: "mensualite",
      description: `Échéance ${c.dossier || ""}`.trim(), devise }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.payment_url) throw new Error("lien_paiement: " + (d.error || r.status));
  return { url: d.payment_url as string, tx: (d.transaction_id || ref) as string };
}

async function envoyer(to: string, template: string, params: string[]) {
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${WA_PHONE}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: LANG },
      components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] } }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.messages?.[0]?.id) throw new Error("whatsapp: " + (d?.error?.message || r.status));
  return d.messages[0].id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const cl = claims(req);
  if (!cl.app_role) return json({ ok: false, error: "reserve_au_personnel" }, 403);   // refuse portail / anon
  let b: any; try { b = await req.json(); } catch { return json({ ok: false, error: "json" }, 400); }
  const items: any[] = Array.isArray(b?.items) ? b.items : [];
  if (!items.length) return json({ ok: true, resultats: [] });
  if (items.length > MAX_ITEMS) return json({ ok: false, error: "trop_d_envois", max: MAX_ITEMS }, 400);
  const dry = b?.dry === true;
  if (!dry && (!WA_TOKEN || !WA_PHONE)) return json({ ok: false, error: "whatsapp_non_configure" }, 200);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: prm } = await db.from("pi_params").select("data").eq("id", "main").maybeSingle();
  const params: any = prm?.data || {}, cfg: any = params.wa_relances || {};
  if (!dry && !cfg.actif) return json({ ok: false, error: "inactif" }, 200);
  const prov = cfg.provider === "paydunya" ? "paydunya" : "cinetpay", devise = cfg.devise || "XOF";
  const societe = cfg.societe || params.societe || "Zahara";

  const ids = [...new Set(items.map((i) => String(i?.client_id || "")).filter(Boolean))];
  const { data: rows } = await db.from("pi_clients").select("id,data").in("id", ids);
  const clients = new Map((rows || []).filter((r: any) => r.data?._deleted !== true).map((r: any) => [r.id, r.data]));

  const res: any[] = [];
  for (const it of items) {
    const out = (statut: string, extra: Record<string, unknown> = {}) => res.push({ client_id: it?.client_id, palier: it?.palier, statut, ...extra });
    const cid = String(it?.client_id || ""), palier = String(it?.palier || ""), cycle = String(it?.cycle || "");
    const montant = Math.round(Number(it?.montant)), mois = Math.max(0, Math.round(Number(it?.mois_retard) || 0));
    if (!cid || !TEMPLATES[palier] || !ISO.test(cycle) || !(montant >= 100 && montant <= 100_000_000)) { out("refuse", { raison: "donnees_invalides" }); continue; }
    if (mois >= MAX_MOIS_AUTO) { out("refuse", { raison: "escalade_humaine" }); continue; }
    const c: any = clients.get(cid);
    if (!c) { out("refuse", { raison: "client_introuvable" }); continue; }
    const to = tel(c.tel);
    if (!to) { out("refuse", { raison: "telephone_invalide" }); continue; }
    const { data: stop } = await db.from("wa_optout").select("tel").eq("tel", to).maybeSingle();
    if (stop) { out("ignore", { raison: "desinscrit" }); continue; }
    if (dry) { out("simulation", { tel: to, template: TEMPLATES[palier] }); continue; }

    // Réservation anti-doublon : une ligne par (client, cycle, palier) ; un échec antérieur peut être rejoué.
    const { data: ex } = await db.from("wa_relances_log").select("id,statut").eq("client_id", cid).eq("cycle", cycle).eq("palier", palier).maybeSingle();
    if (ex && ex.statut !== "echec") { out("ignore", { raison: "deja_envoye" }); continue; }
    const ligne = { client_id: cid, palier, cycle, tel: to, montant, mois_retard: mois, template: TEMPLATES[palier], statut: "en_cours",
      erreur: null, envoye_par: String(cl.login || cl.sub || ""), maj_le: new Date().toISOString() };
    let logId = ex?.id as string | undefined;
    if (logId) await db.from("wa_relances_log").update(ligne).eq("id", logId);
    else {
      const ins = await db.from("wa_relances_log").insert(ligne).select("id").single();
      if (ins.error) { out("ignore", { raison: "deja_envoye" }); continue; }   // course : violation d'unicité
      logId = ins.data.id;
    }
    try {
      const ref = `WAR-${cid.slice(-6)}-${cycle.replaceAll("-", "")}-${palier.replace("-", "m")}-${Date.now().toString(36)}`.slice(0, 60);
      const p = await lien(prov, devise, c, { montant }, cid, ref);
      const dossier = [c.dossier, c.lot_numero ? `lot ${c.lot_numero}` : ""].filter(Boolean).join(" ") || "votre dossier";
      const wamid = await envoyer(to, TEMPLATES[palier], [String(c.prenoms || c.nom || "").trim() || "Client", fcfa(montant), dossier, p.url, societe]);
      await db.from("wa_relances_log").update({ statut: "envoye", wa_message_id: wamid, payment_url: p.url, transaction_id: p.tx, maj_le: new Date().toISOString() }).eq("id", logId);
      out("envoye", { wa_message_id: wamid, payment_url: p.url });
    } catch (e) {
      const msg = String((e as Error).message || e).slice(0, 300);
      await db.from("wa_relances_log").update({ statut: "echec", erreur: msg, maj_le: new Date().toISOString() }).eq("id", logId!);
      out("echec", { erreur: msg });
    }
    await sleep(PAUSE_MS);
  }
  return json({ ok: true, dry, resultats: res });
});
