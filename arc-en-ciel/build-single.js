/* Assemble l'application en UN SEUL fichier HTML autonome (dist/arc-en-ciel-connect.html), à envoyer par WhatsApp ou ouvrir sur téléphone.
   CSP : scripts et styles en ligne autorisés uniquement par empreinte SHA-256 ; rien d'externe hors Supabase.  Usage : node arc-en-ciel/build-single.js */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const R = f => fs.readFileSync(path.join(__dirname, f), "utf8");
const h = s => "'sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64") + "'";
const png = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "icons/arc-192.png")).toString("base64");
const code = ["marque.js", "ui-engine.js", "demo-engine.js", "api-engine.js", "arc-engine.js", "participation-engine.js", "projets-engine.js", "solidarite-engine.js"].map(R).join("\n").split("icons/arc-192.png").join(png);
const css = R("modules.css");
/* script en ligne : pas de chemin de chargement paresseux pour supabase-js */
const vendor = R("vendor/supabase-js-2.45.4.js").replace('if(!e)throw new Error("Automatic publicPath is not supported in this browser")', 'if(!e)e="/"');
const cfg = R("config.js");
const csp = `default-src 'none'; script-src ${h(vendor)} ${h(cfg)} ${h(code)}; style-src ${h(css)}; img-src data:; connect-src https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'none'; form-action 'none'`;
const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#0b3d91">
<link rel="icon" href="${png}"><title>Arc-en-Ciel Connect</title><style>${css}</style></head>
<body><div id="app"><p class="mu">Chargement…</p></div><noscript>JavaScript est nécessaire pour utiliser Arc-en-Ciel Connect.</noscript>
<script>${vendor}</script><script>${cfg}</script><script>${code}</script></body></html>
`;
fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "dist/arc-en-ciel-connect.html"), html);
console.log("OK", (html.length / 1024).toFixed(0) + " Ko");
