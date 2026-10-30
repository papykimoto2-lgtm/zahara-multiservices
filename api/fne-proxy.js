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
//   - même origine uniquement (un autre site ne peut pas utiliser cette passerelle) ;
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

function memeOrigine(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!memeOrigine(req)) { res.status(403).json({ error: 'forbidden', message: 'Origine non autorisée.' }); return; }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

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
