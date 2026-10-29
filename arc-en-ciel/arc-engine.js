/* Application ARC-EN-CIEL CONNECT — écrans de la V1 : Ma cité, Finances, Dépenses, Réunions, Documents, Audit.
   - Accès : compte Supabase Auth ; 5 essais de connexion puis blocage 60 s (en plus de la limitation côté serveur).
   - Menus affichés selon les droits de l'utilisateur (affichage seulement : RLS et fonctions SQL décident).
   - Toute opération financière appelle une fonction SQL (enregistrer_paiement, annuler_mouvement, soumettre_depense, decider_depense, payer_depense,
     publier_etat_financier) : aucune écriture directe sur le grand livre.
   - Mode démonstration : données fictives (demo-engine.js), aucune écriture.
   Dépend de marque.js, ui-engine.js, demo-engine.js, api-engine.js. */
(function (G) {
  "use strict";
  var D = G.document, M = G.ERP_MARQUE || {}, API = G.ARC_API, UI = G.ARC_UI;
  var el = UI.el, fc = UI.fc, fd = UI.fd, fdt = UI.fdt, badge = UI.badge, kpi = UI.kpi, card = UI.card, table = UI.table, toast = UI.toast, field = UI.field, msgErr = UI.msgErr;
  var sb = API.sb, ok = API.ok, rpc = API.rpc, from = API.from;
  var S = { user: null, roles: [], perms: new Set(), membre: null, vue: "auj" };
  var racine = D.getElementById("app");
  var echecs = 0, bloqueJusqua = 0;
  function can(p) { return S.perms.has(p); }

  var VUES = [
    ["auj", "🏠 Aujourd'hui", function () { return true; }, vueAujourdhui],
    ["cite", "🏘️ Ma cité", function () { return true; }, vueCite],
    ["finances", "💰 Argent", function () { return can("finance.lire") || can("finance.encaisser"); }, vueFinances],
    ["depenses", "🧾 Dépenses", function () { return can("depense.creer") || can("depense.approuver") || can("depense.payer") || can("finance.lire"); }, vueDepenses],
    ["reunions", "📅 Réunions", function () { return true; }, vueReunions],
    ["documents", "📁 Documents", function () { return true; }, vueDocuments],
    ["audit", "🛡️ Audit et contrôle", function () { return can("audit.lire"); }, vueAudit]
  ];
  var THEMES = [["bleu", "#1a3aa8"], ["teal", "#0e7490"], ["emeraude", "#0f7b5f"], ["orange", "#c9500a"], ["violet", "#6a32c9"], ["or", "#15171d"]];
  var LIBROLES = { president: "Président", vice_president: "Vice-président", secretaire: "Secrétaire général", tresorier: "Trésorier", tresorier_adjoint: "Trésorier adjoint", second_approbateur: "Second approbateur",
    responsable_commission: "Responsable de commission", controleur: "Contrôleur financier", commission_sociale: "Commission sociale", admin_technique: "Administrateur technique", membre: "Membre" };
  function theme(t) { if (t) { try { localStorage.setItem("arc_theme", t); } catch (e) { } } var c; try { c = localStorage.getItem("arc_theme"); } catch (e) { c = null; }
    c = THEMES.some(function (x) { return x[0] === c; }) ? c : "bleu"; if (c === "bleu") D.documentElement.removeAttribute("data-theme"); else D.documentElement.setAttribute("data-theme", c); return c; }
  theme();

  /* ---------- Configuration (première ouverture) ---------- */
  function vueConfig() {
    var url = el("input", { type: "url", required: true, placeholder: "https://<réf-du-projet>.supabase.co", autocomplete: "off", inputmode: "url" });
    var cle = el("input", { type: "text", required: true, placeholder: "Clé « anon » (publique) du projet", autocomplete: "off" });
    function estServiceRole(k) {
      try { var p = k.split(".")[1] || ""; p = p.replace(/-/g, "+").replace(/_/g, "/"); while (p.length % 4) p += "="; return /service_role/i.test(atob(p)); } catch (e) { return false; }
    }
    var f = el("form", { class: "card", onsubmit: function (ev) {
      ev.preventDefault();
      var u = url.value.trim().replace(/\/+$/, "");
      if (!API.urlValide(u)) return toast("URL Supabase invalide.", true);
      if (estServiceRole(cle.value.trim())) return toast("Clé service_role refusée : utiliser la clé anon.", true);
      try { localStorage.setItem("arc_cfg", JSON.stringify({ url: u, anonKey: cle.value.trim() })); } catch (e) { return toast("Stockage indisponible.", true); }
      G.location.reload();
    } }, el("h2", {}, "Connecter la cité"), el("p", { class: "mu" }, "Saisir l'adresse et la clé publique (anon) du projet Supabase dédié. Jamais la clé service_role."),
      field("Adresse du projet", url), field("Clé anon", cle), el("button", { class: "p", type: "submit" }, "Enregistrer et ouvrir"));
    var demo = card("Voir une démonstration", el("p", { class: "mu" }, "Données fictives, aucune écriture, aucun réseau."),
      el("button", { class: "s", onclick: function () { try { sessionStorage.setItem("arc_demo", "1"); } catch (e) { } G.location.reload(); } }, "Ouvrir la démo"));
    racine.replaceChildren(el("div", { class: "login" }, el("img", { src: "icons/arc-192.png", width: 64, height: 64, alt: "" }), el("h1", {}, M.nom), el("p", { class: "mu" }, M.cite), f, demo));
  }

  /* ---------- Connexion ---------- */
  function vueLogin() {
    var e = el("input", { type: "email", required: true, autocomplete: "username", inputmode: "email" });
    var p = el("input", { type: "password", required: true, autocomplete: "current-password", minlength: 8 });
    var f = el("form", { class: "card", onsubmit: function (ev) {
      ev.preventDefault();
      if (Date.now() < bloqueJusqua) return toast("Trop de tentatives. Réessayez dans quelques instants.", true);
      sb.auth.signInWithPassword({ email: e.value.trim(), password: p.value }).then(function (r) {
        if (r.error) { if (++echecs >= 5) { bloqueJusqua = Date.now() + 60000; echecs = 0; } return toast("Identifiants invalides.", true); }
        echecs = 0; demarrer();
      });
    } }, el("h2", {}, "Connexion"), field("E-mail", e), field("Mot de passe", p), el("button", { class: "p", type: "submit" }, "Se connecter"));
    racine.replaceChildren(el("div", { class: "login" }, el("img", { src: "icons/arc-192.png", width: 64, height: 64, alt: "" }), el("h1", {}, M.nom), el("p", { class: "mu" }, M.cite), f));
  }

  /* ---------- Coque : menu latéral, pastille de synchronisation ---------- */
  var SYNC = { t: null, er: false }, OUVERT = false;
  function hhmm(d) { return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function prenom() { return S.membre ? (S.membre.prenoms || S.membre.nom).split(" ")[0] : "membre"; }
  function coque(contenu) {
    var cur = theme();
    var nav = el("nav", { "aria-label": "Sections" }, VUES.filter(function (v) { return v[2](); }).map(function (v) {
      return el("button", { "aria-current": S.vue === v[0] ? "page" : null, onclick: function () { S.vue = v[0]; OUVERT = false; afficher(); } }, v[1]);
    }));
    var role = S.roles.length ? S.roles.map(function (r) { return LIBROLES[r] || r; }).join(", ") : "Membre";
    var pastille = API.enDemo ? el("span", { class: "pill dm" }, "Mode démonstration") : SYNC.er ? el("span", { class: "pill er" }, "Passerelle en erreur") : el("span", { class: "pill" }, "Synchronisé " + (SYNC.t ? hhmm(SYNC.t) : "…"));
    var sb_ = el("aside", { class: "sb" },
      el("div", { class: "br" }, el("img", { src: "icons/arc-192.png", alt: "" }), el("div", {}, el("b", {}, M.nom), el("span", {}, M.cite))), nav, el("div", { class: "grow" }),
      el("div", { class: "dev" }, "Logiciel développé par " + M.editeur + " · " + M.contact),
      el("div", { class: "me" }, el("b", {}, S.membre ? S.membre.nom + " " + (S.membre.prenoms || "") : "Compte connecté"), el("span", {}, role)),
      el("div", { class: "dots", role: "group", "aria-label": "Couleur de l'application" }, THEMES.map(function (t) {
        return el("button", { "data-c": t[1], "aria-label": "Thème " + t[0], "aria-pressed": cur === t[0] ? "true" : "false", onclick: function () { theme(t[0]); afficher(); } });
      })),
      el("button", { class: "lk", onclick: function () { sb.auth.signOut().then(function () { S.user = null; if (API.enDemo) G.location.reload(); else vueLogin(); }); } }, "↩ Déconnexion"), pastille);
    Array.prototype.forEach.call(sb_.querySelectorAll(".dots button"), function (b) { b.style.background = b.getAttribute("data-c"); });
    var top = el("div", { class: "top" }, el("button", { "aria-label": "Menu", onclick: function () { OUVERT = !OUVERT; sh.classList.toggle("open", OUVERT); } }, "☰"), el("b", {}, M.nom));
    var sh = el("div", { class: "shell" + (OUVERT ? " open" : "") }, sb_, el("div", {}, top, API.enDemo ? el("div", { class: "demo" }, "MODE DÉMONSTRATION — données fictives, aucune écriture") : null, el("main", { class: "ct" }, contenu)));
    racine.replaceChildren(sh);
  }
  function afficher() {
    var v = VUES.filter(function (x) { return x[0] === S.vue && x[2](); })[0] || VUES[0];
    coque(el("p", { class: "mu" }, "Chargement…"));
    v[3]().then(function (c) { SYNC.t = new Date(); SYNC.er = false; coque(c); }, function (e) { SYNC.er = true; coque(card("Erreur", el("p", {}, msgErr(e)))); });
  }

  /* ---------- Aujourd'hui : ce qui demande l'attention maintenant ---------- */
  var ALK = "arc_alertes";
  function alertesEtat() { try { return JSON.parse(localStorage.getItem(ALK) || "{}"); } catch (e) { return {}; } }
  function alerteMaj(id, v) { var a = alertesEtat(); a[id] = v; try { localStorage.setItem(ALK, JSON.stringify(a)); } catch (e) { } afficher(); }
  function vueAujourdhui() {
    var mid = S.membre ? S.membre.id : "00000000-0000-0000-0000-000000000000", fin = can("finance.lire") || can("finance.encaisser");
    return Promise.all([
      ok(from("v_appels").select("montant_appele,montant_paye,reste,statut,member_id")),
      (can("depense.approuver") || can("depense.payer") || can("finance.lire")) ? ok(from("expense_requests").select("id,statut,montant")) : Promise.resolve([]),
      ok(from("meetings").select("titre,date_heure").gte("date_heure", new Date().toISOString()).order("date_heure").limit(3)),
      can("audit.lire") ? rpc("verifier_chaine_audit") : Promise.resolve([]),
      fin ? ok(from("v_soldes_comptes").select("solde")) : Promise.resolve([])
    ]).then(function (R) {
      var appels = R[0], deps = R[1], reunions = R[2], rupt = R[3], soldes = R[4];
      var mes = appels.filter(function (a) { return a.member_id === mid; });
      var duMoi = mes.filter(function (a) { return a.statut !== "paye"; }).reduce(function (s, a) { return s + Number(a.reste); }, 0);
      var retardMoi = mes.filter(function (a) { return a.statut === "en_retard"; });
      var retardTous = appels.filter(function (a) { return a.statut === "en_retard"; });
      var aValider = deps.filter(function (d) { return d.statut === "soumise"; }).length, aPayer = deps.filter(function (d) { return d.statut === "approuvee"; }).length;
      var tres = soldes.reduce(function (s, x) { return s + Number(x.solde); }, 0), impayes = retardTous.reduce(function (s, a) { return s + Number(a.reste); }, 0);
      var kp = [];
      if (can("depense.approuver")) kp.push(kpi("à valider", String(aValider), "🧾"));
      if (can("depense.payer")) kp.push(kpi("à payer", String(aPayer), "💸"));
      if (fin) kp.push(kpi("impayés en retard", fc(impayes), "⏰"), kpi("trésorerie", fc(tres), "🏦"));
      kp.push(kpi("votre reste à payer", fc(duMoi), "🏘️"));
      var AL = [];
      if (rupt.length) AL.push({ id: "chaine", c: "er", t: "Journal d'audit : " + rupt.length + " rupture(s) de chaîne d'empreintes — alerter le comité.", v: "audit", l: "Voir l'audit →" });
      if (fin && retardTous.length) AL.push({ id: "retard", c: "er", t: retardTous.length + " appel(s) de cotisation en retard : " + fc(impayes) + " à recouvrer.", v: "finances", l: "Voir les impayés →" });
      if (aValider && can("depense.approuver")) AL.push({ id: "valider", c: "wa", t: aValider + " demande(s) de dépense à valider.", v: "depenses", l: "Voir les dépenses →" });
      if (aPayer && can("depense.payer")) AL.push({ id: "payer", c: "wa", t: aPayer + " dépense(s) approuvée(s) à payer.", v: "depenses", l: "Voir les paiements →" });
      if (retardMoi.length) AL.push({ id: "moi", c: "wa", t: "Vous avez " + retardMoi.length + " cotisation(s) en retard : " + fc(retardMoi.reduce(function (s, a) { return s + Number(a.reste); }, 0)) + ".", v: "cite", l: "Voir mes cotisations →" });
      reunions.filter(function (r) { return new Date(r.date_heure) - new Date() < 7 * 864e5; }).forEach(function (r, i) { AL.push({ id: "reu" + i + r.date_heure, c: "in", t: "Réunion « " + r.titre + " » le " + fdt(r.date_heure) + ".", v: "reunions", l: "Voir les réunions →" }); });
      var et = alertesEtat(), now = Date.now();
      var visibles = AL.filter(function (a) { var x = et[a.id]; return !(x && x !== "moi" && x > now); });
      var acts = el("div", { class: "acts" },
        can("depense.creer") ? el("button", { class: "p", onclick: function () { S.vue = "depenses"; afficher(); } }, "＋ Nouvelle dépense") : null,
        can("finance.encaisser") ? el("button", { class: "s", onclick: function () { S.vue = "finances"; afficher(); } }, "💰 Enregistrer un encaissement") : null,
        el("button", { class: "s", onclick: function () { S.vue = "cite"; afficher(); } }, "🏘️ Mes cotisations"));
      return el("div", {}, el("h1", { class: "hi" }, "Bonjour " + prenom()), el("p", { class: "sub" }, "Voici ce qui demande votre attention maintenant."), acts,
        el("div", { class: "grid" }, kp),
        el("h2", {}, "Alertes", visibles.length ? el("span", { class: "nb" }, String(visibles.length)) : null),
        visibles.length ? visibles.map(function (a) {
          var pris = et[a.id] === "moi";
          return el("div", { class: "al " + a.c + (pris ? " pris" : "") }, el("span", { class: "tx" }, (a.c === "er" ? "🔴 " : a.c === "wa" ? "🟠 " : "🔵 ") + a.t + (pris ? " (pris en charge)" : "")),
            el("span", { class: "bt" }, el("button", { class: "p", onclick: function () { S.vue = a.v; afficher(); } }, a.l),
              el("button", { class: "s", onclick: function () { alerteMaj(a.id, "moi"); } }, "✋ Je m'en occupe"),
              el("button", { class: "s", onclick: function () { alerteMaj(a.id, Date.now() + 30 * 60000); } }, "⏰ 30 min"), el("button", { class: "s", onclick: function () { alerteMaj(a.id, Date.now() + 2 * 3600000); } }, "⏰ 2 h")));
        }) : el("p", { class: "mu" }, "✅ Rien d'urgent."));
    });
  }

  /* ---------- Ma cité ---------- */
  function vueCite() {
    var mid = S.membre ? S.membre.id : "00000000-0000-0000-0000-000000000000";
    return Promise.all([
      ok(from("v_appels").select("*").eq("member_id", mid).order("echeance", { ascending: false }).limit(24)),
      ok(from("announcements").select("titre,corps,categorie,publie_le").order("publie_le", { ascending: false }).limit(5)),
      ok(from("etats_publies").select("periode,titre,contenu,publie_le").order("publie_le", { ascending: false }).limit(3)),
      ok(from("meetings").select("titre,type,date_heure,lieu").gte("date_heure", new Date().toISOString()).order("date_heure").limit(5)),
      ok(from("contributions").select("id,libelle"))
    ]).then(function (R) {
      var appels = R[0], annonces = R[1], etats = R[2], reunions = R[3], lib = {};
      R[4].forEach(function (c) { lib[c.id] = c.libelle; });
      var du = appels.filter(function (a) { return a.statut !== "paye"; }).reduce(function (s, a) { return s + Number(a.reste); }, 0);
      return el("div", {},
        card(S.membre ? S.membre.nom + " " + (S.membre.prenoms || "") : "Bienvenue", el("div", { class: "grid" },
          kpi("Rôle(s)", S.roles.join(", ") || "membre"), kpi("Reste à payer", fc(du)), kpi("Réf. membre", S.membre ? S.membre.ref : "—"))),
        card("Mes cotisations", table([
          { t: "Cotisation", f: function (r) { return lib[r.contribution_id]; } }, { t: "Période", k: "periode" }, { t: "Échéance", f: function (r) { return fd(r.echeance); } },
          { t: "Appelé", n: 1, f: function (r) { return fc(r.montant_appele); } }, { t: "Payé", n: 1, f: function (r) { return fc(r.montant_paye); } },
          { t: "Statut", f: function (r) { return badge(r.statut); } }], appels, "Aucune cotisation appelée.")),
        card("États financiers publiés", etats.length ? etats.map(function (e) {
          return el("p", {}, el("b", {}, e.titre + " — " + e.periode), " · recettes " + fc(e.contenu.recettes) + " · dépenses " + fc(e.contenu.depenses) + " · trésorerie " + fc(e.contenu.tresorerie) + " · impayés " + fc(e.contenu.impayes));
        }) : el("p", { class: "mu" }, "Aucun état publié.")),
        card("Annonces", annonces.length ? annonces.map(function (a) { return el("p", {}, el("b", {}, a.titre), " ", el("span", { class: "mu" }, fd(a.publie_le)), el("br"), a.corps); }) : el("p", { class: "mu" }, "Aucune annonce.")),
        card("Prochaines réunions", table([{ t: "Date", f: function (r) { return fdt(r.date_heure); } }, { t: "Réunion", k: "titre" }, { t: "Lieu", k: "lieu" }], reunions, "Aucune réunion programmée.")));
    });
  }

  /* ---------- Finances ---------- */
  function vueFinances() {
    return Promise.all([
      ok(from("v_soldes_comptes").select("*").order("code")),
      ok(from("cash_movements").select("id,ref,sens,montant,categorie,date_op,source_type,motif,contre_ecriture_de").order("cree_le", { ascending: false }).limit(30)),
      ok(from("v_appels").select("montant_appele,montant_paye,reste,statut")),
      ok(from("cash_accounts").select("id,code,nom").eq("actif", true))
    ]).then(function (R) {
      var soldes = R[0], mouvements = R[1], appels = R[2], comptes = R[3];
      function somme(f, k) { return appels.filter(f).reduce(function (s, a) { return s + Number(a[k]); }, 0); }
      var annulees = {}; mouvements.forEach(function (m) { if (m.contre_ecriture_de) annulees[m.contre_ecriture_de] = 1; });
      return el("div", {},
        card("Trésorerie", el("div", { class: "grid" }, soldes.map(function (s) { return kpi(s.nom + " (" + s.type + ")", fc(s.solde)); }),
          kpi("Total appelé", fc(somme(function () { return true; }, "montant_appele"))), kpi("Encaissé", fc(somme(function () { return true; }, "montant_paye"))),
          kpi("Impayés en retard", fc(somme(function (a) { return a.statut === "en_retard"; }, "reste"))))),
        can("finance.encaisser") ? formPaiement(comptes) : null,
        card("Derniers mouvements", table([
          { t: "Date", f: function (r) { return fd(r.date_op); } }, { t: "Réf.", k: "ref" }, { t: "Catégorie", k: "categorie" },
          { t: "Entrée", n: 1, f: function (r) { return r.sens === "entree" ? fc(r.montant) : ""; } }, { t: "Sortie", n: 1, f: function (r) { return r.sens === "sortie" ? fc(r.montant) : ""; } },
          { t: "", f: function (r) { return annulees[r.id] ? badge("annulee") : (can("finance.annuler") && !r.contre_ecriture_de ? el("button", { class: "s", onclick: function () { annuler(r); } }, "Contrepasser") : r.motif || ""); } }], mouvements)),
        can("finance.publier") ? formPublication() : null);
    });
  }
  function formPaiement(comptes) {
    var compte = el("select", {}, comptes.map(function (c) { return el("option", { value: c.id }, c.code + " — " + c.nom); }));
    var appel = el("input", { placeholder: "Identifiant de l'appel (UUID)", pattern: "[0-9a-f-]{36}", required: true });
    var montant = el("input", { type: "number", min: 1, step: 1, required: true, inputmode: "numeric" });
    var mode = el("select", {}, [["especes", "Espèces"], ["mobile_money", "Mobile Money"], ["virement", "Virement"], ["cheque", "Chèque"]].map(function (x) { return el("option", { value: x[0] }, x[1]); }));
    var ref = el("input", { placeholder: "Référence Mobile Money / virement (facultatif)", maxlength: 60 });
    return card("Enregistrer un encaissement", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      rpc("enregistrer_paiement", { p_call: appel.value.trim(), p_member: null, p_account: compte.value, p_montant: Number(montant.value), p_mode: mode.value, p_ref_ext: ref.value.trim() || null })
        .then(function () { toast("Encaissement enregistré."); afficher(); }, function (e) { toast(msgErr(e), true); });
    } }, field("Appel de cotisation", appel), field("Compte", compte), field("Montant (F CFA)", montant), field("Mode", mode), field("Référence externe", ref), el("button", { class: "p", type: "submit" }, "Enregistrer")));
  }
  function annuler(m) {
    var motif = G.prompt("Motif de la contrepassation de " + m.ref + " (obligatoire) :");
    if (!motif) return;
    rpc("annuler_mouvement", { p_mouvement: m.id, p_motif: motif }).then(function () { toast("Écriture contrepassée."); afficher(); }, function (e) { toast(msgErr(e), true); });
  }
  function formPublication() {
    var per = el("input", { required: true, placeholder: "2026-T4", maxlength: 20 }), d = el("input", { type: "date", required: true }), f = el("input", { type: "date", required: true });
    return card("Publier l'état financier de la période", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      rpc("publier_etat_financier", { p_periode: per.value.trim(), p_debut: d.value, p_fin: f.value }).then(function () { toast("État publié aux membres."); }, function (e) { toast(msgErr(e), true); });
    } }, field("Période", per), field("Du", d), field("Au", f), el("button", { class: "p", type: "submit" }, "Publier (non modifiable)")));
  }

  /* ---------- Dépenses ---------- */
  var ROLES_VALIDEURS = ["president", "tresorier", "second_approbateur", "responsable_commission", "vice_president"];
  function vueDepenses() {
    return Promise.all([
      ok(from("expense_requests").select("*").order("cree_le", { ascending: false }).limit(40)),
      ok(from("expense_approvals").select("expense_id,role_code,decision,motif,le")),
      ok(from("v_budget_execution").select("line_id,exercice,categorie,disponible")),
      can("depense.payer") ? ok(from("v_soldes_comptes").select("id,code,nom,solde")) : Promise.resolve([]),
      ok(from("validation_rules").select("*").order("montant_min"))
    ]).then(function (R) {
      var deps = R[0], apr = R[1], lignes = R[2], comptes = R[3], regles = R[4], parDep = {};
      apr.forEach(function (a) { (parDep[a.expense_id] = parDep[a.expense_id] || []).push(a); });
      return el("div", {},
        can("depense.creer") ? formDepense(lignes) : null,
        card("Demandes de dépense", table([
          { t: "Réf.", k: "ref" }, { t: "Objet", f: function (r) { return r.objet + " — " + r.fournisseur; } }, { t: "Montant", n: 1, f: function (r) { return fc(r.montant); } },
          { t: "Validations", f: function (r) { return (parDep[r.id] || []).map(function (a) { return a.role_code + (a.decision === "rejete" ? " ✗" : " ✓"); }).join(", ") || "—"; } },
          { t: "Statut", f: function (r) { return badge(r.statut); } }, { t: "", f: function (r) { return actions(r, comptes); } }], deps)),
        card("Seuils de validation (paramétrables)", table([
          { t: "De", n: 1, f: function (r) { return fc(r.montant_min); } }, { t: "À", n: 1, f: function (r) { return r.montant_max == null ? "∞" : fc(r.montant_max); } },
          { t: "Rôles requis", f: function (r) { return r.roles_requis.join(" + "); } }, { t: "Décision formelle", f: function (r) { return r.decision_requise ? "Oui" : "Non"; } }], regles)));
    });
  }
  function actions(r, comptes) {
    var b = [];
    if (r.statut === "soumise" && can("depense.approuver")) {
      var role = S.roles.filter(function (x) { return ROLES_VALIDEURS.indexOf(x) >= 0; })[0];
      if (role) b.push(el("button", { class: "s", onclick: function () { decider(r, role, "approuve"); } }, "Approuver"), el("button", { class: "s", onclick: function () { decider(r, role, "rejete"); } }, "Rejeter"));
    }
    if (r.statut === "approuvee" && can("depense.payer") && comptes.length) b.push(el("button", { class: "p", onclick: function () { payer(r, comptes); } }, "Payer"));
    return el("div", { class: "row" }, b);
  }
  function decider(r, role, decision) {
    var motif = decision === "rejete" ? G.prompt("Motif du rejet (obligatoire) :") : null;
    if (decision === "rejete" && !motif) return;
    rpc("decider_depense", { p_depense: r.id, p_role: role, p_decision: decision, p_motif: motif }).then(function (res) { toast("Décision enregistrée : " + res); afficher(); }, function (e) { toast(msgErr(e), true); });
  }
  function payer(r, comptes) {
    var code = G.prompt("Compte payeur (" + comptes.map(function (c) { return c.code + " : " + fc(c.solde); }).join(" | ") + ") :", comptes[0].code);
    var compte = comptes.filter(function (c) { return c.code === code; })[0]; if (!compte) return;
    var just = G.prompt("Référence du justificatif de règlement (obligatoire) :"); if (!just) return;
    rpc("payer_depense", { p_depense: r.id, p_account: compte.id, p_justificatif: just }).then(function () { toast("Dépense payée."); afficher(); }, function (e) { toast(msgErr(e), true); });
  }
  function formDepense(lignes) {
    var objet = el("input", { required: true, minlength: 3, maxlength: 200 }), fourn = el("input", { required: true, maxlength: 120 });
    var montant = el("input", { type: "number", min: 1, step: 1, required: true, inputmode: "numeric" }), cat = el("input", { required: true, maxlength: 60, value: "entretien" });
    var ligne = el("select", {}, el("option", { value: "" }, "— hors budget —"), lignes.map(function (l) { return el("option", { value: l.line_id }, l.exercice + " · " + l.categorie + " (dispo " + fc(l.disponible) + ")"); }));
    var just = el("input", { placeholder: "Références des pièces (séparées par une virgule)", required: true }), dec = el("input", { placeholder: "Référence de la décision (si > seuil)", maxlength: 80 });
    return card("Nouvelle demande de dépense", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      rpc("soumettre_depense", { p_objet: objet.value.trim(), p_montant: Number(montant.value), p_categorie: cat.value.trim(), p_ligne: ligne.value || null, p_fournisseur: fourn.value.trim(),
        p_justificatifs: just.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean), p_decision_ref: dec.value.trim() || null })
        .then(function () { toast("Demande soumise."); afficher(); }, function (e) { toast(msgErr(e), true); });
    } }, field("Objet", objet), field("Fournisseur / bénéficiaire", fourn), field("Montant (F CFA)", montant), field("Catégorie", cat), field("Ligne budgétaire", ligne), field("Pièces justificatives", just), field("Décision formelle", dec),
      el("button", { class: "p", type: "submit" }, "Soumettre")));
  }

  /* ---------- Réunions, documents, audit ---------- */
  function vueReunions() {
    return Promise.all([
      ok(from("meetings").select("id,titre,type,date_heure,lieu,ordre_du_jour").order("date_heure", { ascending: false }).limit(20)),
      ok(from("minutes").select("meeting_id,version,contenu,statut").eq("statut", "publie")),
      ok(from("resolutions").select("numero,sujet,responsable,echeance,statut").order("cree_le", { ascending: false }).limit(20))
    ]).then(function (R) {
      var reunions = R[0], pv = R[1], res = R[2];
      function titre(id) { var r = reunions.filter(function (x) { return x.id === id; })[0]; return r ? r.titre : ""; }
      return el("div", {},
        card("Réunions", table([{ t: "Date", f: function (r) { return fdt(r.date_heure); } }, { t: "Type", k: "type" }, { t: "Réunion", k: "titre" }, { t: "Lieu", k: "lieu" }], reunions)),
        card("Procès-verbaux publiés", pv.length ? pv.map(function (p) { return el("details", {}, el("summary", {}, titre(p.meeting_id) + " — version " + p.version), el("pre", { class: "pre" }, p.contenu)); }) : el("p", { class: "mu" }, "Aucun PV publié.")),
        card("Décisions et actions", table([{ t: "N°", k: "numero" }, { t: "Sujet", k: "sujet" }, { t: "Responsable", k: "responsable" }, { t: "Échéance", f: function (r) { return fd(r.echeance); } }, { t: "Statut", k: "statut" }], res)));
    });
  }
  function vueDocuments() {
    return ok(from("documents").select("titre,categorie,version,chemin,visibilite,cree_le").order("cree_le", { ascending: false }).limit(50)).then(function (docs) {
      return card("Documents", table([{ t: "Titre", k: "titre" }, { t: "Catégorie", k: "categorie" }, { t: "Version", n: 1, k: "version" }, { t: "Ajouté", f: function (r) { return fd(r.cree_le); } },
        { t: "", f: function (r) { return el("button", { class: "s", onclick: function () {
          sb.storage.from("documents").createSignedUrl(r.chemin, 60).then(function (x) { if (x.error) return toast("Accès refusé.", true); G.open(x.data.signedUrl, "_blank", "noopener"); });
        } }, "Ouvrir"); } }], docs, "Aucun document accessible."));
    });
  }
  function vueAudit() {
    return Promise.all([ok(from("audit_logs").select("id,le,acteur,action,table_nom,ligne_id").order("id", { ascending: false }).limit(60)), rpc("verifier_chaine_audit")]).then(function (R) {
      var logs = R[0], rupt = R[1];
      return el("div", {}, card("Intégrité du journal", el("p", {}, rupt.length ? badge("annulee") : badge("paye"), rupt.length ? " " + rupt.length + " rupture(s) de chaîne détectée(s) — alerter le comité." : " Chaîne d'empreintes intacte.")),
        card("Journal d'audit (60 derniers événements)", table([{ t: "#", k: "id" }, { t: "Date", f: function (r) { return fdt(r.le); } }, { t: "Action", k: "action" }, { t: "Table", k: "table_nom" },
          { t: "Ligne", f: function (r) { return (r.ligne_id || "").slice(0, 8); } }, { t: "Acteur", f: function (r) { return (r.acteur || "système").slice(0, 8); } }], logs)));
    });
  }

  /* ---------- Démarrage ---------- */
  function demarrer() {
    if (!API.configured) return vueConfig();
    sb.auth.getSession().then(function (r) {
      if (!r.data.session) return vueLogin();
      S.user = r.data.session.user;
      return API.chargerDroits(S.user.id).then(function (d) {
        S.roles = d.roles; S.perms = d.perms;
        return ok(from("members").select("id,ref,nom,prenoms").eq("user_id", S.user.id).limit(1));
      }).then(function (m) { S.membre = m[0] || null; }, function (e) { toast(msgErr(e), true); }).then(afficher);
    });
  }
  if (API.configured && !API.enDemo) sb.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_OUT") vueLogin(); });
  if ("serviceWorker" in navigator && G.location.protocol.indexOf("http") === 0) navigator.serviceWorker.register("sw.js").catch(function () { });
  demarrer();
})(window);
