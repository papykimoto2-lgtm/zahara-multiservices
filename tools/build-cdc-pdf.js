/* Génère docs/CAHIER_DES_CHARGES_ARC_EN_CIEL_CONNECT.pdf depuis le .md.
   Marque Sanix Africa Division Technologies : logo, contact, filigrane SPÉCIMEN, cachet numérique, QR de sécurité (empreinte SHA-256).
   Usage : node tools/build-cdc-pdf.js   (requiert pandoc, playwright) */
const fs = require("fs"), path = require("path"), crypto = require("crypto"), cp = require("child_process"), os = require("os");
const { chromium } = require("playwright");
const qrcode = require("./vendor/qrcode.js");

const DOCS = path.join(__dirname, "..", "docs"), NOM = "CAHIER_DES_CHARGES_ARC_EN_CIEL_CONNECT";
const MD = path.join(DOCS, NOM + ".md"), PDF = path.join(DOCS, NOM + ".pdf");
const TEL = "+225 0779181075 / 0140017751", VERSION = "1.0", DATE = new Date().toISOString().slice(0, 10);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const md = fs.readFileSync(MD);
const sha = crypto.createHash("sha256").update(md).digest("hex");
const code = sha.slice(0, 12).toUpperCase().replace(/(.{4})/g, "$1-").slice(0, -1);
const ref = "SANIX-CDC-ARC-" + DATE.replace(/-/g, "") + "-" + sha.slice(0, 6).toUpperCase();
const payload = ["SANIX-AFRICA", "SPECIMEN", ref, "v" + VERSION, DATE, "sha256:" + sha].join("|");
const q = qrcode(0, "M"); q.addData(payload); q.make();
const qrSvg = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
const logo = fs.readFileSync(path.join(DOCS, "marque", "sanix-logo.svg"), "utf8");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cdc-"));
const corps = cp.execFileSync("pandoc", ["-f", "markdown+lists_without_preceding_blankline", "-t", "html"], { input: md }).toString();

const cachet = `<svg viewBox="0 0 200 200" width="132" height="132"><defs><path id="c" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0"/></defs>
<circle cx="100" cy="100" r="94" fill="none" stroke="#0b3d91" stroke-width="4"/><circle cx="100" cy="100" r="58" fill="none" stroke="#0b3d91" stroke-width="2"/>
<text font-family="Arial" font-weight="700" font-size="15" fill="#0b3d91" letter-spacing="2"><textPath href="#c" startOffset="2%">SANIX AFRICA · DIVISION TECHNOLOGIES · CACHET NUMÉRIQUE ·</textPath></text>
<text x="100" y="92" text-anchor="middle" font-family="Arial" font-weight="700" font-size="17" fill="#0b3d91">SANIX</text>
<text x="100" y="112" text-anchor="middle" font-family="Arial" font-weight="700" font-size="17" fill="#0b3d91">AFRICA</text>
<text x="100" y="130" text-anchor="middle" font-family="Arial" font-size="10" fill="#0b3d91">${esc(DATE)}</text></svg>`;

const css = `
@page{size:A4;margin:16mm 14mm 20mm}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:10.5pt/1.45 "DejaVu Sans",Arial,sans-serif;color:#1a1a2e;margin:0}
h1{color:#0b3d91;border-bottom:3px solid #f5a623;padding-bottom:6px;font-size:21pt}
h2{color:#0b3d91;border-left:5px solid #f5a623;padding-left:8px;font-size:14pt;margin-top:20px;break-after:avoid}
h3{color:#0b3d91;font-size:11.5pt;break-after:avoid}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:9.3pt}tr{break-inside:avoid}
th,td{border:1px solid #b9c3d6;padding:4px 6px;vertical-align:top}th{background:#e8eefb}
blockquote{border-left:4px solid #d9534f;background:#fdf1f0;margin:8px 0;padding:4px 10px}
.eh{display:flex;gap:14px;align-items:center;border-bottom:3px solid #0b3d91;padding-bottom:8px;margin-bottom:14px}
.eh svg{width:62px;height:62px;flex:none}.eh .id{flex:1}.eh b{display:block;font-size:15pt;color:#0b3d91}.eh span{display:block;font-size:8.5pt;color:#46505e}
.eh .dv{font-size:8.5pt;color:#46505e;text-align:right}.eh .dv i{font-style:normal;background:#f5a623;color:#fff;padding:2px 9px;border-radius:99px;font-weight:700;font-size:8pt}
.wm{position:fixed;left:0;right:0;top:44%;text-align:center;transform:rotate(-35deg);font:900 88pt Arial,sans-serif;color:rgba(185,28,28,.10);letter-spacing:.08em;pointer-events:none;z-index:-1}
.sec{margin-top:26px;border-top:2px solid #0b3d91;padding-top:10px;display:flex;gap:16px;align-items:center;break-inside:avoid}
.sec .qr{flex:none;width:118px;height:118px;border:1px solid #c9d0d9;padding:4px}.sec .qr svg{width:100%;height:100%}
.sec .tx{flex:1;font-size:8.3pt;line-height:1.55;color:#46505e}.sec .tx b{color:#111}.cd{font:700 10pt "DejaVu Sans Mono",monospace;color:#111}
.sec .ct{flex:none;transform:rotate(-8deg);opacity:.85}
.ft{margin-top:12px;border-top:1px solid #c9d0d9;padding-top:5px;font-size:7.5pt;color:#5b6572;text-align:center;break-inside:avoid}`;

const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Arc-en-Ciel Connect - Cahier des charges</title><style>${css}</style></head><body>
<div class="wm">SPÉCIMEN</div>
<div class="eh">${logo}<div class="id"><b>SANIX AFRICA</b><span>Division Technologies · Édition de logiciels ERP et plateformes métier</span><span>WhatsApp : ${TEL}</span></div><div class="dv"><i>DIVISION TECHNOLOGIES</i><br>Réf. ${esc(ref)}<br>Version ${VERSION} · ${esc(DATE)}</div></div>
${corps}
<div class="sec"><div class="qr">${qrSvg}</div><div class="tx"><b>Document authentifiable — SANIX AFRICA Division Technologies</b><br>Réf. ${esc(ref)} · version ${VERSION} · émis le ${esc(DATE)}<br>Code de contrôle : <span class="cd">${esc(code)}</span><br>Empreinte SHA-256 du texte source : <span class="cd" style="font-size:7pt">${sha}</span><br>Scannez le QR pour lire la référence et l'empreinte ; elles doivent correspondre à celles de la version validée. <b>Exemplaire SPÉCIMEN, non contractuel.</b></div><div class="ct">${cachet}</div></div>
<div class="ft">Logiciel développé par Sanix Africa Division Technologies · WhatsApp : ${TEL}<br>${esc(ref)} · SPÉCIMEN</div>
</body></html>`;

(async () => {
  const f = path.join(tmp, "c.html"); fs.writeFileSync(f, html);
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto("file://" + f);
  await p.pdf({ path: PDF, format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: `<div style="font-size:7.5px;width:100%;text-align:center;color:#666">Sanix Africa Division Technologies · ${esc(ref)} · SPÉCIMEN · <span class=pageNumber></span>/<span class=totalPages></span></div>`,
    margin: { top: "16mm", bottom: "20mm", left: "14mm", right: "14mm" } });
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(PDF, ref, code);
})();
