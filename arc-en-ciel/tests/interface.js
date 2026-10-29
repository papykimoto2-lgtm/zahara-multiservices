/* Interface : écran de configuration, validation de la clé, mode démonstration, six écrans sans erreur, sécurité des textes (XSS), fichier unique.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node arc-en-ciel/tests/interface.js */
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const http = require("http"), fs = require("fs"), path = require("path"), root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": types[path.extname(f)] || "text/plain" }); r.end(fs.readFileSync(f)); });
let ok = 0, ko = 0; const chk = (id, label, o, info) => { console.log(o === true ? "PASS" : "FAIL", id, label, o === true ? "" : "-> " + (info || o)); o === true ? ok++ : ko++; };
const jwt = o => "x." + Buffer.from(JSON.stringify(o)).toString("base64url") + ".y";
(async () => {
  await new Promise(o => srv.listen(0, "127.0.0.1", o)); const base = "http://127.0.0.1:" + srv.address().port;
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), cx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: "block" }), p = await cx.newPage(), logs = [];
  p.on("console", m => m.type() === "error" && logs.push(m.text())); p.on("pageerror", e => logs.push("PAGEERR " + e.message));
  const txt = async s => (await p.locator(s).innerText()).replace(/\n+/g, " | ");
  await p.goto(base + "/"); await p.waitForSelector("form");
  chk("IF-1", "première ouverture : écran « Connecter la cité » + bouton de démonstration", /Connecter la cité/.test(await txt("#app")) && /Ouvrir la démo/.test(await txt("#app")));
  await p.fill("input[type=url]", "https://exemple.invalid"); await p.fill("input[placeholder^='Clé']", "a.b.c"); await p.click("button[type=submit]");
  chk("IF-2", "URL qui n'est pas un projet Supabase : refusée, rien de mémorisé", /URL Supabase invalide/.test(await p.locator("#toast").innerText()) && !(await p.evaluate(() => localStorage.getItem("arc_cfg"))));
  await p.fill("input[type=url]", "https://" + "abcdefghij0123456789" + ".supabase" + ".co"); await p.fill("input[placeholder^='Clé']", jwt({ role: "service_role" })); await p.click("button[type=submit]");
  chk("IF-3", "clé service_role : refusée (jamais mémorisée dans le navigateur)", /service_role refusée/.test(await p.locator("#toast").innerText()) && !(await p.evaluate(() => localStorage.getItem("arc_cfg"))));
  await p.click("text=Ouvrir la démo"); await p.waitForSelector(".demo");
  chk("IF-4", "démo : bandeau « MODE DÉMONSTRATION » visible", /MODE DÉMONSTRATION/.test(await txt(".demo")));
  const attendus = { "Ma cité": /Reste à payer/, "Finances": /Trésorerie/, "Dépenses": /Seuils de validation/, "Réunions": /Procès-verbaux/, "Documents": /Règlement de copropriété/, "Audit": /Chaîne d'empreintes intacte/ };
  for (const v of Object.keys(attendus)) { await p.click("nav >> text=" + v); await p.waitForTimeout(250); chk("IF-5 " + v, "écran « " + v + " » affiché", attendus[v].test(await txt("main")), (await txt("main")).slice(0, 80)); }
  await p.click("nav >> text=Dépenses"); await p.waitForTimeout(200);
  await p.click("button:has-text('Approuver') >> nth=0"); await p.waitForTimeout(300);
  chk("IF-6", "démo : une écriture (approbation) est refusée avec un message clair", /Mode démonstration/.test(await p.locator("#toast").innerText()));
  chk("IF-7", "pied de page : éditeur et contact issus de marque.js", /Sanix Africa Division Technologies/.test(await txt(".ft")) && /0779181075/.test(await txt(".ft")));
  chk("IF-8", "aucune erreur de console ni violation de CSP", logs.length === 0, JSON.stringify(logs));
  // XSS : un texte hostile s'affiche comme du texte
  await p.evaluate(() => { const U = window.ARC_UI; document.body.appendChild(U.el("div", { id: "x" }, U.el("b", {}, '<img src=x onerror="window.__xss=1">'))); });
  chk("IF-9", "texte hostile affiché comme texte (aucune balise créée)", (await p.evaluate(() => !window.__xss && document.querySelectorAll("#x img").length === 0)) === true);
  // Fichier unique
  await p.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await p.goto(base + "/dist/arc-en-ciel-connect.html"); await p.waitForSelector("form");
  chk("IF-10", "fichier unique dist/ : s'affiche sous CSP par empreintes, sans erreur", /Connecter la cité/.test(await txt("#app")) && logs.length === 0, JSON.stringify(logs));
  // Ouverture par double-clic (file://), sans serveur
  const q = await cx.newPage(); const l2 = []; q.on("pageerror", e => l2.push(e.message));
  await q.goto("file://" + path.join(root, "index.html")); await q.waitForSelector("form");
  chk("IF-11", "index.html ouvert par double-clic (file://) : l'application démarre sans serveur", /Connecter la cité/.test(await q.locator("#app").innerText()) && l2.length === 0, JSON.stringify(l2));
  await b.close(); srv.close(); console.log("\n" + ok + " réussis, " + ko + " échecs"); process.exit(ko ? 1 : 0);
})().catch(e => { console.error("ERREUR", e); process.exit(1); });
