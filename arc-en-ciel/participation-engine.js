/* Participation ARC-EN-CIEL CONNECT (V2) : consultations et votes, boîte à idées, réclamations, signalement des incidents.
   - Vote : un bulletin par membre, secret (la base sépare émargement et bulletin) ; le membre reçoit un reçu vérifiable publié à la clôture.
     Une consultation en ligne reste « consultative » tant que le cadre juridique (statuts, règlement, textes) n'a pas validé le vote à distance.
   - Réclamations : circuit traçable (dépôt → affectation → analyse → réponse motivée → réexamen → clôture), médiation confidentielle.
   - Incidents : la cité voit la vue publique (jamais le déclarant) ; chaque étape notifie le déclarant.
   Toutes les écritures passent par des fonctions SQL. Dépend de arc-engine.js (ARC_APP), ui-engine.js, api-engine.js. */
(function (G) {
  "use strict";
  var A = G.ARC_APP, UI = G.ARC_UI, API = G.ARC_API;
  if (!A) return;
  var el = UI.el, fc = UI.fc, fd = UI.fd, fdt = UI.fdt, badge = UI.badge, kpi = UI.kpi, card = UI.card, table = UI.table, toast = UI.toast, field = UI.field, msgErr = UI.msgErr;
  var ok = API.ok, rpc = API.rpc, from = API.from, can = A.can;
  function echec(e) { toast(msgErr(e), true); }
  function fait(m) { return function () { toast(m); A.afficher(); }; }

  var CAT_IDEE = [["securite", "Sécurité"], ["environnement", "Environnement"], ["infrastructures", "Infrastructures"], ["solidarite", "Solidarité"], ["activites", "Activités communautaires"], ["finances", "Gestion financière"], ["modernisation", "Modernisation"], ["economie", "Développement économique"], ["autre", "Autre"]];
  var CAT_REC = [["cotisation", "Erreur de cotisation"], ["depense", "Dépense contestée"], ["entretien", "Défaut d'entretien"], ["administratif", "Problème administratif"], ["communication", "Communication"], ["conflit_usage", "Conflit d'usage des espaces communs"], ["decision", "Décision contestée"], ["autre", "Autre"]];
  var CAT_INC = [["eclairage", "Panne d'éclairage"], ["voirie", "Voirie"], ["fuite", "Fuite d'eau"], ["obstruction", "Canalisation obstruée"], ["depot_sauvage", "Dépôt sauvage"], ["degradation", "Dégradation"], ["securite", "Sécurité"], ["nuisance", "Nuisance"], ["autre", "Autre"]];
  function opts(L) { return L.map(function (x) { return el("option", { value: x[0] }, x[1]); }); }
  function libelle(L, v) { var x = L.filter(function (y) { return y[0] === v; })[0]; return x ? x[1] : v; }

  /* ---------- Participation : consultations, votes, idées ---------- */
  function vuePart() {
    return Promise.all([
      ok(from("consultations").select("*").order("cloture", { ascending: false }).limit(20)),
      ok(from("propositions").select("id,ref,titre,description,categorie,statut,reponse,member_id,cree_le").order("cree_le", { ascending: false }).limit(30))
    ]).then(function (R) {
      var cons = R[0], idees = R[1];
      return Promise.all(cons.filter(function (c) { return c.statut === "ouverte"; }).map(function (c) { return rpc("a_vote", { p_consultation: c.id }).then(function (v) { return [c.id, v]; }); })).then(function (V) {
        var deja = {}; V.forEach(function (x) { deja[x[0]] = x[1]; });
        return el("div", {},
          cons.length ? cons.map(function (c) { return carteConsultation(c, deja[c.id]); }) : card("Consultations", el("p", { class: "mu" }, "Aucune consultation en cours.")),
          can("vote.gerer") ? formConsultation() : null,
          formIdee(),
          card("Boîte à idées", table([{ t: "Réf.", k: "ref" }, { t: "Idée", f: function (r) { return r.titre; } }, { t: "Thème", f: function (r) { return libelle(CAT_IDEE, r.categorie); } },
            { t: "Statut", f: function (r) { return badge(r.statut); } }, { t: "Réponse", k: "reponse" },
            { t: "", f: function (r) { return can("proposition.traiter") ? el("div", { class: "row" }, [["a_etude", "À l'étude"], ["acceptee", "Accepter"], ["rejetee", "Rejeter"], ["planifiee", "Planifier"]].map(function (x) {
              return el("button", { class: "s", onclick: function () { traiterIdee(r, x[0]); } }, x[1]); })) : ""; } }], idees, "Aucune idée pour l'instant.")));
      });
    });
  }
  function carteConsultation(c, aVote) {
    var corps = [el("p", { class: "mu" }, (c.description || "") + (c.consultatif ? " · Consultatif : ne remplace pas la décision de l'organe compétent." : ""))];
    corps.push(el("p", { class: "mu" }, "Du " + fdt(c.ouverture) + " au " + fdt(c.cloture) + " · quorum " + c.quorum_pct + " % · majorité " + c.majorite));
    if (c.statut === "ouverte") {
      if (aVote) corps.push(el("p", {}, badge("paye"), " Vous avez voté."));
      else {
        var choix = null, radios = c.options.map(function (o, i) { return el("label", { class: "row" }, el("input", { type: "radio", name: "v" + c.id, value: i, onchange: function () { choix = i; } }), o); });
        corps.push(el("form", { onsubmit: function (ev) {
          ev.preventDefault(); if (choix == null) return toast("Choisir une option.", true);
          rpc("voter", { p_consultation: c.id, p_choix: choix }).then(function (recu) { toast("Vote enregistré. Reçu : " + String(recu).slice(0, 12) + "…"); A.afficher(); }, echec);
        } }, radios, el("button", { class: "p", type: "submit" }, "Voter (secret, définitif)")));
      }
      if (can("vote.gerer") && new Date(c.cloture) <= new Date()) corps.push(el("button", { class: "p", onclick: function () { rpc("clore_consultation", { p_id: c.id }).then(fait("Consultation clôturée, résultat figé."), echec); } }, "Clôturer et dépouiller"));
    } else if (c.statut === "brouillon") {
      corps.push(el("p", {}, badge("brouillon")), can("vote.gerer") ? el("button", { class: "p", onclick: function () { rpc("ouvrir_consultation", { p_id: c.id }).then(fait("Consultation ouverte."), echec); } }, "Ouvrir au vote") : null);
    } else if (c.resultat) {
      var r = c.resultat, tot = r.votants || 1;
      corps.push(el("p", {}, "Participation " + r.participation_pct + " % (" + r.votants + "/" + r.electeurs + ") · quorum " + (r.quorum_atteint ? "atteint" : "non atteint") + " · ", r.egalite ? el("span", { class: "b wa" }, "Égalité") : r.adopte ? el("span", { class: "b ok" }, "Adoptée") : el("span", { class: "b er" }, "Non adoptée")));
      r.options.forEach(function (o, i) { corps.push(el("div", { class: "row" }, el("span", { class: "mu" }, o + " — " + r.voix[i] + " voix (" + Math.round(r.voix[i] * 100 / tot) + " %)"), el("progress", { value: r.voix[i], max: tot }))); });
    }
    return card((c.type === "vote_formel" ? "🗳️ " : "📊 ") + c.titre, corps);
  }
  function formConsultation() {
    var titre = el("input", { required: true, maxlength: 120 }), desc = el("input", { maxlength: 300 }), options = el("textarea", { required: true, rows: 3, placeholder: "Une option par ligne (2 à 12)" });
    var ouv = el("input", { type: "datetime-local", required: true }), clo = el("input", { type: "datetime-local", required: true });
    var quorum = el("input", { type: "number", min: 0, max: 100, value: 0 }), maj = el("select", {}, opts([["simple", "Simple (la plus de voix)"], ["absolue", "Absolue (plus de la moitié)"], ["deux_tiers", "Deux tiers"]]));
    var type = el("select", {}, opts([["consultation", "Consultation"], ["priorisation", "Priorisation de projets"], ["sondage", "Sondage"], ["vote_formel", "Vote formel (cadre juridique à valider)"]]));
    return card("Organiser une consultation", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      var L = options.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      from("consultations").insert([{ ref: "CON-" + Date.now(), titre: titre.value.trim(), description: desc.value.trim() || null, type: type.value, options: L, ouverture: new Date(ouv.value).toISOString(), cloture: new Date(clo.value).toISOString(), quorum_pct: Number(quorum.value), majorite: maj.value }])
        .then(function (r) { if (r.error) throw r.error; toast("Consultation créée (brouillon)."); A.afficher(); }).catch(echec);
    } }, field("Titre", titre), field("Description", desc), field("Type", type), field("Options", options), field("Ouverture", ouv), field("Clôture", clo), field("Quorum (%)", quorum), field("Majorité", maj), el("button", { class: "p", type: "submit" }, "Créer le brouillon")));
  }
  function formIdee() {
    var titre = el("input", { required: true, minlength: 3, maxlength: 120 }), desc = el("textarea", { required: true, rows: 3 }), cat = el("select", {}, opts(CAT_IDEE)), est = el("input", { type: "number", min: 0, step: 1, inputmode: "numeric" });
    return card("Proposer une idée", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      rpc("proposer", { p_titre: titre.value.trim(), p_description: desc.value.trim(), p_categorie: cat.value, p_estimation: est.value ? Number(est.value) : null }).then(fait("Idée enregistrée, merci !"), echec);
    } }, field("Titre", titre), field("Description", desc), field("Thème", cat), field("Estimation (F CFA, facultatif)", est), el("button", { class: "p", type: "submit" }, "Envoyer")));
  }
  function traiterIdee(r, statut) {
    var rep = statut === "rejetee" ? G.prompt("Motif du rejet (obligatoire) :") : G.prompt("Réponse au membre (facultatif) :", "");
    if (statut === "rejetee" && !rep) return;
    rpc("traiter_proposition", { p_id: r.id, p_statut: statut, p_reponse: rep || null, p_priorite: null }).then(fait("Proposition mise à jour."), echec);
  }

  /* ---------- Réclamations et incidents ---------- */
  function vueRec() {
    return Promise.all([
      ok(from("complaints").select("id,ref,categorie,objet,statut,reponse,delai_cible,confidentiel,member_id,cree_le").order("cree_le", { ascending: false }).limit(40)),
      ok(from("v_incidents_publics").select("*").order("signale_le", { ascending: false }).limit(40))
    ]).then(function (R) {
      var recs = R[0], incs = R[1], mid = A.S.membre ? A.S.membre.id : null, trait = can("reclamation.traiter") || can("mediation.lire");
      return el("div", {},
        el("div", { class: "grid" }, kpi("réclamations ouvertes", String(recs.filter(function (r) { return r.statut !== "close"; }).length), "📣"), kpi("incidents en cours", String(incs.filter(function (i) { return i.statut !== "resolu" && i.statut !== "rejete"; }).length), "🛠️")),
        formIncident(),
        card("Incidents signalés dans la cité", table([{ t: "Réf.", k: "ref" }, { t: "Type", f: function (r) { return libelle(CAT_INC, r.categorie); } }, { t: "Description", k: "description" }, { t: "Lieu", k: "localisation" },
          { t: "Priorité", k: "priorite" }, { t: "Statut", f: function (r) { return badge(r.statut); } }, { t: "Échéance", f: function (r) { return fd(r.delai_cible); } },
          { t: "", f: function (r) { return can("incident.traiter") && r.statut !== "resolu" && r.statut !== "rejete" ? el("div", { class: "row" }, [["en_analyse", "Analyse"], ["planifie", "Planifier"], ["en_intervention", "Intervention"], ["resolu", "Résolu"], ["rejete", "Rejeter"]].map(function (x) {
            return el("button", { class: "s", onclick: function () { traiterInc(r, x[0]); } }, x[1]); })) : ""; } }], incs, "Aucun incident signalé.")),
        formRec(),
        card("Réclamations", table([{ t: "Réf.", k: "ref" }, { t: "Objet", f: function (r) { return (r.confidentiel ? "🔒 " : "") + r.objet + " (" + libelle(CAT_REC, r.categorie) + ")"; } },
          { t: "Statut", f: function (r) { return badge(r.statut); } }, { t: "Réponse attendue avant", f: function (r) { return fd(r.delai_cible); } }, { t: "Réponse", k: "reponse" },
          { t: "", f: function (r) {
            var b = [];
            if (r.member_id === mid && r.statut === "repondue") b.push(el("button", { class: "s", onclick: function () { reexamen(r); } }, "Demander un réexamen"));
            if (trait && r.statut !== "close") [["en_analyse", "Analyse"], ["repondue", "Répondre"], ["close", "Clore"]].forEach(function (x) { b.push(el("button", { class: "s", onclick: function () { traiterRec(r, x[0]); } }, x[1])); });
            return el("div", { class: "row" }, b); } }], recs, "Aucune réclamation.")));
    });
  }
  function formIncident() {
    var cat = el("select", {}, opts(CAT_INC)), desc = el("textarea", { required: true, rows: 3, minlength: 5 }), lieu = el("input", { maxlength: 120, placeholder: "Voie, lot, repère…" });
    return card("Signaler un incident", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      rpc("signaler_incident", { p_categorie: cat.value, p_description: desc.value.trim(), p_localisation: lieu.value.trim() || null, p_asset: null }).then(fait("Incident signalé. Vous serez informé de son évolution."), echec);
    } }, field("Type", cat), field("Description", desc), field("Localisation", lieu), el("button", { class: "p", type: "submit" }, "Signaler")));
  }
  function formRec() {
    var cat = el("select", {}, opts(CAT_REC)), obj = el("input", { required: true, minlength: 3, maxlength: 120 }), desc = el("textarea", { required: true, rows: 3 }), conf = el("input", { type: "checkbox" });
    return card("Déposer une réclamation", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      rpc("deposer_reclamation", { p_categorie: cat.value, p_objet: obj.value.trim(), p_description: desc.value.trim(), p_confidentiel: conf.checked }).then(fait("Réclamation enregistrée (accusé de réception)."), echec);
    } }, field("Catégorie", cat), field("Objet", obj), field("Description", desc), el("label", { class: "row" }, conf, "Demande de médiation confidentielle (réservée aux personnes habilitées)"), el("button", { class: "p", type: "submit" }, "Déposer")));
  }
  function traiterRec(r, statut) {
    var m = G.prompt("Message motivé pour le membre (obligatoire) :"); if (!m) return;
    rpc("traiter_reclamation", { p_id: r.id, p_statut: statut, p_message: m, p_affecte_a: null }).then(fait("Réclamation mise à jour."), echec);
  }
  function reexamen(r) {
    var m = G.prompt("Motif de la demande de réexamen (obligatoire) :"); if (!m) return;
    rpc("demander_reexamen", { p_id: r.id, p_motif: m }).then(fait("Réexamen demandé."), echec);
  }
  function traiterInc(r, statut) {
    var m = G.prompt(statut === "rejete" ? "Motif du rejet (obligatoire) :" : "Message pour le déclarant :", ""); if (m == null) return;
    var preuve = statut === "resolu" ? G.prompt("Preuve de résolution (rapport, photo…) — obligatoire :") : null; if (statut === "resolu" && !preuve) return;
    var resp = statut === "planifie" || statut === "en_intervention" ? G.prompt("Responsable / prestataire :", r.responsable || "") : null;
    rpc("traiter_incident", { p_id: r.id, p_statut: statut, p_message: m, p_priorite: null, p_responsable: resp || null, p_delai: null, p_preuve: preuve }).then(fait("Incident mis à jour."), echec);
  }

  /* ---------- Alertes de l'accueil ---------- */
  A.alerte(function () {
    var L = [], P = [];
    P.push(ok(from("consultations").select("id,titre").eq("statut", "ouverte")).then(function (cs) {
      return Promise.all(cs.map(function (c) { return rpc("a_vote", { p_consultation: c.id }).then(function (v) { if (!v) L.push({ id: "vote" + c.id, c: "in", t: "Consultation en cours : « " + c.titre + " » — votre voix compte.", v: "participation", l: "Voter →" }); }); }));
    }));
    if (can("reclamation.traiter")) P.push(ok(from("complaints").select("id").in("statut", ["deposee", "reexamen"])).then(function (x) { if (x.length) L.push({ id: "recs", c: "wa", t: x.length + " réclamation(s) à traiter.", v: "reclamations", l: "Voir les réclamations →" }); }));
    if (can("incident.traiter")) P.push(ok(from("v_incidents_publics").select("id,priorite").eq("statut", "nouveau")).then(function (x) { if (x.length) L.push({ id: "incs", c: x.some(function (i) { return i.priorite === "urgente"; }) ? "er" : "wa", t: x.length + " nouvel(s) incident(s) à analyser.", v: "reclamations", l: "Voir les incidents →" }); }));
    return Promise.all(P).then(function () { return L; });
  });

  A.vue("participation", "🗳️ Participation", function () { return true; }, vuePart, "depenses");
  A.vue("reclamations", "📣 Réclamations et incidents", function () { return true; }, vueRec, "participation");
})(window);
