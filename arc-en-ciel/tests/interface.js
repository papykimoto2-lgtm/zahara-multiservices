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
  chk("IF-4b", "accueil « Aujourd'hui » : salutation, alertes et pastille", /Bonjour/.test(await txt("main")) && /Alertes/.test(await txt("main")) && /Mode démonstration/.test(await txt(".pill >> nth=0")));
  await p.click("main .al >> text=Je m'en occupe >> nth=0"); await p.waitForTimeout(200);
  chk("IF-4a", "style Angel's : bandeau dégradé, horloge, recherche et pastille « Passerelle » présents", (await p.locator("main .ban").count()) === 1 && (await p.locator(".hor #hl").count()) === 1 && (await p.locator("button.rech").count()) === 1 && (await p.locator(".pill.flo").count()) === 1
    && /linear-gradient/.test(await p.evaluate(() => getComputedStyle(document.querySelector(".ban")).backgroundImage)));
  chk("IF-4e", "bandeau : les indicateurs chevauchent le dégradé (classe ov + kp)", (await p.locator("main .ban.ov").count()) === 1 && (await p.locator("main .grid.kp").count()) === 1);
  await p.keyboard.press("/"); chk("IF-4f", "raccourci « / » : recherche d'écran ouverte, Entrée ouvre le premier résultat", await p.locator(".ov-rech input").count() === 1);
  await p.fill(".ov-rech input", "carte"); await p.keyboard.press("Enter"); await p.waitForSelector("main svg", { timeout: 5000 }).catch(() => {});
  chk("IF-4g", "recherche « carte » → écran Carte", /Carte de la cité/.test(await txt("main")));
  await p.keyboard.press("/"); await p.fill(".ov-rech input", "aujourd"); await p.keyboard.press("Enter"); await p.waitForSelector("main .al", { timeout: 5000 }).catch(() => {});
  chk("IF-4c", "alerte : « Je m'en occupe » la marque prise en charge (mémorisé)", /pris en charge/.test(await txt("main")));
  await p.setViewportSize({ width: 390, height: 800 }); await p.click("button[aria-label=Menu]");
  chk("IF-4d", "mobile : le bouton ☰ ouvre le menu latéral", await p.locator(".shell.open").count() === 1); const va = async v => { if (!(await p.locator(".shell.open").count())) await p.click("button[aria-label=Menu]"); await p.click("nav >> text=" + v); await p.waitForTimeout(250); };
  let txt0 = ""; const attendus = { "Ma cité": /Reste à payer|Mes cotisations/, "Argent": /Trésorerie/, "Dépenses": /Seuils de validation/, "Réunions": /Procès-verbaux/, "Documents": /Règlement de copropriété/, "Audit": /Chaîne d'empreintes intacte/,
    "Projets": /Remise en état de l'éclairage/, "Participation": /Priorité d'investissement 2027/, "Réclamations": /Caniveau bouché/, "Solidarité": /solde du fonds/,
    "Carte": /Carte de la cité/, "Prévisions": /Plan pluriannuel/, "Assurances": /Contrats d'assurance/, "Enquêtes": /Satisfaction 2026/, "Administration": /Membres \(/ };
  for (const v of Object.keys(attendus)) { await va(v); chk("IF-5 " + v, "écran « " + v + " » affiché", attendus[v].test(await txt("main")), (await txt("main")).slice(0, 80)); }
  await va("Dépenses");
  await p.click("button:has-text('Approuver') >> nth=0"); await p.waitForTimeout(300);
  chk("IF-6", "démo : une écriture (approbation) est refusée avec un message clair", /Mode démonstration/.test(await p.locator("#toast").innerText()));
  await va("Participation");
  chk("IF-6b", "démo : un vote est refusé avec un message clair (aucune écriture)", await (async () => { await p.click("input[type=radio] >> nth=0"); await p.click("button:has-text('Voter (secret')"); await p.waitForTimeout(250); return /Mode démonstration/.test(await p.locator("#toast").innerText()); })());
  await va("Carte");
  chk("IF-6d", "carte : points géolocalisés tracés (SVG), sans donnée personnelle", (await p.locator("main svg circle").count()) === 4 && !/Kouassi|déclarant/i.test(await txt("main")));
  await p.click("main svg circle >> nth=3"); chk("IF-6e", "carte : toucher un point affiche son détail et le lien OpenStreetMap", /INC-2026-000008/.test(await txt("main")) && (await p.locator("main a[href*=openstreetmap]").count()) === 1);
  await va("Prévisions"); await p.fill("input[placeholder^='Coût du projet']", "2000000"); await p.click("button:has-text('Simuler')"); await p.waitForTimeout(300);
  chk("IF-6f", "prévisions : 3 scénarios affichés et marqués « PROJECTION »", /PROJECTION/.test(await txt("main")) && /Prudent/.test(await txt("main")) && /Réaliste/.test(await txt("main")) && /Ambitieux/.test(await txt("main")));
  chk("IF-6g", "aide à la décision : constats par règles, avec la mention « ne décide de rien »", /Aide à la décision/.test(await txt("main")) && /ne décide de rien/.test(await txt("main")));
  await va("Enquêtes"); await p.click("button:has-text('Voir les résultats')"); await p.waitForTimeout(250);
  chk("IF-6h", "enquêtes : résultats masqués sous 5 réponses (anonymat)", /au moins 5 réponses/.test(await p.locator("#toast").innerText()));
  await va("Administration"); txt0 = await txt("main .tabs");
  chk("IF-6i", "administration : rubriques réservées aux rôles (membres, réunions, annonces, banque)", ["Membres et lots", "Réunions et PV", "Annonces et rappels", "Rapprochement bancaire"].every(x => new RegExp(x).test(txt0)), "");
  await va("Argent");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("button:has-text('⬇ CSV') >> nth=0")]); const csvTxt = fs.readFileSync(await dl.path(), "utf8");
  chk("IF-6j", "export CSV : fichier .csv, BOM Excel, séparateur « ; », en-têtes en français", /\.csv$/.test(dl.suggestedFilename()) && csvTxt.charCodeAt(0) === 0xfeff && /^\ufeffDate;Réf\.;Catégorie/.test(csvTxt), csvTxt.slice(0, 60));
  const [d2] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => ARC_EXPORT.csv("piege", [{ t: "A", k: "a" }], [{ a: '=HYPERLINK("x")' }, { a: "-12" }, { a: "@cmd" }]))]); const piege = fs.readFileSync(await d2.path(), "utf8");
  chk("IF-6k", "export : formules neutralisées (« ' » devant = et @), nombres négatifs conservés", /'=HYPERLINK/.test(piege) && /'@cmd/.test(piege) && /\r\n-12\r\n/.test(piege), JSON.stringify(piege));
  await p.evaluate(() => { window.print = () => { window.__imprime = 1; }; });
  await p.click("button:has-text('Imprimer / PDF') >> nth=0"); await p.waitForTimeout(400);
  chk("IF-6l", "impression : pied d'intégrité avec référence, empreinte SHA-256 et QR", await p.evaluate(() => !!window.__imprime && !!document.querySelector("#pied-print svg") && /Empreinte SHA-256 : [0-9a-f]{64}/.test(document.querySelector("#pied-print").textContent) && /non signé/.test(document.querySelector("#pied-print").textContent)));
  await va("Solidarité");
  chk("IF-6c", "solidarité : aide publiée sans identité (montant et date seulement)", /90 000 F/.test(await txt("main")) && !/Dossier fictif/.test(await txt("main").then(t => t.split("Aides accordées par la cité")[1].split("Demander une aide")[0])));
  chk("IF-7", "pied de page : éditeur et contact issus de marque.js", /Sanix Africa Division Technologies/.test(await txt(".dev")) && /0779181075/.test(await txt(".dev")));
  chk("IF-8", "aucune erreur de console ni violation de CSP", logs.length === 0, JSON.stringify(logs));
  // XSS : un texte hostile s'affiche comme du texte
  await p.evaluate(() => { const U = window.ARC_UI; document.body.appendChild(U.el("div", { id: "x" }, U.el("b", {}, '<img src=x onerror="window.__xss=1">'))); });
  chk("IF-9", "texte hostile affiché comme texte (aucune balise créée)", (await p.evaluate(() => !window.__xss && document.querySelectorAll("#x img").length === 0)) === true);
  chk("IF-9b", "el() : tableaux imbriqués suivis d'éléments frères conservés dans l'ordre (régression)", await p.evaluate(() => { const U = window.ARC_UI; return U.el("div", {}, [U.el("i", {}, "a"), U.el("i", {}, "b")], U.el("i", {}, "c"), [[U.el("i", {}, "d")]], U.el("i", {}, "e")).textContent === "abcde"; }));
  // Signature numérique : création de clé, signature, registre simulé, puis vérification publique (verifier.html)
  const reg = { cles: {}, docs: {} };
  await p.exposeFunction("__rpc", async (fn, a) => {
    if (fn === "enregistrer_cle") { if (a.p_jwk.d) throw { message: "clé privée refusée" }; reg.cles[a.p_kid] = { jwk: a.p_jwk, fonction: a.p_fonction, revoquee_le: null }; return null; }
    if (fn === "enregistrer_signature") { reg.docs[a.p_ref] = { ref: a.p_ref, hash: a.p_hash, kid: a.p_kid, signature: a.p_signature, canon: a.p_canon, titre: a.p_titre, signe_le: new Date().toISOString() }; return null; }
    return null; });
  await p.evaluate(() => { ARC_API.rpc = (fn, a) => window.__rpc(fn, a); ARC_APP.S.user = { id: "u-test" }; ARC_API.enDemo = false; });
  const sg = await p.evaluate(async () => { try { await ARC_SIGN.creer("Trésorier"); const r = await ARC_SIGN.signer("Bilan test", "contenu du bilan"); return r; } catch (e) { return { erreur: JSON.stringify(e) + String(e && e.message) }; } });
  chk("IF-12", "signature : clé ECDSA créée (publique seule envoyée), document signé, référence + QR produits", !sg.erreur && /^ARC-\d{8}-[0-9A-F]{6}[0-9A-F]{4}$/.test(sg.ref) && sg.sig.length === 86 && /verifier\.html#/.test(sg.qr) && !JSON.stringify(reg.cles).includes('"d"'), JSON.stringify(sg).slice(0, 200));
  const kidReg = reg.cles[sg.kid];
  const srvV = (rec) => async (route) => { const b = JSON.parse(route.request().postData() || "{}"); const d = reg.docs[b.p_ref], k = d && (rec || reg.cles)[d.kid]; await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(d ? Object.assign({}, d, { jwk: k.jwk, fonction: k.fonction, revoquee_le: k.revoquee_le, motif_revocation: k.motif_revocation || null }) : { inconnu: true }) }); };
  const q2 = await cx.newPage(); await q2.addInitScript(u => localStorage.setItem("arc_cfg", JSON.stringify({ url: u, anonKey: "a.b.c" })), "https://" + "abcdefghij0123456789" + ".supabase" + ".co");
  await q2.route("https://" + "abcdefghij0123456789" + ".supabase" + ".co/**", async (route) => { if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST" } }); return srvV()(route); });
  const lien = sg.qr.replace(/^.*verifier\.html/, base + "/verifier.html");
  await q2.goto(lien); await q2.waitForSelector("#res h2");
  chk("IF-13", "vérification publique : QR authentique → « Document authentique » (signature ECDSA valide, clé non révoquée)", /Document authentique/.test(await q2.locator("#res").innerText()) && /Signature ECDSA P-256 valide/.test(await q2.locator("#res").innerText()) && /Trésorier/.test(await q2.locator("#res").innerText()), await q2.locator("#res").innerText());
  const altere = lien.replace(/#([^.]+)\.([0-9a-f]{64})/, (m, r, h) => "#" + r + "." + (h[0] === "a" ? "b" : "a") + h.slice(1));
  await q2.goto(altere); await q2.reload(); await q2.waitForSelector("#res h2");
  chk("IF-14", "vérification publique : empreinte altérée dans le QR → rejet explicite", /NON reconnu/.test(await q2.locator("#res").innerText()) && /empreinte/i.test(await q2.locator("#res").innerText()), await q2.locator("#res").innerText());
  const faux = lien.replace(/\.[A-Za-z0-9_-]{86}$/, "." + "A".repeat(86));
  await q2.goto(faux); await q2.reload(); await q2.waitForSelector("#res h2");
  chk("IF-15", "vérification publique : signature falsifiée → rejet explicite", /NON reconnu/.test(await q2.locator("#res").innerText()), await q2.locator("#res").innerText());
  await q2.goto(base + "/verifier.html#" + "ARC-20260101-AAAAAA" + "." + "a".repeat(64) + "." + sg.kid + "." + sg.sig); await q2.reload(); await q2.waitForSelector("#res h2");
  chk("IF-16", "vérification publique : référence absente du registre → « non inscrit »", /pas inscrit au registre/.test(await q2.locator("#res").innerText()));
  kidReg.revoquee_le = new Date(Date.now() + 86400000).toISOString(); kidReg.motif_revocation = "Perte de l'appareil";
  await q2.goto(lien); await q2.reload(); await q2.waitForSelector("#res h2");
  chk("IF-17", "vérification publique : clé révoquée APRÈS la signature → authentique mais signalé", /à lire avec attention/.test(await q2.locator("#res").innerText()) && /AVANT cette révocation/.test(await q2.locator("#res").innerText()), await q2.locator("#res").innerText());
  kidReg.revoquee_le = new Date(Date.now() - 86400000).toISOString();
  await q2.goto(lien); await q2.reload(); await q2.waitForSelector("#res h2");
  chk("IF-18", "vérification publique : signature postérieure à la révocation → rejet", /NON reconnu/.test(await q2.locator("#res").innerText()) && /APRÈS la révocation/.test(await q2.locator("#res").innerText()), await q2.locator("#res").innerText());
  await p.evaluate(() => { window.print = () => { window.__imprime2 = 1; }; });
  await p.evaluate(() => ARC_EXPORT.imprimer("Test signé", "contenu imprimé")); await p.waitForTimeout(300);
  chk("IF-19", "impression : avec clé de signature, le pied annonce un document SIGNÉ NUMÉRIQUEMENT", await p.evaluate(() => /SIGNÉ NUMÉRIQUEMENT/.test((document.querySelector("#pied-print") || { textContent: "" }).textContent)));
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
