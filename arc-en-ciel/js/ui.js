// Helpers DOM : aucune donnée serveur n'est jamais injectée via innerHTML (protection XSS).
export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
export const fcfa = n => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0)).replace(/[  ]/g, " ") + " F";
export const fdate = d => d ? new Date(d).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—";
export const fdt = d => d ? new Date(d).toLocaleString("fr-FR") : "—";
const ST = { paye: ["Payé", "ok"], partiel: ["Partiel", "wa"], appele: ["Appelé", ""], en_retard: ["En retard", "er"], conteste: ["Contesté", "wa"],
  soumise: ["À valider", "wa"], approuvee: ["Approuvée", "ok"], payee: ["Payée", "ok"], rejetee: ["Rejetée", "er"], annulee: ["Annulée", "er"],
  brouillon: ["Brouillon", ""], valide: ["Validé", "wa"], publie: ["Publié", "ok"] };
export const badge = s => { const [t, c] = ST[s] || [s, ""]; return el("span", { class: "b " + c }, t); };
export const kpi = (l, v) => el("div", { class: "kpi" }, el("div", { class: "v" }, v), el("div", { class: "l" }, l));
export const card = (titre, ...kids) => el("section", { class: "card" }, titre ? el("h2", {}, titre) : null, ...kids);
export function table(cols, rows, vide = "Aucune donnée.") {
  if (!rows.length) return el("p", { class: "mu" }, vide);
  return el("div", { class: "tw" }, el("table", {},
    el("thead", {}, el("tr", {}, cols.map(c => el("th", { class: c.n ? "n" : "" }, c.t)))),
    el("tbody", {}, rows.map(r => el("tr", {}, cols.map(c => el("td", { class: c.n ? "n" : "" }, c.f ? c.f(r) : r[c.k] ?? "")))))));
}
export function toast(msg, err = false) {
  let t = document.getElementById("toast"); if (!t) { t = el("div", { id: "toast", role: "status" }); document.body.append(t); }
  t.className = err ? "er" : ""; t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 4500);
}
export function field(label, input) { return el("label", {}, label, input); }
// Message d'erreur lisible (les messages métier des fonctions SQL sont déjà en français)
export const msgErr = e => (e && (e.message || e.details)) || "Erreur inattendue.";
