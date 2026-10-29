/* Aides d'interface ARC-EN-CIEL CONNECT (partagées par tous les écrans).
   - Aucune donnée venant du serveur n'est jamais injectée par innerHTML : tout passe par el() / textContent (protection XSS).
   - Montants en F CFA (fc), dates en français (fd, fdt), pastilles de statut (badge), cartes, tableaux, notifications.
   Expose ARC_UI. */
(function (G) {
  "use strict";
  var D = G.document;
  function el(tag, attrs) {
    var e = D.createElement(tag), i, k, v, kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (k in attrs) {
      v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    (function ajouter(L) {
      for (i = 0; i < L.length; i++) {
        if (L[i] == null || L[i] === false) continue;
        if (Array.isArray(L[i])) ajouter(L[i]);
        else e.appendChild(L[i].nodeType ? L[i] : D.createTextNode(String(L[i])));
      }
    })(kids);
    return e;
  }
  var fc = function (n) { return new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0)).replace(/[  ]/g, " ") + " F"; };
  var fd = function (d) { return d ? new Date(d).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—"; };
  var fdt = function (d) { return d ? new Date(d).toLocaleString("fr-FR") : "—"; };
  var ST = {
    paye: ["Payé", "ok"], partiel: ["Partiel", "wa"], appele: ["Appelé", ""], en_retard: ["En retard", "er"], conteste: ["Contesté", "wa"],
    soumise: ["À valider", "wa"], approuvee: ["Approuvée", "ok"], payee: ["Payée", "ok"], rejetee: ["Rejetée", "er"], annulee: ["Annulée", "er"],
    brouillon: ["Brouillon", ""], valide: ["Validé", "wa"], publie: ["Publié", "ok"]
  };
  function badge(s) { var x = ST[s] || [s, ""]; return el("span", { class: "b " + x[1] }, x[0]); }
  function kpi(l, v) { return el("div", { class: "kpi" }, el("div", { class: "v" }, v), el("div", { class: "l" }, l)); }
  function card(titre) { return el("section", { class: "card" }, titre ? el("h2", {}, titre) : null, Array.prototype.slice.call(arguments, 1)); }
  function table(cols, rows, vide) {
    if (!rows.length) return el("p", { class: "mu" }, vide || "Aucune donnée.");
    return el("div", { class: "tw" }, el("table", {},
      el("thead", {}, el("tr", {}, cols.map(function (c) { return el("th", { class: c.n ? "n" : "" }, c.t); }))),
      el("tbody", {}, rows.map(function (r) {
        return el("tr", {}, cols.map(function (c) { return el("td", { class: c.n ? "n" : "" }, c.f ? c.f(r) : (r[c.k] == null ? "" : r[c.k])); }));
      }))));
  }
  function toast(msg, err) {
    var t = D.getElementById("toast");
    if (!t) { t = el("div", { id: "toast", role: "status" }); D.body.appendChild(t); }
    t.className = err ? "er" : ""; t.textContent = msg; t.hidden = false;
    clearTimeout(t._t); t._t = setTimeout(function () { t.hidden = true; }, 4500);
  }
  function field(label, input) { return el("label", {}, label, input); }
  /* Message lisible : les messages métier des fonctions SQL sont déjà en français. */
  function msgErr(e) { return (e && (e.message || e.details)) || "Erreur inattendue."; }

  G.ARC_UI = { el: el, fc: fc, fd: fd, fdt: fdt, badge: badge, kpi: kpi, card: card, table: table, toast: toast, field: field, msgErr: msgErr };
})(window);
