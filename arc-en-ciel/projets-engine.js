/* Projets et prestataires ARC-EN-CIEL CONNECT (V2) : plan court / moyen / long terme, suivi budgétaire, devis comparés.
   - Un projet ne passe « autorisé », « en cours » ou « terminé » qu'avec la référence de la décision qui l'autorise ; « terminé » exige 100 % et un bilan.
   - Dépenses rattachées au projet : engagé / payé comparés au coût estimé ; dépassement et retard signalés.
   - Devis : au-delà du seuil (paramètre), plusieurs devis comparables sont exigés ; le choix est motivé et journalisé.
   Dépend de arc-engine.js (ARC_APP), ui-engine.js, api-engine.js. */
(function (G) {
  "use strict";
  var A = G.ARC_APP, UI = G.ARC_UI, API = G.ARC_API;
  if (!A) return;
  var el = UI.el, fc = UI.fc, fd = UI.fd, badge = UI.badge, kpi = UI.kpi, card = UI.card, table = UI.table, toast = UI.toast, field = UI.field, msgErr = UI.msgErr;
  var ok = API.ok, rpc = API.rpc, from = API.from, can = A.can;
  function echec(e) { toast(msgErr(e), true); }
  function fait(m) { return function () { toast(m); A.afficher(); }; }
  function maj(r) { if (r.error) throw r.error; }
  var HORIZON = { court: "Court terme (0–12 mois)", moyen: "Moyen terme (1–3 ans)", long: "Long terme (3–10 ans)" };
  var STATUTS = ["idee", "etude", "autorise", "en_cours", "termine", "suspendu", "abandonne"];

  function vueProjets() {
    var gestion = can("projet.gerer"), dev = can("prestataire.gerer");
    return Promise.all([
      ok(from("v_projets").select("*").order("cree_le", { ascending: false })),
      dev ? ok(from("quotes").select("*").order("dossier")) : Promise.resolve([]),
      dev ? ok(from("suppliers").select("id,nom").eq("actif", true)) : Promise.resolve([])
    ]).then(function (R) {
      var P = R[0], Q = R[1], F = R[2], nom = {}; F.forEach(function (f) { nom[f.id] = f.nom; });
      var actifs = P.filter(function (p) { return p.statut === "en_cours"; });
      var tot = P.filter(function (p) { return p.statut !== "abandonne"; }).reduce(function (s, p) { return s + Number(p.cout_estime); }, 0);
      return el("div", {},
        el("div", { class: "grid" }, kpi("projets en cours", String(actifs.length), "🏗️"), kpi("en retard", String(P.filter(function (p) { return p.en_retard; }).length), "⏰"),
          kpi("hors budget", String(P.filter(function (p) { return p.depassement; }).length), "⚠️"), kpi("coût estimé du plan", fc(tot), "📐")),
        ["court", "moyen", "long"].map(function (h) {
          var L = P.filter(function (p) { return p.horizon === h; });
          return card(HORIZON[h], table([{ t: "Code", k: "code" }, { t: "Projet", k: "intitule" }, { t: "Responsable", k: "responsable" },
            { t: "Avancement", f: function (r) { return el("span", { class: "row" }, el("progress", { value: r.avancement, max: 100 }), r.avancement + " %"); } },
            { t: "Estimé", n: 1, f: function (r) { return fc(r.cout_estime); } }, { t: "Engagé + payé", n: 1, f: function (r) { return fc(Number(r.engage) + Number(r.paye)); } },
            { t: "Échéance", f: function (r) { return fd(r.fin_prevue); } },
            { t: "Statut", f: function (r) { return el("span", {}, badge(r.statut), r.depassement ? " ⚠️ hors budget" : "", r.en_retard ? " ⏰ retard" : ""); } },
            { t: "", f: function (r) { return gestion ? el("div", { class: "row" }, el("button", { class: "s", onclick: function () { statut(r); } }, "Statut"), el("button", { class: "s", onclick: function () { avancement(r); } }, "Avancement"), el("button", { class: "s", onclick: function () { lier(r); } }, "Lier une dépense")) : ""; } }],
            L, "Aucun projet à cet horizon."));
        }),
        gestion ? formProjet() : null,
        dev ? [carteDevis(Q, nom), formDevis(F)] : null);
    });
  }
  function formProjet() {
    var code = el("input", { required: true, maxlength: 20, placeholder: "PRJ-2027-01" }), nom = el("input", { required: true, minlength: 3, maxlength: 140 }), hor = el("select", {}, ["court", "moyen", "long"].map(function (h) { return el("option", { value: h }, HORIZON[h]); }));
    var cout = el("input", { type: "number", min: 0, step: 1, required: true, inputmode: "numeric" }), resp = el("input", { maxlength: 80 }), fin = el("input", { type: "date" }), fi = el("input", { maxlength: 160, placeholder: "Sources de financement" });
    return card("Nouveau projet", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      from("projects").insert([{ code: code.value.trim(), intitule: nom.value.trim(), horizon: hor.value, cout_estime: Number(cout.value), responsable: resp.value.trim() || null, fin_prevue: fin.value || null, financement: fi.value.trim() || null }])
        .then(function (r) { maj(r); toast("Projet créé (idée)."); A.afficher(); }).catch(echec);
    } }, field("Code", code), field("Intitulé", nom), field("Horizon", hor), field("Coût estimé (F CFA)", cout), field("Responsable", resp), field("Échéance prévue", fin), field("Financement", fi), el("button", { class: "p", type: "submit" }, "Créer")));
  }
  function statut(r) {
    var s = G.prompt("Nouveau statut (" + STATUTS.join(", ") + ") :", r.statut); if (!s || STATUTS.indexOf(s) < 0) return;
    var d = r.decision_ref, bilan = r.bilan;
    if (["autorise", "en_cours", "termine"].indexOf(s) >= 0) { d = G.prompt("Référence de la décision qui autorise le projet (obligatoire) :", d || ""); if (!d) return; }
    if (s === "termine") { bilan = G.prompt("Bilan final (obligatoire ; 100 % d'avancement requis) :", bilan || ""); if (!bilan) return; }
    from("projects").update({ statut: s, decision_ref: d || null, bilan: bilan || null, avancement: s === "termine" ? 100 : r.avancement }).eq("id", r.id).then(function (x) { maj(x); toast("Projet mis à jour."); A.afficher(); }).catch(echec);
  }
  function avancement(r) {
    var v = G.prompt("Avancement en % (0–100) :", r.avancement); if (v == null || v === "") return;
    from("projects").update({ avancement: Math.max(0, Math.min(100, Math.round(Number(v)))) }).eq("id", r.id).then(function (x) { maj(x); toast("Avancement enregistré."); A.afficher(); }).catch(echec);
  }
  function lier(r) {
    var ref = G.prompt("Référence de la dépense à rattacher (ex. DEP-2026-000021) :"); if (!ref) return;
    ok(from("expense_requests").select("id").eq("ref", ref.trim())).then(function (x) {
      if (!x.length) throw { message: "Dépense introuvable." };
      return rpc("lier_depense_projet", { p_depense: x[0].id, p_projet: r.id });
    }).then(fait("Dépense rattachée au projet.")).catch(echec);
  }
  function carteDevis(Q, nom) {
    var dossiers = {}; Q.forEach(function (q) { (dossiers[q.dossier] = dossiers[q.dossier] || []).push(q); });
    var noms = Object.keys(dossiers);
    return card("Comparatif des devis", noms.length ? noms.map(function (d) {
      var L = dossiers[d].slice().sort(function (a, b) { return a.montant - b.montant; });
      return el("div", {}, el("h3", {}, d + " (" + L.length + " devis)"), table([{ t: "Prestataire", f: function (r) { return nom[r.supplier_id] || "—"; } }, { t: "Montant", n: 1, f: function (r) { return fc(r.montant); } },
        { t: "Délai (j)", n: 1, k: "delai_jours" }, { t: "Garantie", k: "garantie" }, { t: "Choix", f: function (r) { return r.retenu ? el("span", {}, badge("paye"), " " + (r.justification || "")) : ""; } },
        { t: "", f: function (r) { return !r.retenu && !L.some(function (x) { return x.retenu; }) ? el("button", { class: "s", onclick: function () { retenir(r); } }, "Retenir") : ""; } }], L));
    }) : el("p", { class: "mu" }, "Aucun devis enregistré."));
  }
  function retenir(q) {
    var j = G.prompt("Justification du choix (obligatoire) :"); if (!j) return;
    var d = G.prompt("Référence de la décision (facultatif) :", "");
    rpc("retenir_devis", { p_devis: q.id, p_justification: j, p_decision_ref: d || null }).then(fait("Devis retenu et journalisé."), echec);
  }
  function formDevis(F) {
    var dossier = el("input", { required: true, maxlength: 140, placeholder: "Objet : ex. Éclairage de la voie principale" }), four = el("input", { list: "arc-fourn", required: true, placeholder: "Prestataire (existant ou nouveau)", maxlength: 100 });
    var dl = el("datalist", { id: "arc-fourn" }, F.map(function (f) { return el("option", { value: f.nom }); }));
    var montant = el("input", { type: "number", min: 1, step: 1, required: true, inputmode: "numeric" }), delai = el("input", { type: "number", min: 0, step: 1 }), gar = el("input", { maxlength: 80 });
    return card("Enregistrer un devis", dl, el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      var n = four.value.trim(), ex = F.filter(function (f) { return f.nom === n; })[0];
      (ex ? Promise.resolve(ex.id) : from("suppliers").insert([{ nom: n }]).select("id").then(function (r) { maj(r); return r.data[0].id; }))
        .then(function (id) { return from("quotes").insert([{ dossier: dossier.value.trim(), supplier_id: id, montant: Number(montant.value), delai_jours: delai.value ? Number(delai.value) : null, garantie: gar.value.trim() || null }]); })
        .then(function (r) { maj(r); toast("Devis enregistré."); A.afficher(); }).catch(echec);
    } }, field("Dossier", dossier), field("Prestataire", four), field("Montant (F CFA)", montant), field("Délai (jours)", delai), field("Garantie", gar), el("button", { class: "p", type: "submit" }, "Enregistrer")));
  }

  A.alerte(function () {
    return ok(from("v_projets").select("code,en_retard,depassement,statut")).then(function (P) {
      var L = [], r = P.filter(function (p) { return p.en_retard; }), h = P.filter(function (p) { return p.depassement; });
      if (r.length) L.push({ id: "prj-retard", c: "wa", t: r.length + " projet(s) en retard : " + r.map(function (p) { return p.code; }).join(", ") + ".", v: "projets", l: "Voir les projets →" });
      if (h.length) L.push({ id: "prj-budget", c: "er", t: h.length + " projet(s) au-delà du coût estimé : " + h.map(function (p) { return p.code; }).join(", ") + ".", v: "projets", l: "Voir les projets →" });
      return L;
    });
  });
  A.vue("projets", "🏗️ Projets", function () { return true; }, vueProjets, "depenses");
})(window);
