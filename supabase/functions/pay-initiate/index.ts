// supabase/functions/pay-initiate/index.ts
// Génère un lien de paiement (CinetPay / PayDunya) et crée la ligne pi_paiements_online (statut pending).
// Secrets EXCLUSIVEMENT côté serveur (Deno.env). Aucune clé n'est exposée au client.
// Deploy : supabase functions deploy pay-initiate --no-verify-jwt   (webhook idem)
//   Le client appelle avec l'anon key (RLS) — l'écriture cloud passe par SERVICE_ROLE.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_BASE = `${SB_URL}/functions/v1`;
const RETURN_URL = Deno.env.get("APP_RETURN_URL") || "";

async function sbUpsert(row: Record<string, unknown>) {
  await fetch(`${SB_URL}/rest/v1/pi_paiements_online?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: SRV, Authorization: `Bearer ${SRV}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
}

async function cinetpay(b: any) {
  const apikey = Deno.env.get("CINETPAY_APIKEY")!;
  const site_id = Deno.env.get("CINETPAY_SITE_ID")!;
  const r = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey, site_id,
      transaction_id: b.transaction_id,
      amount: b.montant,
      currency: b.devise || "XOF",
      description: b.description || b.ref || "Paiement ImmoSuite",
      customer_name: b.client_nom || "Client",
      customer_phone_number: b.client_tel || "",
      customer_email: b.client_email || "",
      channels: "ALL",
      notify_url: `${FN_BASE}/pay-webhook`,
      return_url: b.return_url || RETURN_URL || `${FN_BASE}/pay-webhook`,
      metadata: b.scope_id || "",
    }),
  });
  const d = await r.json();
  if (String(d?.code) !== "201" || !d?.data?.payment_url) {
    throw new Error(`CinetPay: ${d?.message || d?.description || "init refusée"}`);
  }
  return { payment_url: d.data.payment_url as string, token: d.data.payment_token as string };
}

async function paydunya(b: any) {
  const mode = (Deno.env.get("PAYDUNYA_MODE") || "live").toLowerCase();
  const base = mode === "test" ? "https://app.paydunya.com/sandbox-api/v1" : "https://app.paydunya.com/api/v1";
  const H = {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": Deno.env.get("PAYDUNYA_MASTER_KEY")!,
    "PAYDUNYA-PRIVATE-KEY": Deno.env.get("PAYDUNYA_PRIVATE_KEY")!,
    "PAYDUNYA-TOKEN": Deno.env.get("PAYDUNYA_TOKEN")!,
  };
  const r = await fetch(`${base}/checkout-invoice/create`, {
    method: "POST", headers: H,
    body: JSON.stringify({
      invoice: { total_amount: b.montant, description: b.description || b.ref },
      store: { name: Deno.env.get("PAYDUNYA_STORE") || "SANIX Immo" },
      actions: { callback_url: `${FN_BASE}/pay-webhook`, return_url: b.return_url || RETURN_URL },
      custom_data: { transaction_id: b.transaction_id, scope_id: b.scope_id || "" },
    }),
  });
  const d = await r.json();
  if (String(d?.response_code) !== "00" || !d?.response_text) {
    throw new Error(`PayDunya: ${d?.response_text || "init refusée"}`);
  }
  return { payment_url: d.response_text as string, token: d.token as string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const b = await req.json();
    if (!b.montant || b.montant < 100) return json({ error: "montant invalide" }, 400);
    const tx = b.transaction_id || (b.ref ? b.ref : "POL-" + Date.now());
    b.transaction_id = tx;
    const g = (b.provider === "paydunya") ? await paydunya(b) : await cinetpay(b);
    const now = new Date().toISOString();
    await sbUpsert({
      id: tx,
      scope_id: b.scope_id || "",
      updated_at: now,
      data: {
        id: tx, transaction_id: tx, provider: b.provider || "cinetpay",
        client_id: b.client_id || "", client_tel: b.client_tel || "",
        montant: b.montant, type: b.type || "mensualite", description: b.description || "",
        payment_url: g.payment_url, gateway_token: g.token || "",
        statut: "pending", ref: b.ref || tx, cree_le: now, reconcilie: false,
        // Rattachement diaspora : impose le routage comptable en séquestre (4191)
        // côté ERP au lieu d'un encaissement de produit ordinaire.
        dossier_diaspo_id: b.dossier_diaspo_id || "",
        devise: b.devise || "XOF",
        scope_id: b.scope_id || "", _modifie: now,
      },
    });
    return json({ transaction_id: tx, payment_url: g.payment_url });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
