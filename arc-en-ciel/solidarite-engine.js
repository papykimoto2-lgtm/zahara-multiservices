/* Solidarité ARC-EN-CIEL CONNECT (V2) : demandes d'aide, fonds de solidarité, publication sans révéler la situation personnelle.
   - Circuit : dépôt → instruction (commission sociale) → validation (autre personne) → versement (autre personne encore) depuis le fonds.
   - Le dossier (description, bénéficiaire) n'est visible que du bénéficiaire et de la commission ; la cité ne voit que montant et date.
   - Les textes de situation personnelle n'entrent jamais dans le journal d'audit.
   Dépend de arc-engine.js (ARC_APP), ui-engine.js, api-engine.js. */
(function (G) {
  "use strict";
  var A = G.ARC_APP, UI = G.ARC_UI, API = G.ARC_API;
  if (!A) return;
  var el = UI.el, fc = UI.fc, fd = UI.fd, badge = UI.badge, kpi = UI.kpi, card = UI.card, table = UI.table, toast = UI.toast, field = UI.field, msgErr = UI.msgErr;
  var ok = API.ok, rpc = API.rpc, from = API.from, can = A.can;
  function echec(e) { toast(msgErr(e), true); }
  function fait(m) { return function () { toast(m); A.afficher(); }; }
  var TYPES = [["maladie", "Maladie grave"], ["hospitalisation", "Hospitalisation"], ["deces", "Décès d'un proche"], ["accident", "Accident"], ["difficulte", "Difficulté sociale exceptionnelle"], ["sinistre", "Sinistre touchant le logement"], ["urgence", "Urgence nécessitant une mobilisation"]];
  var STAT = { deposee: ["Déposée", "wa"], verifiee: ["Vérifiée", "wa"], proposee: ["À valider", "wa"], validee: ["Validée — à verser", "ok"], refusee: ["Refusée", "er"], versee: ["Versée", "ok"], close: ["Close", ""] };
  function st(s) { var x = STAT[s] || [s, ""]; return el("span", { class: "b " + x[1] }, x[0]); }

  function vueSoc() {
    var commission = can("social.instruire") || can("social.valider") || can("depense.payer");
    return Promise.all([
      ok(from("v_fonds_solidarite").select("*")), ok(from("v_aides_publiees").select("*").order("date_versement", { ascending: false }).limit(20)),
      ok(from("social_cases").select("id,ref,type,description,montant_demande,statut,montant_propose,motif,cree_le,member_id").order("cree_le", { ascending: false }).limit(40)),
      can("finance.encaisser") || can("depense.payer") ? ok(from("cash_accounts").select("id,code,nom,type").eq("type", "fonds_solidarite")) : Promise.resolve([])
    ]).then(function (R) {
      var f = R[0][0] || { solde: 0, dons: 0, aides: 0 }, pub = R[1], dos = R[2], comptes = R[3], mid = A.S.membre ? A.S.membre.id : null;
      var lib = function (t) { var x = TYPES.filter(function (y) { return y[0] === t; })[0]; return x ? x[1] : t; };
      return el("div", {},
        el("div", { class: "grid" }, kpi("solde du fonds", fc(f.solde), "🤝"), kpi("dons reçus", fc(f.dons), "💝"), kpi("aides versées", fc(f.aides), "🫶")),
        card("Aides accordées par la cité", table([{ t: "Réf.", k: "ref" }, { t: "Date", f: function (r) { return fd(r.date_versement); } }, { t: "Montant", n: 1, f: function (r) { return fc(r.montant); } }], pub, "Aucune aide versée pour l'instant."),
          el("p", { class: "mu" }, "Seuls le montant et la date sont publiés : la situation des bénéficiaires reste confidentielle.")),
        formAide(), comptes.length && can("finance.encaisser") ? formDon(comptes) : null,
        card(commission ? "Dossiers d'aide (confidentiel)" : "Mes demandes d'aide", table([{ t: "Réf.", k: "ref" }, { t: "Type", f: function (r) { return lib(r.type) + (r.member_id === mid ? " (moi)" : ""); } },
          { t: "Situation", f: function (r) { return r.description; } }, { t: "Demandé", n: 1, f: function (r) { return r.montant_demande ? fc(r.montant_demande) : "—"; } }, { t: "Proposé", n: 1, f: function (r) { return r.montant_propose ? fc(r.montant_propose) : "—"; } },
          { t: "Statut", f: function (r) { return st(r.statut); } }, { t: "", f: function (r) { return actions(r, comptes); } }], dos, "Aucune demande.")));
    });
  }
  function actions(r, comptes) {
    var b = [];
    if (r.statut === "deposee" && can("social.instruire")) b.push(el("button", { class: "s", onclick: function () { instruire(r); } }, "Instruire"));
    if (r.statut === "proposee" && can("social.valider")) b.push(el("button", { class: "p", onclick: function () { decider(r, true); } }, "Accorder"), el("button", { class: "s", onclick: function () { decider(r, false); } }, "Refuser"));
    if (r.statut === "validee" && can("depense.payer") && comptes.length) b.push(el("button", { class: "p", onclick: function () { verser(r, comptes[0]); } }, "Verser"));
    return el("div", { class: "row" }, b);
  }
  function instruire(r) {
    var m = G.prompt("Montant d'aide proposé (F CFA) :", r.montant_demande || ""); if (!m) return;
    var avis = G.prompt("Avis de la commission (vérifications effectuées) :", "Situation vérifiée"); if (!avis) return;
    rpc("instruire_aide", { p_id: r.id, p_montant_propose: Number(m), p_avis: avis }).then(fait("Proposition transmise pour validation."), echec);
  }
  function decider(r, accord) {
    var motif = accord ? null : G.prompt("Motif du refus (obligatoire) :"); if (!accord && !motif) return;
    rpc("decider_aide", { p_id: r.id, p_accord: accord, p_motif: motif }).then(fait(accord ? "Aide accordée." : "Demande refusée."), echec);
  }
  function verser(r, compte) {
    if (!G.confirm("Verser " + fc(r.montant_propose) + " depuis « " + compte.nom + " » ?")) return;
    rpc("verser_aide", { p_id: r.id, p_account: compte.id }).then(fait("Aide versée et comptabilisée."), echec);
  }
  function formAide() {
    var type = el("select", {}, TYPES.map(function (x) { return el("option", { value: x[0] }, x[1]); })), desc = el("textarea", { required: true, rows: 3, minlength: 5 }), m = el("input", { type: "number", min: 1, step: 1, inputmode: "numeric" });
    return card("Demander une aide (confidentiel)", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      rpc("demander_aide", { p_type: type.value, p_description: desc.value.trim(), p_montant: m.value ? Number(m.value) : null }).then(fait("Demande enregistrée. La commission sociale l'examinera avec discrétion."), echec);
    } }, field("Nature de la situation", type), field("Explication (visible de la commission seulement)", desc), field("Montant souhaité (F CFA, facultatif)", m), el("button", { class: "p", type: "submit" }, "Envoyer la demande")));
  }
  function formDon(comptes) {
    var compte = el("select", {}, comptes.map(function (c) { return el("option", { value: c.id }, c.nom); })), m = el("input", { type: "number", min: 1, step: 1, required: true, inputmode: "numeric" }), don = el("input", { maxlength: 100, placeholder: "Donateur (facultatif)" });
    return card("Enregistrer un don au fonds", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      rpc("enregistrer_don", { p_account: compte.value, p_montant: Number(m.value), p_donateur: don.value.trim() || null }).then(fait("Don enregistré."), echec);
    } }, field("Fonds", compte), field("Montant (F CFA)", m), field("Donateur", don), el("button", { class: "p", type: "submit" }, "Enregistrer")));
  }

  A.alerte(function () {
    if (!(can("social.instruire") || can("social.valider") || can("depense.payer"))) return Promise.resolve([]);
    return ok(from("social_cases").select("id,statut")).then(function (D) {
      var L = [], n = function (s) { return D.filter(function (d) { return d.statut === s; }).length; };
      if (can("social.instruire") && n("deposee")) L.push({ id: "soc-instr", c: "wa", t: n("deposee") + " demande(s) d'aide à instruire.", v: "solidarite", l: "Voir les dossiers →" });
      if (can("social.valider") && n("proposee")) L.push({ id: "soc-val", c: "wa", t: n("proposee") + " aide(s) à valider.", v: "solidarite", l: "Voir les dossiers →" });
      if (can("depense.payer") && n("validee")) L.push({ id: "soc-pay", c: "wa", t: n("validee") + " aide(s) validée(s) à verser.", v: "solidarite", l: "Voir les dossiers →" });
      return L;
    });
  });
  A.vue("solidarite", "🤝 Solidarité", function () { return true; }, vueSoc, "reclamations");
})(window);
