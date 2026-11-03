// api/fne-proxy.js
//
// Passerelle serveur (Vercel Serverless Function) vers l'API FNE de la DGI (Côte d'Ivoire).
// L'ERP est servi en HTTPS : un navigateur refuse d'appeler directement le serveur de test de la DGI
// (HTTP simple, sans en-têtes CORS) — « contenu mixte » / CORS. Cette fonction s'exécute côté serveur,
// où ces restrictions ne s'appliquent pas, et relaie la requête.
//
// Appel de l'ERP :   POST /api/fne-proxy?env=test|production&path=/external/invoices/sign
// Diagnostic :       GET  /api/fne-proxy?ping=1&env=test|production   → { ok, env, configured }
//
// Sécurité :
//   - même origine uniquement, en-tête Origin obligatoire en POST (un autre site ou un script ne peut pas l'utiliser) ;
//   - 120 requêtes POST / minute / IP ; clé API FNE obligatoire ; production en HTTPS uniquement ;
//   - seuls les chemins FNE connus sont relayés (émission et avoir), sans « .. » ni caractère inattendu ;
//   - la clé API (en-tête Authorization) est transmise telle quelle à la DGI : elle n'est ni stockée ni journalisée ;
//   - délai maximal de 25 s vers la DGI (réponse 504 au-delà).
//
// Variables d'environnement Vercel (Project Settings → Environment Variables), à définir puis redéployer :
//   FNE_URL_PROD  = URL de production communiquée par la DGI (support.fne@dgi.gouv.ci) — obligatoire pour la production
//   FNE_URL_TEST  = (facultatif) remplace l'URL de test par défaut http://54.247.95.108/ws

const FNE_HOSTS = {
  test: process.env.FNE_URL_TEST || 'http://54.247.95.108/ws',
  production: process.env.FNE_URL_PROD || ''
};

// Émission : /external/invoices/sign — Avoir : /external/invoices/<identifiant>/refund
const CHEMIN_AUTORISE = /^\/external\/invoices\/(sign|[A-Za-z0-9_-]{1,64}\/refund)$/;
const DELAI_MS = 25000;

// Origine obligatoire pour POST (les navigateurs l'envoient toujours en POST same-origin) : refuse curl/scripts serveur.
// GET ?ping=1 reste permis sans Origin (diagnostic, aucune donnée).
function memeOrigine(req) {
  const o = req.headers.origin;
  if (!o) return req.method === 'GET' || req.method === 'OPTIONS';
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

// Limitation de débit par IP (fenêtre glissante 60 s, en mémoire de l'instance — complète, ne remplace pas, une règle WAF Vercel).
const LIMITE = 120, FENETRE_MS = 60000, compteurs = new Map();
function trop(req) {
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim();
  const now = Date.now();
  const l = (compteurs.get(ip) || []).filter(function (t) { return now - t < FENETRE_MS; });
  l.push(now);
  compteurs.set(ip, l);
  if (compteurs.size > 5000) compteurs.clear();
  return l.length > LIMITE;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!memeOrigine(req)) { res.status(403).json({ error: 'forbidden', message: 'Origine non autorisée.' }); return; }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'POST' && trop(req)) { res.setHeader('Retry-After', '60'); res.status(429).json({ error: 'too_many_requests', message: 'Trop de requêtes. Réessayez dans 1 minute.' }); return; }

  const env = String((req.query && req.query.env) || 'test');
  const base = FNE_HOSTS[env];

  if (req.method === 'GET') {
    if (req.query && req.query.ping) { res.status(200).json({ ok: true, env: env, configured: !!base }); return; }
    res.status(405).json({ error: 'method_not_allowed', message: 'Utilisez POST (ou GET ?ping=1).' });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed', message: 'Seul POST est supporté.' }); return; }

  const chemin = String((req.query && req.query.path) || '');
  if (!(env in FNE_HOSTS)) { res.status(400).json({ error: 'bad_request', message: 'Environnement FNE inconnu : ' + env }); return; }
  if (!base) {
    res.status(400).json({ error: 'bad_request', message: 'URL de production non configurée côté serveur (variable FNE_URL_PROD manquante sur Vercel).' });
    return;
  }
  if (env === 'production' && !/^https:\/\//i.test(base)) { res.status(400).json({ error: 'bad_request', message: 'FNE_URL_PROD doit être en HTTPS.' }); return; }
  if (!req.headers['authorization']) { res.status(401).json({ error: 'unauthorized', message: 'Clé API FNE (Authorization) requise.' }); return; }
  if (!CHEMIN_AUTORISE.test(chemin)) { res.status(400).json({ error: 'bad_request', message: 'Chemin non autorisé.' }); return; }

  const ctrl = new AbortController();
  const minuteur = setTimeout(function () { ctrl.abort(); }, DELAI_MS);
  try {
    const corps = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const upstream = await fetch(base.replace(/\/$/, '') + chemin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': req.headers['authorization'] || '' },
      body: corps,
      signal: ctrl.signal
    });
    const texte = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(texte);
  } catch (e) {
    if (e && e.name === 'AbortError') res.status(504).json({ error: 'gateway_timeout', message: 'La plateforme FNE (' + env + ') n\'a pas répondu en ' + (DELAI_MS / 1000) + ' s.' });
    else res.status(502).json({ error: 'bad_gateway', message: 'Impossible de joindre la plateforme FNE (' + env + ') : ' + (e && e.message ? e.message : String(e)) });
  } finally {
    clearTimeout(minuteur);
  }
};
