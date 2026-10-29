import { sb, configured, enDemo, URL_VALIDE, ok, rpc, from, chargerDroits } from "./api.js";
import { el, fcfa, fdate, fdt, badge, kpi, card, table, toast, field, msgErr } from "./ui.js";

const S = { user: null, roles: [], perms: new Set(), membre: null, vue: "cite" };
const can = p => S.perms.has(p);
const racine = document.getElementById("app");
const VUES = [
  ["cite", "Ma cité", () => true, vueCite], ["finances", "Finances", () => can("finance.lire") || can("finance.encaisser"), vueFinances],
  ["depenses", "Dépenses", () => can("depense.creer") || can("depense.approuver") || can("depense.payer") || can("finance.lire"), vueDepenses],
  ["reunions", "Réunions", () => true, vueReunions], ["documents", "Documents", () => true, vueDocuments], ["audit", "Audit", () => can("audit.lire"), vueAudit]
];

/* ───────── Configuration (1re ouverture) ───────── */
function vueConfig() {
  const url = el("input", { type: "url", required: true, placeholder: "https://<réf-du-projet>.supabase.co", autocomplete: "off", inputmode: "url" });
  const cle = el("input", { type: "text", required: true, placeholder: "Clé « anon » (publique) du projet", autocomplete: "off" });
  const f = el("form", { class: "card", onsubmit: ev => { ev.preventDefault();
    const u = url.value.trim().replace(/\/+$/, "");
    if (!URL_VALIDE(u)) return toast("URL Supabase invalide.", true);
    if (/service_role/i.test(atob((cle.value.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil((cle.value.split(".")[1] || "").length / 4) * 4, "=") || "e30="))) return toast("Clé service_role refusée : utiliser la clé anon.", true);
    try { localStorage.setItem("arc_cfg", JSON.stringify({ url: u, anonKey: cle.value.trim() })); } catch (e) { return toast("Stockage indisponible.", true); }
    location.reload(); } }, el("h2", {}, "Connecter la cité"), el("p", { class: "mu" }, "Saisir l'adresse et la clé publique (anon) du projet Supabase dédié. Jamais la clé service_role."),
    field("Adresse du projet", url), field("Clé anon", cle), el("button", { class: "p", type: "submit" }, "Enregistrer et ouvrir"));
  const demo = card("Voir une démonstration", el("p", { class: "mu" }, "Données fictives, aucune écriture, aucun réseau."),
    el("button", { class: "s", onclick: () => { try { sessionStorage.setItem("arc_demo", "1"); } catch (e) {} location.reload(); } }, "Ouvrir la démo"));
  racine.replaceChildren(el("div", { class: "login" }, el("img", { src: "icons/logo.svg", width: 64, height: 64, alt: "" }), el("h1", {}, "Arc-en-Ciel Connect"), el("p", { class: "mu" }, "Cité Arc-en-Ciel de Songon Kassamblé"), f, demo));
}

/* ───────── Connexion ───────── */
let echecs = 0, bloqueJusqua = 0;
function vueLogin() {
  const e = el("input", { type: "email", required: true, autocomplete: "username", inputmode: "email" });
  const p = el("input", { type: "password", required: true, autocomplete: "current-password", minlength: 8 });
  const f = el("form", { class: "card", onsubmit: async ev => {
    ev.preventDefault();
    if (Date.now() < bloqueJusqua) return toast("Trop de tentatives. Réessayez dans quelques instants.", true);
    const { error } = await sb.auth.signInWithPassword({ email: e.value.trim(), password: p.value });
    if (error) { if (++echecs >= 5) { bloqueJusqua = Date.now() + 60000; echecs = 0; } return toast("Identifiants invalides.", true); }
    echecs = 0; demarrer();
  } }, el("h2", {}, "Connexion"), field("E-mail", e), field("Mot de passe", p), el("button", { class: "p", type: "submit" }, "Se connecter"));
  racine.replaceChildren(el("div", { class: "login" }, el("img", { src: "icons/logo.svg", width: 64, height: 64, alt: "" }), el("h1", {}, "Arc-en-Ciel Connect"), el("p", { class: "mu" }, "Cité Arc-en-Ciel de Songon Kassamblé"), f));
}

/* ───────── Coque ───────── */
function coque(contenu) {
  const nav = el("nav", { "aria-label": "Sections" }, VUES.filter(v => v[2]()).map(v =>
    el("button", { "aria-current": S.vue === v[0] ? "page" : null, onclick: () => { S.vue = v[0]; afficher(); } }, v[1])));
  racine.replaceChildren(
    el("header", {}, el("img", { src: "icons/logo.svg", alt: "" }), el("h1", {}, "Arc-en-Ciel Connect"),
      el("button", { onclick: async () => { await sb.auth.signOut(); S.user = null; if (enDemo) location.reload(); else vueLogin(); } }, "Déconnexion")),
    enDemo ? el("div", { class: "demo" }, "MODE DÉMONSTRATION — données fictives, aucune écriture") : null,
    nav, el("main", {}, contenu),
    el("div", { class: "ft" }, "Application développée par Sanix Africa Division Technologies · WhatsApp +225 0779181075 / 0140017751"));
}
async function afficher() {
  const v = VUES.find(x => x[0] === S.vue && x[2]()) || VUES[0];
  coque(el("p", { class: "mu" }, "Chargement…"));
  try { const c = await v[3](); coque(c); } catch (e) { coque(card("Erreur", el("p", {}, msgErr(e)))); }
}

/* ───────── Ma cité ───────── */
async function vueCite() {
  const [appels, annonces, etats, reunions, contribs] = await Promise.all([
    ok(from("v_appels").select("*").eq("member_id", S.membre?.id ?? "00000000-0000-0000-0000-000000000000").order("echeance", { ascending: false }).limit(24)),
    ok(from("announcements").select("titre,corps,categorie,publie_le").order("publie_le", { ascending: false }).limit(5)),
    ok(from("etats_publies").select("periode,titre,contenu,publie_le").order("publie_le", { ascending: false }).limit(3)),
    ok(from("meetings").select("titre,type,date_heure,lieu").gte("date_heure", new Date().toISOString()).order("date_heure").limit(5)),
    ok(from("contributions").select("id,libelle"))]);
  const lib = Object.fromEntries(contribs.map(c => [c.id, c.libelle]));
  const du = appels.filter(a => a.statut !== "paye").reduce((s, a) => s + Number(a.reste), 0);
  return el("div", {},
    card(S.membre ? `${S.membre.nom} ${S.membre.prenoms ?? ""}` : "Bienvenue", el("div", { class: "grid" },
      kpi("Rôle(s)", S.roles.join(", ") || "membre"), kpi("Reste à payer", fcfa(du)), kpi("Réf. membre", S.membre?.ref ?? "—"))),
    card("Mes cotisations", table([{ t: "Cotisation", f: r => lib[r.contribution_id] }, { t: "Période", k: "periode" }, { t: "Échéance", f: r => fdate(r.echeance) },
      { t: "Appelé", n: 1, f: r => fcfa(r.montant_appele) }, { t: "Payé", n: 1, f: r => fcfa(r.montant_paye) }, { t: "Statut", f: r => badge(r.statut) }], appels, "Aucune cotisation appelée.")),
    card("États financiers publiés", etats.length ? etats.map(e => el("p", {}, el("b", {}, `${e.titre} — ${e.periode}`), ` · recettes ${fcfa(e.contenu.recettes)} · dépenses ${fcfa(e.contenu.depenses)} · trésorerie ${fcfa(e.contenu.tresorerie)} · impayés ${fcfa(e.contenu.impayes)}`)) : el("p", { class: "mu" }, "Aucun état publié.")),
    card("Annonces", annonces.length ? annonces.map(a => el("p", {}, el("b", {}, a.titre), " ", el("span", { class: "mu" }, fdate(a.publie_le)), el("br"), a.corps)) : el("p", { class: "mu" }, "Aucune annonce.")),
    card("Prochaines réunions", table([{ t: "Date", f: r => fdt(r.date_heure) }, { t: "Réunion", k: "titre" }, { t: "Lieu", k: "lieu" }], reunions, "Aucune réunion programmée.")));
}

/* ───────── Finances ───────── */
async function vueFinances() {
  const [soldes, mouvements, appels, comptes] = await Promise.all([
    ok(from("v_soldes_comptes").select("*").order("code")),
    ok(from("cash_movements").select("id,ref,sens,montant,categorie,date_op,source_type,motif,contre_ecriture_de").order("cree_le", { ascending: false }).limit(30)),
    ok(from("v_appels").select("montant_appele,montant_paye,reste,statut")),
    ok(from("cash_accounts").select("id,code,nom").eq("actif", true))]);
  const somme = (f, k) => appels.filter(f).reduce((s, a) => s + Number(a[k]), 0);
  const annulees = new Set(mouvements.filter(m => m.contre_ecriture_de).map(m => m.contre_ecriture_de));
  return el("div", {},
    card("Trésorerie", el("div", { class: "grid" }, soldes.map(s => kpi(`${s.nom} (${s.type})`, fcfa(s.solde))),
      kpi("Total appelé", fcfa(somme(() => true, "montant_appele"))), kpi("Encaissé", fcfa(somme(() => true, "montant_paye"))), kpi("Impayés en retard", fcfa(somme(a => a.statut === "en_retard", "reste"))))),
    can("finance.encaisser") ? formPaiement(comptes) : null,
    card("Derniers mouvements", table([{ t: "Date", f: r => fdate(r.date_op) }, { t: "Réf.", k: "ref" }, { t: "Catégorie", k: "categorie" },
      { t: "Entrée", n: 1, f: r => r.sens === "entree" ? fcfa(r.montant) : "" }, { t: "Sortie", n: 1, f: r => r.sens === "sortie" ? fcfa(r.montant) : "" },
      { t: "", f: r => annulees.has(r.id) ? badge("annulee") : (can("finance.annuler") && !r.contre_ecriture_de ? el("button", { class: "s", onclick: () => annuler(r) }, "Contrepasser") : r.motif || "") }], mouvements)),
    can("finance.publier") ? formPublication() : null);
}
function formPaiement(comptes) {
  const compte = el("select", {}, comptes.map(c => el("option", { value: c.id }, `${c.code} — ${c.nom}`)));
  const appel = el("input", { placeholder: "Identifiant de l'appel (UUID)", pattern: "[0-9a-f-]{36}", required: true });
  const montant = el("input", { type: "number", min: 1, step: 1, required: true, inputmode: "numeric" });
  const mode = el("select", {}, [["especes", "Espèces"], ["mobile_money", "Mobile Money"], ["virement", "Virement"], ["cheque", "Chèque"]].map(([v, t]) => el("option", { value: v }, t)));
  const ref = el("input", { placeholder: "Référence Mobile Money / virement (facultatif)", maxlength: 60 });
  return card("Enregistrer un encaissement", el("form", { onsubmit: async ev => { ev.preventDefault();
    try { await rpc("enregistrer_paiement", { p_call: appel.value.trim(), p_member: null, p_account: compte.value, p_montant: Number(montant.value), p_mode: mode.value, p_ref_ext: ref.value.trim() || null });
      toast("Encaissement enregistré."); afficher(); } catch (e) { toast(msgErr(e), true); } } },
    field("Appel de cotisation", appel), field("Compte", compte), field("Montant (F CFA)", montant), field("Mode", mode), field("Référence externe", ref), el("button", { class: "p", type: "submit" }, "Enregistrer")));
}
async function annuler(m) {
  const motif = prompt(`Motif de la contrepassation de ${m.ref} (obligatoire) :`);
  if (!motif) return;
  try { await rpc("annuler_mouvement", { p_mouvement: m.id, p_motif: motif }); toast("Écriture contrepassée."); afficher(); } catch (e) { toast(msgErr(e), true); }
}
function formPublication() {
  const per = el("input", { required: true, placeholder: "2026-T4", maxlength: 20 }), d = el("input", { type: "date", required: true }), f = el("input", { type: "date", required: true });
  return card("Publier l'état financier de la période", el("form", { onsubmit: async ev => { ev.preventDefault();
    try { await rpc("publier_etat_financier", { p_periode: per.value.trim(), p_debut: d.value, p_fin: f.value }); toast("État publié aux membres."); } catch (e) { toast(msgErr(e), true); } } },
    field("Période", per), field("Du", d), field("Au", f), el("button", { class: "p", type: "submit" }, "Publier (non modifiable)")));
}

/* ───────── Dépenses ───────── */
async function vueDepenses() {
  const [deps, apr, lignes, comptes, regles] = await Promise.all([
    ok(from("expense_requests").select("*").order("cree_le", { ascending: false }).limit(40)),
    ok(from("expense_approvals").select("expense_id,role_code,decision,motif,le")),
    ok(from("v_budget_execution").select("line_id,exercice,categorie,disponible")),
    can("depense.payer") ? ok(from("v_soldes_comptes").select("id,code,nom,solde")) : [],
    ok(from("validation_rules").select("*").order("montant_min"))]);
  const parDep = {}; apr.forEach(a => (parDep[a.expense_id] ||= []).push(a));
  return el("div", {},
    can("depense.creer") ? formDepense(lignes) : null,
    card("Demandes de dépense", table([{ t: "Réf.", k: "ref" }, { t: "Objet", f: r => `${r.objet} — ${r.fournisseur}` }, { t: "Montant", n: 1, f: r => fcfa(r.montant) },
      { t: "Validations", f: r => (parDep[r.id] || []).map(a => `${a.role_code}${a.decision === "rejete" ? " ✗" : " ✓"}`).join(", ") || "—" }, { t: "Statut", f: r => badge(r.statut) },
      { t: "", f: r => actions(r, comptes) }], deps)),
    card("Seuils de validation (paramétrables)", table([{ t: "De", n: 1, f: r => fcfa(r.montant_min) }, { t: "À", n: 1, f: r => r.montant_max == null ? "∞" : fcfa(r.montant_max) },
      { t: "Rôles requis", f: r => r.roles_requis.join(" + ") }, { t: "Décision formelle", f: r => r.decision_requise ? "Oui" : "Non" }], regles)));
}
function actions(r, comptes) {
  const b = [];
  if (r.statut === "soumise" && can("depense.approuver")) {
    const role = S.roles.find(x => ["president", "tresorier", "second_approbateur", "responsable_commission", "vice_president"].includes(x));
    if (role) { b.push(el("button", { class: "s", onclick: () => decider(r, role, "approuve") }, "Approuver"), el("button", { class: "s", onclick: () => decider(r, role, "rejete") }, "Rejeter")); }
  }
  if (r.statut === "approuvee" && can("depense.payer") && comptes.length) b.push(el("button", { class: "p", onclick: () => payer(r, comptes) }, "Payer"));
  return el("div", { class: "row" }, b);
}
async function decider(r, role, decision) {
  const motif = decision === "rejete" ? prompt("Motif du rejet (obligatoire) :") : null;
  if (decision === "rejete" && !motif) return;
  try { const res = await rpc("decider_depense", { p_depense: r.id, p_role: role, p_decision: decision, p_motif: motif }); toast("Décision enregistrée : " + res); afficher(); } catch (e) { toast(msgErr(e), true); }
}
async function payer(r, comptes) {
  const code = prompt(`Compte payeur (${comptes.map(c => c.code + " : " + fcfa(c.solde)).join(" | ")}) :`, comptes[0].code);
  const compte = comptes.find(c => c.code === code); if (!compte) return;
  const just = prompt("Référence du justificatif de règlement (obligatoire) :"); if (!just) return;
  try { await rpc("payer_depense", { p_depense: r.id, p_account: compte.id, p_justificatif: just }); toast("Dépense payée."); afficher(); } catch (e) { toast(msgErr(e), true); }
}
function formDepense(lignes) {
  const objet = el("input", { required: true, minlength: 3, maxlength: 200 }), fourn = el("input", { required: true, maxlength: 120 });
  const montant = el("input", { type: "number", min: 1, step: 1, required: true, inputmode: "numeric" }), cat = el("input", { required: true, maxlength: 60, value: "entretien" });
  const ligne = el("select", {}, el("option", { value: "" }, "— hors budget —"), lignes.map(l => el("option", { value: l.line_id }, `${l.exercice} · ${l.categorie} (dispo ${fcfa(l.disponible)})`)));
  const just = el("input", { placeholder: "Références des pièces (séparées par une virgule)", required: true }), dec = el("input", { placeholder: "Référence de la décision (si > seuil)", maxlength: 80 });
  return card("Nouvelle demande de dépense", el("form", { onsubmit: async ev => { ev.preventDefault();
    try { await rpc("soumettre_depense", { p_objet: objet.value.trim(), p_montant: Number(montant.value), p_categorie: cat.value.trim(), p_ligne: ligne.value || null, p_fournisseur: fourn.value.trim(),
      p_justificatifs: just.value.split(",").map(x => x.trim()).filter(Boolean), p_decision_ref: dec.value.trim() || null }); toast("Demande soumise."); afficher(); } catch (e) { toast(msgErr(e), true); } } },
    field("Objet", objet), field("Fournisseur / bénéficiaire", fourn), field("Montant (F CFA)", montant), field("Catégorie", cat), field("Ligne budgétaire", ligne), field("Pièces justificatives", just), field("Décision formelle", dec),
    el("button", { class: "p", type: "submit" }, "Soumettre")));
}

/* ───────── Réunions, documents, audit ───────── */
async function vueReunions() {
  const [reunions, pv, res] = await Promise.all([
    ok(from("meetings").select("id,titre,type,date_heure,lieu,ordre_du_jour").order("date_heure", { ascending: false }).limit(20)),
    ok(from("minutes").select("meeting_id,version,contenu,statut").eq("statut", "publie")),
    ok(from("resolutions").select("numero,sujet,responsable,echeance,statut").order("cree_le", { ascending: false }).limit(20))]);
  const titre = id => reunions.find(r => r.id === id)?.titre ?? "";
  return el("div", {},
    card("Réunions", table([{ t: "Date", f: r => fdt(r.date_heure) }, { t: "Type", k: "type" }, { t: "Réunion", k: "titre" }, { t: "Lieu", k: "lieu" }], reunions)),
    card("Procès-verbaux publiés", pv.length ? pv.map(p => el("details", {}, el("summary", {}, `${titre(p.meeting_id)} — version ${p.version}`), el("pre", { class: "pre" }, p.contenu))) : el("p", { class: "mu" }, "Aucun PV publié.")),
    card("Décisions et actions", table([{ t: "N°", k: "numero" }, { t: "Sujet", k: "sujet" }, { t: "Responsable", k: "responsable" }, { t: "Échéance", f: r => fdate(r.echeance) }, { t: "Statut", k: "statut" }], res)));
}
async function vueDocuments() {
  const docs = await ok(from("documents").select("titre,categorie,version,chemin,visibilite,cree_le").order("cree_le", { ascending: false }).limit(50));
  return card("Documents", table([{ t: "Titre", k: "titre" }, { t: "Catégorie", k: "categorie" }, { t: "Version", n: 1, k: "version" }, { t: "Ajouté", f: r => fdate(r.cree_le) },
    { t: "", f: r => el("button", { class: "s", onclick: async () => { const { data, error } = await sb.storage.from("documents").createSignedUrl(r.chemin, 60);
      if (error) return toast("Accès refusé.", true); window.open(data.signedUrl, "_blank", "noopener"); } }, "Ouvrir") }], docs, "Aucun document accessible."));
}
async function vueAudit() {
  const [logs, rupt] = await Promise.all([ok(from("audit_logs").select("id,le,acteur,action,table_nom,ligne_id").order("id", { ascending: false }).limit(60)), rpc("verifier_chaine_audit")]);
  return el("div", {}, card("Intégrité du journal", el("p", {}, rupt.length ? badge("annulee") : badge("paye"), rupt.length ? ` ${rupt.length} rupture(s) de chaîne détectée(s) — alerter le comité.` : " Chaîne d'empreintes intacte.")),
    card("Journal d'audit (60 derniers événements)", table([{ t: "#", k: "id" }, { t: "Date", f: r => fdt(r.le) }, { t: "Action", k: "action" }, { t: "Table", k: "table_nom" }, { t: "Ligne", f: r => (r.ligne_id || "").slice(0, 8) }, { t: "Acteur", f: r => (r.acteur || "système").slice(0, 8) }], logs)));
}

/* ───────── Démarrage ───────── */
async function demarrer() {
  if (!configured) return vueConfig();
  const { data } = await sb.auth.getSession();
  if (!data.session) return vueLogin();
  S.user = data.session.user;
  try {
    const d = await chargerDroits(S.user.id); S.roles = d.roles; S.perms = d.perms;
    const m = await ok(from("members").select("id,ref,nom,prenoms").eq("user_id", S.user.id).limit(1)); S.membre = m[0] || null;
  } catch (e) { toast(msgErr(e), true); }
  afficher();
}
if (configured && !enDemo) sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") vueLogin(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
demarrer();
