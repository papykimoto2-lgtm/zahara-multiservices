/* Assemble l'application en UN SEUL fichier HTML autonome (dist/arc-en-ciel-connect.html).
   CSP : scripts et styles en ligne autorisés uniquement par empreinte SHA-256 ; rien d'externe hors Supabase. */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const R = f => fs.readFileSync(path.join(__dirname, f), "utf8");
const h = s => "'sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64") + "'";
const strip = s => s.replace(/^import .*$/gm, "").replace(/^export /gm, "");
const code = [strip(R("js/ui.js")), strip(R("js/api.js")), strip(R("js/app.js")).replace(/if \("serviceWorker" in navigator\).*\n/, "")].join("\n");
const css = R("css/app.css"), vendor = R("vendor/supabase-js-2.45.4.js").replace('if(!e)throw new Error("Automatic publicPath is not supported in this browser")', 'if(!e)e="/"')   /* script en ligne : pas de chemin de chargement paresseux */, cfg = R("config.js");
const logo = "data:image/svg+xml;base64," + Buffer.from(R("icons/logo.svg")).toString("base64");
const jsLogo = code.split('"icons/logo.svg"').join(JSON.stringify(logo));
const csp = `default-src 'none'; script-src ${h(vendor)} ${h(cfg)} ${h(jsLogo)}; style-src ${h(css)}; img-src data:; connect-src https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'none'; form-action 'none'`;
const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#0b3d91">
<link rel="icon" href="${logo}"><title>Arc-en-Ciel Connect</title><style>${css}</style></head>
<body><div id="app"><p class="mu">Chargement…</p></div><noscript>JavaScript est nécessaire pour utiliser Arc-en-Ciel Connect.</noscript>
<script>${vendor}</script><script>${cfg}</script><script type="module">${jsLogo}</script></body></html>
`;
fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "dist/arc-en-ciel-connect.html"), html);
console.log("OK", (html.length / 1024).toFixed(0) + " Ko");
