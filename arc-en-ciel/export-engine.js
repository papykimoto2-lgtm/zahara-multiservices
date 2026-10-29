/* Exports et impression ARC-EN-CIEL CONNECT : CSV (Excel FR, séparateur « ; »), Excel (.xls), impression / PDF par le navigateur.
   - Toute impression porte un pied de page : référence, date, empreinte SHA-256 du contenu et QR (qrcode-generator, MIT).
     Avec une clé de signature sur l'appareil (signature-engine.js) le QR est SIGNÉ (origine + intégrité) ; sinon il n'atteste que l'intégrité.
   - Les montants sont exportés en nombres bruts ; les textes sont échappés (aucune formule ne peut s'exécuter : préfixe « ' » devant = + - @).
   Expose ARC_EXPORT. Dépend de ui-engine.js et de vendor/qrcode.js. */
(function (G) {
  "use strict";
  var D = G.document, UI = G.ARC_UI, el = UI.el, M = G.ERP_MARQUE || {};
  function valeur(c, r) { var v = c.x ? c.x(r) : c.f ? c.f(r) : r[c.k]; if (v && v.nodeType) v = v.textContent; return v == null ? "" : v; }
  function sur(v) { v = String(v); return /^[=+\-@\t\r]/.test(v) && isNaN(Number(v)) ? "'" + v : v; }   /* neutralise l'injection de formules */
  function lignes(cols, rows) {
    var cs = cols.filter(function (c) { return c.t; });
    return [cs.map(function (c) { return c.t; })].concat(rows.map(function (r) { return cs.map(function (c) { return valeur(c, r); }); }));
  }
  function telecharger(nom, mime, contenu) {
    var b = new G.Blob([contenu], { type: mime }), a = D.createElement("a");
    a.href = G.URL.createObjectURL(b); a.download = nom; D.body.appendChild(a); a.click(); D.body.removeChild(a);
    setTimeout(function () { G.URL.revokeObjectURL(a.href); }, 2000);
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }
  function csv(nom, cols, rows) {
    var t = lignes(cols, rows).map(function (l) { return l.map(function (v) { v = sur(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(";"); }).join("\r\n");
    telecharger(nom + "-" + stamp() + ".csv", "text/csv;charset=utf-8", "﻿" + t);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function xls(nom, cols, rows) {
    var L = lignes(cols, rows), h = '<html><head><meta charset="UTF-8"></head><body><table border="1">' + L.map(function (l, i) {
      return "<tr>" + l.map(function (v) { return (i ? "<td>" : "<th>") + esc(sur(v)) + (i ? "</td>" : "</th>"); }).join("") + "</tr>"; }).join("") + "</table></body></html>";
    telecharger(nom + "-" + stamp() + ".xls", "application/vnd.ms-excel", h);
  }
  function sha(txt) {
    if (!G.crypto || !G.crypto.subtle) return Promise.resolve("indisponible");
    return G.crypto.subtle.digest("SHA-256", new G.TextEncoder().encode(txt)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); });
  }
  function qr(texte) {
    if (typeof G.qrcode !== "function") return "";
    try { var q = G.qrcode(0, "M"); q.addData(texte); q.make(); return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (e) { return ""; }
  }
  /* Imprime la zone de contenu courante avec le pied d'intégrité ; SIGNÉ (ECDSA) si l'utilisateur a une clé de signature sur cet appareil. */
  function imprimer(titre, texteContenu) {
    var texte = String(texteContenu || D.querySelector("main").textContent), S = G.ARC_SIGN;
    return Promise.resolve(S ? S.pret() : false).then(function (aCle) { return aCle ? S.signer(titre, texte).then(function (r) { return { sig: r }; }, function (e) { UI.toast("Signature impossible : " + UI.msgErr(e) + " — impression non signée.", true); return {}; }) : {}; })
      .then(function (o) { return sha(texte).then(function (h) { o.h = o.sig ? o.sig.hash : h; return o; }); }).then(function (o) {
      var ref = o.sig ? o.sig.ref : "ARC-" + stamp().replace(/-/g, "") + "-" + o.h.slice(0, 6).toUpperCase(), svg = qr(o.sig ? o.sig.qr : ["ARC-EN-CIEL", ref, stamp(), "sha256:" + o.h].join("|"));
      var note = o.sig ? "DOCUMENT SIGNÉ NUMÉRIQUEMENT (ECDSA P-256) par " + o.sig.fonction + " — clé " + o.sig.kid + ". Scannez le QR (ou ouvrez verifier.html) : origine, intégrité et validité de la clé sont contrôlées sans connexion."
        : "QR d'intégrité (non signé) : il confirme que le contenu n'a pas été modifié, pas son origine.";
      var pied = el("div", { id: "pied-print" }, el("div", { class: "qrp" }), el("div", {}, el("b", {}, titre + " — " + (M.nom || "")), el("br"), "Réf. " + ref + " · émis le " + stamp(), el("br"),
        "Empreinte SHA-256 : " + o.h, el("br"), note + " Logiciel développé par " + (M.editeur || "") + " · " + (M.contact || "")));
      if (svg) { var tmp = new G.DOMParser().parseFromString(svg, "image/svg+xml").documentElement; pied.firstChild.appendChild(D.importNode(tmp, true)); }
      var ancien = D.getElementById("pied-print"); if (ancien) ancien.remove();
      D.querySelector("main").appendChild(pied); D.title = titre + " — " + ref;
      var fin = function () { var p = D.getElementById("pied-print"); if (p) p.remove(); D.title = "Arc-en-Ciel Connect"; G.removeEventListener("afterprint", fin); };
      G.addEventListener("afterprint", fin); G.print();
      return ref;
    });
  }
  function barre(nom, cols, rows) {
    return el("div", { class: "row noprint" },
      el("button", { class: "s", onclick: function () { csv(nom, cols, rows); } }, "⬇ CSV"), el("button", { class: "s", onclick: function () { xls(nom, cols, rows); } }, "⬇ Excel"),
      el("button", { class: "s", onclick: function () { imprimer(nom, lignes(cols, rows).map(function (l) { return l.join("|"); }).join("\n")); } }, "🖨 Imprimer / PDF"));
  }
  G.ARC_EXPORT = { csv: csv, xls: xls, imprimer: imprimer, barre: barre, lignes: lignes, sha: sha };
})(window);
