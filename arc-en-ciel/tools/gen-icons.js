/* Génère les icônes PNG de l'application depuis icons/logo.svg (Chromium via Playwright).
   Usage : node arc-en-ciel/tools/gen-icons.js   →  icons/arc-192.png, arc-512.png, arc-maskable-512.png, arc-apple-180.png */
const { chromium } = require(process.env.PLAYWRIGHT || "playwright"), fs = require("fs"), path = require("path");
const dir = path.resolve(__dirname, "..", "icons"), svg = fs.readFileSync(path.join(dir, "logo.svg"), "utf8");
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  for (const [nom, t, marge, fond] of [["arc-192", 192, 0, false], ["arc-512", 512, 0, false], ["arc-maskable-512", 512, 0.18, true], ["arc-apple-180", 180, 0, true]]) {
    await p.setViewportSize({ width: t, height: t });
    await p.setContent(`<body style="margin:0;background:${fond ? "#0b3d91" : "transparent"};display:grid;place-items:center;width:${t}px;height:${t}px"><div style="width:${Math.round(t * (1 - 2 * marge))}px;height:${Math.round(t * (1 - 2 * marge))}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body>`);
    await p.screenshot({ path: path.join(dir, nom + ".png"), omitBackground: !fond });
    console.log(nom + ".png");
  }
  await b.close();
})();
