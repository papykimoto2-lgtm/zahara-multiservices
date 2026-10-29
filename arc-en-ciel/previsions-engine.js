/* Prévisions et pilotage ARC-EN-CIEL CONNECT (V3) : scénarios prudent / réaliste / ambitieux, plan pluriannuel, indicateurs de performance, aide à la décision.
   - Les scénarios sont des PROJECTIONS (calculées sur les 6 derniers mois réellement encaissés / dépensés) : jamais comptées comme des recettes.
   - L'aide à la décision est un jeu de RÈGLES lisibles, pas une IA qui décide : elle ne propose ni ne déclenche aucun paiement, sanction ou aide sociale.
   Dépend de arc-engine.js (ARC_APP), ui-engine.js, api-engine.js, export-engine.js. */
(function (G) {
  "use strict";
  var A = G.ARC_APP, UI = G.ARC_UI, API = G.ARC_API, X = G.ARC_EXPORT;
  if (!A) return;
  var el = UI.el, fc = UI.fc, card = UI.card, table = UI.table, toast = UI.toast, field = UI.field, msgErr = UI.msgErr, kpi = UI.kpi;
  var ok = API.ok, rpc = API.rpc, from = API.from, can = A.can;
  var NOMS = { prudent: "Prudent (recettes −20 %)", realiste: "Réaliste", ambitieux: "Ambitieux (recettes +15 %)" };
  var INDIC = [["taux_recouvrement_pct", "Recouvrement des cotisations", "%"], ["taux_membres_connectes_pct", "Membres avec compte actif", "%"], ["execution_budget_pct", "Exécution du budget", "%"],
    ["depenses_avec_justificatif_pct", "Dépenses avec justificatif", "%"], ["delai_moyen_validation_depense_h", "Délai moyen de validation d'une dépense", " h"], ["projets_termines_pct", "Projets terminés", "%"],
    ["incidents_resolus_pct", "Incidents résolus", "%"], ["delai_moyen_reclamation_j", "Délai moyen de réponse aux réclamations", " j"], ["participation_moyenne_pct", "Participation aux consultations", "%"],
    ["decisions_executees_pct", "Décisions exécutées", "%"], ["aides_versees", "Aides sociales versées", ""]];
  function valeur(v, u) { return v == null ? "—" : String(v) + u; }

  /* Règles lisibles : chaque constat indique la mesure et la raison. */
  function synthese(ind, scen) {
    var L = [], n = function (k) { return ind[k] == null ? null : Number(ind[k]); };
    if (n("taux_recouvrement_pct") != null) L.push(n("taux_recouvrement_pct") < 70 ? ["wa", "Recouvrement à " + n("taux_recouvrement_pct") + " % (seuil de vigilance : 70 %) : relancer les impayés avant d'engager de nouveaux projets."] : ["ok", "Recouvrement satisfaisant (" + n("taux_recouvrement_pct") + " %)."]);
    if (n("incidents_resolus_pct") != null && n("incidents_resolus_pct") < 60) L.push(["wa", "Seuls " + n("incidents_resolus_pct") + " % des incidents sont résolus : revoir les priorités et les prestataires."]);
    if (n("delai_moyen_reclamation_j") != null && n("delai_moyen_reclamation_j") > 15) L.push(["wa", "Réponse aux réclamations en " + n("delai_moyen_reclamation_j") + " jours en moyenne (cible : 15 j)."]);
    if (n("decisions_executees_pct") != null && n("decisions_executees_pct") < 50) L.push(["wa", "Moins de la moitié des décisions sont exécutées (" + n("decisions_executees_pct") + " %) : désigner un responsable et une échéance pour chacune."]);
    if (n("depenses_avec_justificatif_pct") != null && n("depenses_avec_justificatif_pct") < 100) L.push(["er", "Des dépenses n'ont pas de justificatif (" + n("depenses_avec_justificatif_pct") + " % conformes) : à régulariser."]);
    if (scen) {
      var p = scen.scenarios.filter(function (x) { return x.scenario === "prudent"; })[0];
      if (p && Number(p.solde_final) < 0) L.push(["er", "Scénario prudent : trésorerie négative à l'horizon (" + fc(p.solde_final) + ") — réduire les dépenses ou relever les recettes."]);
      if (p && Number(p.cotisation_supplementaire_par_lot_et_par_mois) > 0) L.push(["wa", "Pour financer le projet saisi en scénario prudent, il faudrait environ " + fc(p.cotisation_supplementaire_par_lot_et_par_mois) + " de plus par lot et par mois."]);
    }
    if (!L.length) L.push(["ok", "Aucun point de vigilance détecté sur les indicateurs disponibles."]);
    return L;
  }
  function vuePrev() {
    var an = new Date().getFullYear(), debut = an + "-01-01", fin = new Date().toISOString().slice(0, 10), etat = { scen: null };
    return Promise.all([rpc("indicateurs_performance", { p_debut: debut, p_fin: fin }), ok(from("v_plan_pluriannuel").select("*").order("annee"))]).then(function (R) {
      var ind = R[0] || {}, plan = R[1], zone = el("div", {}), synth = el("div", {});
      function rendreSynthese() {
        synth.replaceChildren(card("🧭 Aide à la décision (indicative)", synthese(ind, etat.scen).map(function (x) { return el("p", {}, (x[0] === "er" ? "🔴 " : x[0] === "wa" ? "🟠 " : "🟢 ") + x[1]); }),
          el("p", { class: "mu" }, "Constats calculés par des règles lisibles. Cette synthèse ne décide de rien : paiements, sanctions et aides sociales relèvent toujours des personnes habilitées.")));
      }
      var horizon = el("select", {}, [12, 24, 36, 60].map(function (m) { return el("option", { value: m }, m + " mois"); })), proj = el("input", { type: "number", min: 0, step: 1, inputmode: "numeric", placeholder: "Coût du projet à financer (F CFA)" });
      var formSim = can("finance.lire") ? card("Simulation financière", el("form", { onsubmit: function (ev) {
        ev.preventDefault();
        rpc("simuler_scenarios", { p_horizon_mois: Number(horizon.value), p_projet: Number(proj.value || 0), p_lots: null }).then(function (r) {
          etat.scen = r; rendreSynthese();
          var cols = [{ t: "Scénario", f: function (x) { return NOMS[x.scenario] || x.scenario; } }, { t: "Recettes / mois", n: 1, f: function (x) { return fc(x.recettes_mensuelles); } }, { t: "Dépenses / mois", n: 1, f: function (x) { return fc(x.depenses_mensuelles); } },
            { t: "Solde à l'horizon", n: 1, f: function (x) { return fc(x.solde_final); } }, { t: "Mois pour financer", n: 1, f: function (x) { return x.mois_pour_financer == null ? "—" : x.mois_pour_financer; } },
            { t: "Cotisation en plus / lot / mois", n: 1, f: function (x) { return fc(x.cotisation_supplementaire_par_lot_et_par_mois); } }];
          zone.replaceChildren(el("p", { class: "mu" }, "PROJECTION — base : solde actuel " + fc(r.base.solde_actuel) + ", encaissé moyen " + fc(r.base.recettes_moy_6m) + "/mois, dépensé moyen " + fc(r.base.depenses_moy_6m) + "/mois sur 6 mois, " + r.base.lots + " lot(s)."), table(cols, r.scenarios), X.barre("simulation", cols, r.scenarios));
        }, function (e) { toast(msgErr(e), true); });
      } }, field("Horizon", horizon), field("Projet à financer", proj), el("button", { class: "p", type: "submit" }, "Simuler les 3 scénarios")), zone) : null;
      rendreSynthese();
      var cols = [{ t: "Année", k: "annee" }, { t: "Horizon", k: "horizon" }, { t: "Projets", n: 1, k: "projets" }, { t: "Coût estimé", n: 1, f: function (r) { return fc(r.cout_estime); } }, { t: "Codes", k: "codes" }];
      return el("div", {}, el("p", { class: "mu" }, "Indicateurs du " + debut + " au " + fin + " — agrégats de la cité, sans donnée personnelle."),
        el("div", { class: "grid" }, INDIC.map(function (x) { return kpi(x[1], valeur(ind[x[0]], x[2])); })), synth, formSim,
        card("Plan pluriannuel des investissements", table(cols, plan, "Aucun projet planifié."), X.barre("plan-pluriannuel", cols, plan)));
    });
  }
  A.vue("previsions", "📈 Prévisions et pilotage", function () { return true; }, vuePrev, "projets");
})(window);
