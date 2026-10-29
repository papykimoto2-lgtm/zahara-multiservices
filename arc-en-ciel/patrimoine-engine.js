/* Patrimoine et satisfaction ARC-EN-CIEL CONNECT (V3) : assurances et sinistres, consommations communes (eau, électricité) et évolution des charges, enquêtes de satisfaction.
   - Contrats : alerte à 60 jours de l'échéance ; un sinistre doit tomber dans la période du contrat ; « indemnisé » exige le montant.
   - Charges : une hausse de plus de 30 % d'un mois sur l'autre est signalée (à vérifier : fuite, compteur, facturation).
   - Enquêtes : réponses anonymes (émargement et réponses séparés) ; résultats affichés seulement à partir de 5 réponses.
   Dépend de arc-engine.js (ARC_APP), ui-engine.js, api-engine.js, export-engine.js. */
(function (G) {
  "use strict";
  var A = G.ARC_APP, UI = G.ARC_UI, API = G.ARC_API, X = G.ARC_EXPORT;
  if (!A) return;
  var el = UI.el, fc = UI.fc, fd = UI.fd, fdt = UI.fdt, badge = UI.badge, card = UI.card, table = UI.table, toast = UI.toast, field = UI.field, msgErr = UI.msgErr, kpi = UI.kpi;
  var ok = API.ok, rpc = API.rpc, from = API.from, can = A.can;
  function echec(e) { toast(msgErr(e), true); }
  function fait(m) { return function () { toast(m); A.afficher(); }; }
  function maj(r) { if (r.error) throw r.error; }
  var ETAT = { ok: ["En règle", "ok"], a_renouveler: ["À renouveler", "wa"], expire: ["Expiré", "er"] };
  var SIN = { declare: ["Déclaré", "wa"], instruction: ["En instruction", "wa"], indemnise: ["Indemnisé", "ok"], refuse: ["Refusé", "er"], clos: ["Clos", ""] };
  function pastille(M, k) { var x = M[k] || [k, ""]; return el("span", { class: "b " + x[1] }, x[0]); }

  function vuePatri() {
    return Promise.all([ok(from("v_assurances_echeances").select("*").order("fin")), ok(from("insurance_claims").select("*").order("cree_le", { ascending: false }).limit(30)),
      ok(from("v_evolution_charges").select("*").order("periode", { ascending: false }).limit(60))]).then(function (R) {
      var ct = R[0], sin = R[1], ch = R[2], ge = can("assurance.gerer"), gc = can("charges.gerer");
      var colsC = [{ t: "Type", k: "type" }, { t: "Compteur", k: "compteur" }, { t: "Période", k: "periode" }, { t: "Consommation", n: 1, f: function (r) { return r.consommation == null ? "—" : r.consommation; } }, { t: "Montant", n: 1, f: function (r) { return fc(r.montant); } },
        { t: "Variation / mois précédent", n: 1, f: function (r) { return r.variation_pct == null ? "—" : r.variation_pct + " %"; } }, { t: "Variation / an", n: 1, f: function (r) { return r.variation_an_pct == null ? "—" : r.variation_an_pct + " %"; } },
        { t: "", f: function (r) { return r.anomalie ? el("span", { class: "b er" }, "⚠ hausse > 30 %") : ""; }, x: function (r) { return r.anomalie ? "hausse > 30 %" : ""; } }];
      return el("div", {},
        el("div", { class: "grid" }, kpi("contrats à renouveler", String(ct.filter(function (c) { return c.etat === "a_renouveler"; }).length), "🛡️"), kpi("contrats expirés", String(ct.filter(function (c) { return c.etat === "expire"; }).length), "⚠️"),
          kpi("hausses de charges à vérifier", String(ch.filter(function (c) { return c.anomalie; }).length), "💧")),
        card("Contrats d'assurance", table([{ t: "Assureur", k: "assureur" }, { t: "Police", k: "police" }, { t: "Objet", k: "objet" }, { t: "Échéance", f: function (r) { return fd(r.fin); } }, { t: "Jours restants", n: 1, k: "jours_restants" }, { t: "État", f: function (r) { return pastille(ETAT, r.etat); } }], ct, "Aucun contrat enregistré.")),
        ge ? formContrat() : null,
        card("Sinistres", table([{ t: "Réf.", k: "ref" }, { t: "Date", f: function (r) { return fd(r.date_sinistre); } }, { t: "Description", k: "description" }, { t: "Estimé", n: 1, f: function (r) { return r.montant_estime == null ? "—" : fc(r.montant_estime); } },
          { t: "Indemnisé", n: 1, f: function (r) { return r.montant_indemnise == null ? "—" : fc(r.montant_indemnise); } }, { t: "Statut", f: function (r) { return pastille(SIN, r.statut); } },
          { t: "", f: function (r) { return ge && ["declare", "instruction"].indexOf(r.statut) >= 0 ? el("div", { class: "row" }, el("button", { class: "s", onclick: function () { sinistre(r, "instruction"); } }, "Instruction"), el("button", { class: "s", onclick: function () { sinistre(r, "indemnise"); } }, "Indemnisé"), el("button", { class: "s", onclick: function () { sinistre(r, "refuse"); } }, "Refusé")) : ""; } }], sin, "Aucun sinistre.")),
        ge && ct.length ? formSinistre(ct) : null,
        card("Consommations et évolution des charges", table(colsC, ch, "Aucun relevé."), X.barre("charges", colsC, ch)), gc ? formCharge() : null);
    });
  }
  function formContrat() {
    var f = {}; ["assureur", "police", "objet"].forEach(function (k) { f[k] = el("input", { required: true, maxlength: 120 }); });
    var prime = el("input", { type: "number", min: 0, step: 1, required: true, inputmode: "numeric" }), d = el("input", { type: "date", required: true }), e = el("input", { type: "date", required: true });
    return card("Enregistrer un contrat d'assurance", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      from("insurance_contracts").insert([{ assureur: f.assureur.value.trim(), police: f.police.value.trim(), objet: f.objet.value.trim(), prime_annuelle: Number(prime.value), debut: d.value, fin: e.value }]).then(function (r) { maj(r); toast("Contrat enregistré."); A.afficher(); }).catch(echec);
    } }, field("Assureur", f.assureur), field("N° de police", f.police), field("Objet couvert", f.objet), field("Prime annuelle (F CFA)", prime), field("Début", d), field("Fin", e), el("button", { class: "p", type: "submit" }, "Enregistrer")));
  }
  function formSinistre(ct) {
    var c = el("select", {}, ct.map(function (x) { return el("option", { value: x.id }, x.police + " — " + x.objet); })), d = el("input", { type: "date", required: true }), t = el("textarea", { required: true, rows: 3, minlength: 5 }), m = el("input", { type: "number", min: 0, step: 1 });
    return card("Déclarer un sinistre", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      rpc("declarer_sinistre", { p_contrat: c.value, p_date: d.value, p_description: t.value.trim(), p_estime: m.value ? Number(m.value) : null, p_asset: null }).then(fait("Sinistre déclaré."), echec);
    } }, field("Contrat", c), field("Date du sinistre", d), field("Description", t), field("Montant estimé (F CFA)", m), el("button", { class: "p", type: "submit" }, "Déclarer")));
  }
  function sinistre(r, statut) {
    var upd = { statut: statut };
    if (statut === "indemnise") { var m = G.prompt("Montant indemnisé (F CFA) :", r.montant_estime || ""); if (!m) return; upd.montant_indemnise = Number(m); }
    if (statut === "refuse") { var mo = G.prompt("Motif du refus de l'assureur (obligatoire) :"); if (!mo) return; upd.motif = mo; }
    from("insurance_claims").update(upd).eq("id", r.id).then(function (x) { maj(x); toast("Sinistre mis à jour."); A.afficher(); }).catch(echec);
  }
  function formCharge() {
    var type = el("select", {}, [["eau", "Eau"], ["electricite", "Électricité"], ["autre", "Autre"]].map(function (x) { return el("option", { value: x[0] }, x[1]); })), cpt = el("input", { required: true, maxlength: 40, placeholder: "Compteur ou point de livraison" });
    var per = el("input", { required: true, pattern: "[0-9]{4}-(0[1-9]|1[0-2])", placeholder: "2026-10" }), conso = el("input", { type: "number", min: 0, step: "0.01" }), mt = el("input", { type: "number", min: 0, step: 1, required: true, inputmode: "numeric" });
    return card("Saisir un relevé de consommation", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      from("utility_readings").insert([{ type: type.value, compteur: cpt.value.trim(), periode: per.value.trim(), consommation: conso.value ? Number(conso.value) : null, montant: Number(mt.value) }]).then(function (r) { maj(r); toast("Relevé enregistré."); A.afficher(); }).catch(echec);
    } }, field("Nature", type), field("Compteur", cpt), field("Période (AAAA-MM)", per), field("Consommation (m³ ou kWh)", conso), field("Montant facturé (F CFA)", mt), el("button", { class: "p", type: "submit" }, "Enregistrer")));
  }

  /* ---------- Enquêtes de satisfaction ---------- */
  function vueEnq() {
    return ok(from("surveys").select("*").order("cloture", { ascending: false }).limit(10)).then(function (S) {
      return el("div", {}, S.length ? S.map(carteEnquete) : card("Enquêtes de satisfaction", el("p", { class: "mu" }, "Aucune enquête en cours.")), can("enquete.gerer") ? formEnquete() : null);
    });
  }
  function carteEnquete(s) {
    var corps = [el("p", { class: "mu" }, "Du " + fdt(s.ouverture) + " au " + fdt(s.cloture) + " · anonyme · résultats affichés à partir de 5 réponses.")], zone = el("div", {});
    if (s.statut === "brouillon") corps.push(can("enquete.gerer") ? el("button", { class: "p", onclick: function () { rpc("ouvrir_enquete", { p_id: s.id }).then(fait("Enquête ouverte."), echec); } }, "Ouvrir l'enquête") : badge("brouillon"));
    if (s.statut === "ouverte") {
      var sels = s.themes.map(function (t) { return el("select", {}, [5, 4, 3, 2, 1].map(function (n) { return el("option", { value: n }, n + " / 5" + (n === 5 ? " — très satisfait" : n === 1 ? " — pas du tout" : "")); })); });
      corps.push(el("form", { onsubmit: function (ev) { ev.preventDefault(); rpc("repondre_enquete", { p_id: s.id, p_notes: sels.map(function (x) { return Number(x.value); }) }).then(fait("Merci pour votre réponse (anonyme)."), echec); } },
        s.themes.map(function (t, i) { return field(t, sels[i]); }), el("button", { class: "p", type: "submit" }, "Envoyer (anonyme)")));
    }
    corps.push(el("button", { class: "s", onclick: function () {
      rpc("resultats_enquete", { p_id: s.id }).then(function (R) {
        zone.replaceChildren(table([{ t: "Thème", k: "theme" }, { t: "Note moyenne", n: 1, f: function (r) { return r.moyenne + " / 5"; } }, { t: "Réponses", n: 1, k: "reponses" }], R), X.barre("enquete-" + s.id.slice(0, 6), [{ t: "Thème", k: "theme" }, { t: "Moyenne", k: "moyenne" }, { t: "Réponses", k: "reponses" }], R));
      }, echec);
    } }, "Voir les résultats"), zone);
    return card("😊 " + s.titre, corps);
  }
  function formEnquete() {
    var titre = el("input", { required: true, maxlength: 120 }), th = el("textarea", { required: true, rows: 4, placeholder: "Un thème par ligne : Communication, Entretien, Confiance…" });
    var o = el("input", { type: "datetime-local", required: true }), c = el("input", { type: "datetime-local", required: true });
    return card("Organiser une enquête de satisfaction", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      var T = th.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      from("surveys").insert([{ titre: titre.value.trim(), themes: T, ouverture: new Date(o.value).toISOString(), cloture: new Date(c.value).toISOString() }]).then(function (r) { maj(r); toast("Enquête créée (brouillon)."); A.afficher(); }).catch(echec);
    } }, field("Titre", titre), field("Thèmes à noter", th), field("Ouverture", o), field("Clôture", c), el("button", { class: "p", type: "submit" }, "Créer le brouillon")));
  }

  A.alerte(function () {
    var L = [];
    return Promise.all([can("assurance.gerer") || can("finance.lire") ? ok(from("v_assurances_echeances").select("id,police,etat")).then(function (C) {
      var a = C.filter(function (c) { return c.etat === "a_renouveler"; }), e = C.filter(function (c) { return c.etat === "expire"; });
      if (e.length) L.push({ id: "assur-exp", c: "er", t: e.length + " contrat(s) d'assurance expiré(s) : " + e.map(function (c) { return c.police; }).join(", ") + ".", v: "patrimoine", l: "Voir les assurances →" });
      if (a.length) L.push({ id: "assur-ren", c: "wa", t: a.length + " contrat(s) d'assurance à renouveler sous 60 jours.", v: "patrimoine", l: "Voir les assurances →" });
    }) : null, can("charges.gerer") || can("finance.lire") ? ok(from("v_evolution_charges").select("periode,anomalie")).then(function (C) {
      var n = C.filter(function (c) { return c.anomalie; }).length; if (n) L.push({ id: "charges" + n, c: "wa", t: n + " hausse(s) de charges de plus de 30 % à vérifier (fuite, compteur, facture).", v: "patrimoine", l: "Voir les charges →" });
    }) : null, ok(from("surveys").select("id,titre").eq("statut", "ouverte")).then(function (E) {
      E.forEach(function (s) { L.push({ id: "enq" + s.id, c: "in", t: "Enquête en cours : « " + s.titre + " » — donnez votre avis (anonyme).", v: "enquetes", l: "Répondre →" }); });
    })].filter(Boolean)).then(function () { return L; });
  });
  A.vue("patrimoine", "🛡️ Assurances et charges", function () { return can("assurance.gerer") || can("finance.lire") || can("charges.gerer") || can("audit.lire"); }, vuePatri, "solidarite");
  A.vue("enquetes", "😊 Enquêtes", function () { return true; }, vueEnq, "patrimoine");
})(window);
