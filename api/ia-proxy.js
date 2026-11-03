// api/ia-proxy.js — relais serveur vers l'API Anthropic. La clé (ANTHROPIC_API_KEY, variable Vercel) ne quitte jamais le serveur.
// Sécurité : même origine obligatoire (Origin), 20 requêtes / minute / IP, modèle en liste blanche, max_tokens plafonné,
// seul /v1/messages est relayé, aucune clé ni en-tête client transmis.
const MODELES = ['claude-sonnet-4-20250514'];
const MAX_TOKENS = 4096, LIMITE = 20, FENETRE_MS = 60000, compteurs = new Map();

function memeOrigine(req) {
  const o = req.headers.origin;
  if (!o) return false;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}
function trop(req) {
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim();
  const now = Date.now();
  const l = (compteurs.get(ip) || []).filter(function (t) { return now - t < FENETRE_MS; });
  l.push(now); compteurs.set(ip, l);
  if (compteurs.size > 5000) compteurs.clear();
  return l.length > LIMITE;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  if (!memeOrigine(req)) { res.status(403).json({ error: 'forbidden', message: 'Origine non autorisée.' }); return; }
  if (trop(req)) { res.setHeader('Retry-After', '60'); res.status(429).json({ error: 'too_many_requests' }); return; }
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) { res.status(503).json({ error: 'not_configured', message: 'ANTHROPIC_API_KEY non définie sur Vercel.' }); return; }
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object' || !Array.isArray(b.messages)) { res.status(400).json({ error: 'bad_request' }); return; }
  if (MODELES.indexOf(b.model) < 0) { res.status(400).json({ error: 'bad_request', message: 'Modèle non autorisé.' }); return; }
  const corps = { model: b.model, max_tokens: Math.min(parseInt(b.max_tokens, 10) || 1000, MAX_TOKENS), messages: b.messages };
  if (b.system) corps.system = b.system;
  if (b.tools) corps.tools = b.tools;
  const ctrl = new AbortController();
  const minuteur = setTimeout(function () { ctrl.abort(); }, 55000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cle, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(corps), signal: ctrl.signal
    });
    const t = await r.text();
    res.status(r.status); res.setHeader('Content-Type', 'application/json'); res.send(t);
  } catch (e) {
    res.status(e && e.name === 'AbortError' ? 504 : 502).json({ error: 'gateway_error' });
  } finally { clearTimeout(minuteur); }
};
