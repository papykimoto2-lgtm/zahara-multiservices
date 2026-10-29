/* Administration ARC-EN-CIEL CONNECT : membres et lots, réunions / procès-verbaux / décisions, annonces et rappels, rapprochement bancaire.
   - Chaque rubrique n'apparaît que pour les rôles concernés (affichage) ; la base applique RLS et fonctions SQL dans tous les cas.
   - PV : brouillon → validé (contenu figé) → publié (définitif) ; une correction crée une nouvelle version.
   - Rapprochement : import CSV du relevé (date;libellé;montant signé;référence), rapprochement uniquement à montant et compte identiques, écart motivé.
   Dépend de arc-engine.js (ARC_APP), ui-engine.js, api-engine.js, export-engine.js. */
(function (G) {
  "use strict";
  var A = G.ARC_APP, UI = G.ARC_UI, API = G.ARC_API, X = G.ARC_EXPORT;
  if (!A) return;
  var el = UI.el, fc = UI.fc, fd = UI.fd, fdt = UI.fdt, badge = UI.badge, card = UI.card, table = UI.table, toast = UI.toast, field = UI.field, msgErr = UI.msgErr;
  var ok = API.ok, rpc = API.rpc, from = API.from, can = A.can;
  var TAB = { v: null };
  function echec(e) { toast(msgErr(e), true); }
  function fait(m) { return function () { toast(m); A.afficher(); }; }
  function maj(r) { if (r.error) throw r.error; }
  function opts(L) { return L.map(function (x) { return el("option", { value: x[0] }, x[1]); }); }
  function id6() { return Date.now().toString(36).toUpperCase(); }
  var RUBRIQUES = [["membres", "👥 Membres et lots", function () { return can("membres.gerer"); }, rubMembres], ["reunions", "📅 Réunions et PV", function () { return can("reunion.gerer"); }, rubReunions],
    ["signature", "🔏 Signature", function () { return can("signature.gerer"); }, rubSignature],
    ["annonces", "📣 Annonces et rappels", function () { return can("annonce.publier"); }, rubAnnonces], ["banque", "🏦 Rapprochement bancaire", function () { return can("finance.lire") || can("finance.encaisser"); }, rubBanque]];

  function vueAdmin() {
    var dispo = RUBRIQUES.filter(function (r) { return r[2](); }); if (!dispo.length) return Promise.resolve(card("Administration", el("p", { class: "mu" }, "Aucune rubrique pour votre rôle.")));
    var cur = dispo.filter(function (r) { return r[0] === TAB.v; })[0] || dispo[0];
    var tabs = el("div", { class: "tabs" }, dispo.map(function (r) { return el("button", { "aria-current": r[0] === cur[0] ? "page" : null, onclick: function () { TAB.v = r[0]; A.afficher(); } }, r[1]); }));
    return cur[3]().then(function (c) { return el("div", {}, tabs, c); });
  }

  /* ---------- Membres et lots ---------- */
  function rubMembres() {
    return Promise.all([ok(from("members").select("id,ref,nom,prenoms,statut,telephone,email,user_id,actif").order("nom")), ok(from("lots").select("id,ref,libelle,statut").order("ref")),
      ok(from("lot_ownerships").select("id,lot_id,member_id,lien,quote_part,date_fin"))]).then(function (R) {
      var M = R[0], L = R[1], O = R[2], nomM = {}, refL = {}; M.forEach(function (m) { nomM[m.id] = m.nom + " " + (m.prenoms || ""); }); L.forEach(function (l) { refL[l.id] = l.ref; });
      var colsM = [{ t: "Réf.", k: "ref" }, { t: "Nom", f: function (r) { return r.nom + " " + (r.prenoms || ""); } }, { t: "Statut", k: "statut" }, { t: "Téléphone", k: "telephone" }, { t: "Compte", f: function (r) { return r.user_id ? "✔ lié" : "—"; }, x: function (r) { return r.user_id ? "oui" : "non"; } }];
      return el("div", {}, card("Membres (" + M.length + ")", table(colsM, M), X.barre("membres", colsM, M)), formMembre(),
        card("Lots et propriétaires", table([{ t: "Lot", f: function (r) { return refL[r.lot_id]; } }, { t: "Membre", f: function (r) { return nomM[r.member_id]; } }, { t: "Lien", k: "lien" }, { t: "Quote-part", n: 1, k: "quote_part" }, { t: "Fin", f: function (r) { return r.date_fin ? fd(r.date_fin) : "en cours"; } }], O, "Aucune attribution.")),
        formLot(L, M));
    });
  }
  function formMembre() {
    var nom = el("input", { required: true, maxlength: 80 }), pre = el("input", { maxlength: 80 }), tel = el("input", { type: "tel", pattern: "\\+?[0-9 ]{8,20}", placeholder: "+225 07 00 00 00 00" }), mail = el("input", { type: "email" });
    var st = el("select", {}, opts([["coproprietaire", "Copropriétaire"], ["resident", "Résident"], ["locataire", "Locataire"], ["representant", "Représentant"], ["autre", "Autre"]])), uid = el("input", { pattern: "[0-9a-f-]{36}", placeholder: "Identifiant du compte (UUID, facultatif)" });
    return card("Ajouter un membre", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      from("members").insert([{ ref: "M-" + id6(), nom: nom.value.trim(), prenoms: pre.value.trim() || null, telephone: tel.value.trim() || null, email: mail.value.trim() || null, statut: st.value, user_id: uid.value.trim() || null }])
        .then(function (r) { maj(r); toast("Membre ajouté."); A.afficher(); }).catch(echec);
    } }, field("Nom", nom), field("Prénoms", pre), field("Téléphone", tel), field("E-mail", mail), field("Statut", st), field("Compte de connexion", uid), el("button", { class: "p", type: "submit" }, "Ajouter")));
  }
  function formLot(L, M) {
    var ref = el("input", { required: true, maxlength: 30, placeholder: "Réf. du lot" });
    var lot = el("select", {}, opts(L.map(function (l) { return [l.id, l.ref]; }))), mem = el("select", {}, opts(M.map(function (m) { return [m.id, m.nom + " " + (m.prenoms || "")]; })));
    var lien = el("select", {}, opts([["proprietaire", "Propriétaire"], ["indivisaire", "Indivisaire"], ["locataire", "Locataire"], ["resident", "Résident"], ["representant", "Représentant"]])), qp = el("input", { type: "number", min: 0.0001, max: 1, step: "0.0001", value: 1 });
    return el("div", {}, card("Créer un lot", el("form", { onsubmit: function (ev) { ev.preventDefault(); from("lots").insert([{ ref: ref.value.trim() }]).then(function (r) { maj(r); toast("Lot créé."); A.afficher(); }).catch(echec); } }, field("Référence", ref), el("button", { class: "p", type: "submit" }, "Créer"))),
      L.length && M.length ? card("Rattacher un membre à un lot", el("form", { onsubmit: function (ev) { ev.preventDefault();
        from("lot_ownerships").insert([{ lot_id: lot.value, member_id: mem.value, lien: lien.value, quote_part: Number(qp.value) }]).then(function (r) { maj(r); toast("Rattachement enregistré."); A.afficher(); }).catch(echec); } },
        field("Lot", lot), field("Membre", mem), field("Lien", lien), field("Quote-part (0 à 1)", qp), el("button", { class: "p", type: "submit" }, "Rattacher"))) : null);
  }

  /* ---------- Réunions, PV, décisions ---------- */
  function rubReunions() {
    return Promise.all([ok(from("meetings").select("*").order("date_heure", { ascending: false }).limit(20)), ok(from("minutes").select("id,meeting_id,version,statut,contenu").order("version", { ascending: false })),
      ok(from("resolutions").select("*").order("cree_le", { ascending: false }).limit(30))]).then(function (R) {
      var Mt = R[0], PV = R[1], RS = R[2], titre = {}; Mt.forEach(function (m) { titre[m.id] = m.titre; });
      return el("div", {}, formReunion(),
        card("Réunions", table([{ t: "Date", f: function (r) { return fdt(r.date_heure); } }, { t: "Type", k: "type" }, { t: "Titre", k: "titre" }, { t: "Convoquée", f: function (r) { return r.convoquee ? "oui" : "non"; } },
          { t: "", f: function (r) { return el("div", { class: "row" }, !r.convoquee ? el("button", { class: "s", onclick: function () { from("meetings").update({ convoquee: true }).eq("id", r.id).then(function (x) { maj(x); toast("Réunion convoquée (visible des membres)."); A.afficher(); }).catch(echec); } }, "Convoquer") : null,
            el("button", { class: "s", onclick: function () { redigerPV(r, PV); } }, "Rédiger un PV")); } }], Mt, "Aucune réunion.")),
        card("Procès-verbaux", table([{ t: "Réunion", f: function (r) { return titre[r.meeting_id]; } }, { t: "Version", n: 1, k: "version" }, { t: "Statut", f: function (r) { return badge(r.statut); } }, { t: "Extrait", f: function (r) { return r.contenu.slice(0, 70) + (r.contenu.length > 70 ? "…" : ""); } },
          { t: "", f: function (r) { return el("div", { class: "row" }, r.statut === "brouillon" ? el("button", { class: "s", onclick: function () { from("minutes").update({ statut: "valide" }).eq("id", r.id).then(function (x) { maj(x); toast("PV validé : contenu figé."); A.afficher(); }).catch(echec); } }, "Valider") : null,
            r.statut === "valide" && can("pv.publier") ? el("button", { class: "p", onclick: function () { rpc("publier_pv", { p_minute: r.id }).then(fait("PV publié aux membres."), echec); } }, "Publier") : null); } }], PV, "Aucun PV.")),
        formResolution(Mt), card("Décisions et actions", table([{ t: "N°", k: "numero" }, { t: "Sujet", k: "sujet" }, { t: "Responsable", k: "responsable" }, { t: "Échéance", f: function (r) { return fd(r.echeance); } }, { t: "Statut", k: "statut" },
          { t: "", f: function (r) { return el("button", { class: "s", onclick: function () { statutRes(r); } }, "Statut"); } }], RS, "Aucune décision.")));
    });
  }
  function formReunion() {
    var type = el("select", {}, opts([["bureau", "Bureau"], ["commission", "Commission"], ["ag_ordinaire", "AG ordinaire"], ["ag_extraordinaire", "AG extraordinaire"], ["information", "Information"], ["chantier", "Chantier"], ["communautaire", "Communautaire"]]));
    var titre = el("input", { required: true, maxlength: 140 }), dh = el("input", { type: "datetime-local", required: true }), lieu = el("input", { maxlength: 120 }), odj = el("textarea", { rows: 3, placeholder: "Ordre du jour" });
    return card("Planifier une réunion", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      from("meetings").insert([{ ref: "R-" + id6(), type: type.value, titre: titre.value.trim(), date_heure: new Date(dh.value).toISOString(), lieu: lieu.value.trim() || null, ordre_du_jour: odj.value.trim() || null }]).then(function (r) { maj(r); toast("Réunion créée (non convoquée)."); A.afficher(); }).catch(echec);
    } }, field("Type", type), field("Titre", titre), field("Date et heure", dh), field("Lieu", lieu), field("Ordre du jour", odj), el("button", { class: "p", type: "submit" }, "Créer")));
  }
  function redigerPV(r, PV) {
    var n = PV.filter(function (p) { return p.meeting_id === r.id; }).reduce(function (m, p) { return Math.max(m, p.version); }, 0) + 1;
    var c = G.prompt("Contenu du PV (version " + n + ") — présents, quorum, résolutions, votes, responsables :"); if (!c) return;
    from("minutes").insert([{ meeting_id: r.id, version: n, contenu: c, statut: "brouillon" }]).then(function (x) { maj(x); toast("PV enregistré en brouillon (version " + n + ")."); A.afficher(); }).catch(echec);
  }
  function formResolution(Mt) {
    var num = el("input", { required: true, maxlength: 30, placeholder: "RES-2026-010" }), reu = el("select", {}, el("option", { value: "" }, "— hors réunion —"), opts(Mt.map(function (m) { return [m.id, m.titre]; })));
    var organe = el("input", { required: true, maxlength: 60, value: "Bureau" }), sujet = el("input", { required: true, maxlength: 140 }), texte = el("textarea", { required: true, rows: 3 }), resp = el("input", { maxlength: 80 }), ech = el("input", { type: "date" });
    return card("Enregistrer une décision", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      from("resolutions").insert([{ numero: num.value.trim(), meeting_id: reu.value || null, organe: organe.value.trim(), sujet: sujet.value.trim(), texte: texte.value.trim(), responsable: resp.value.trim() || null, echeance: ech.value || null }]).then(function (r) { maj(r); toast("Décision enregistrée."); A.afficher(); }).catch(echec);
    } }, field("Numéro", num), field("Réunion", reu), field("Organe", organe), field("Sujet", sujet), field("Résolution adoptée", texte), field("Responsable de mise en œuvre", resp), field("Échéance", ech), el("button", { class: "p", type: "submit" }, "Enregistrer")));
  }
  function statutRes(r) {
    var s = G.prompt("Nouveau statut (a_faire, en_cours, execute, bloque, annule) :", r.statut); if (!s) return;
    from("resolutions").update({ statut: s }).eq("id", r.id).then(function (x) { maj(x); toast("Décision mise à jour."); A.afficher(); }).catch(echec);
  }

  /* ---------- Signature numérique ---------- */
  function rubSignature() {
    var S = G.ARC_SIGN;
    return Promise.all([S ? S.etat() : null, ok(from("signing_keys").select("kid,fonction,cree_le,revoquee_le,motif_revocation,titulaire").order("cree_le", { ascending: false })), ok(from("signed_documents").select("ref,titre,kid,signe_le,hash").order("signe_le", { ascending: false }).limit(40))]).then(function (R) {
      var loc = R[0], K = R[1], Dc = R[2], fonction = el("input", { required: true, minlength: 3, maxlength: 60, placeholder: "Ex. Trésorier, Président…" });
      return el("div", {}, card("Clé de signature de cet appareil", loc ? el("p", {}, badge("paye"), " Clé " + loc.kid + " — " + loc.fonction + ". Les documents imprimés depuis cet appareil portent un QR SIGNÉ.") :
        el("form", { onsubmit: function (ev) { ev.preventDefault();
          if (!S || !S.dispo()) return toast("Signature indisponible sur cet appareil (HTTPS requis).", true);
          S.creer(fonction.value.trim()).then(fait("Clé créée : la partie privée ne quitte jamais cet appareil."), echec); } },
          el("p", { class: "mu" }, "Aucune clé sur cet appareil. La clé privée sera non exportable ; seule la clé publique est enregistrée. Perte de l'appareil : révoquer la clé ci-dessous."), field("Fonction du signataire", fonction), el("button", { class: "p", type: "submit" }, "Créer ma clé de signature"))),
        card("Clés enregistrées", table([{ t: "Identifiant", k: "kid" }, { t: "Fonction", k: "fonction" }, { t: "Créée", f: function (r) { return fd(r.cree_le); } }, { t: "État", f: function (r) { return r.revoquee_le ? badge("annulee") : badge("paye"); }, x: function (r) { return r.revoquee_le ? "révoquée" : "valide"; } },
          { t: "", f: function (r) { return !r.revoquee_le ? el("button", { class: "s", onclick: function () { var m = G.prompt("Motif de révocation (obligatoire) :"); if (!m) return; rpc("revoquer_cle", { p_kid: r.kid, p_motif: m }).then(fait("Clé révoquée."), echec); } }, "Révoquer") : r.motif_revocation; } }], K, "Aucune clé.")),
        card("Documents signés", table([{ t: "Réf.", k: "ref" }, { t: "Titre", k: "titre" }, { t: "Signé le", f: function (r) { return fdt(r.signe_le); } }, { t: "Clé", k: "kid" }, { t: "Empreinte", f: function (r) { return r.hash.slice(0, 16) + "…"; } }], Dc, "Aucun document signé."),
          el("p", { class: "mu" }, "Vérification publique : verifier.html (sans connexion).")));
    });
  }

  /* ---------- Annonces et rappels ---------- */
  function rubAnnonces() {
    return ok(from("announcements").select("*").order("publie_le", { ascending: false }).limit(30)).then(function (L) {
      var titre = el("input", { required: true, maxlength: 140 }), corps = el("textarea", { required: true, rows: 4 }), cat = el("select", {}, opts([["officielle", "Officielle"], ["finance", "Finance"], ["convocation", "Convocation"], ["travaux", "Travaux"], ["securite", "Sécurité"], ["solidarite", "Solidarité"], ["projet", "Projet"]])), exp = el("input", { type: "date" });
      return el("div", {}, card("Publier une annonce", el("form", { onsubmit: function (ev) {
        ev.preventDefault();
        from("announcements").insert([{ titre: titre.value.trim(), corps: corps.value.trim(), categorie: cat.value, expire_le: exp.value ? new Date(exp.value + "T23:59:59").toISOString() : null }]).then(function (r) { maj(r); toast("Annonce publiée."); A.afficher(); }).catch(echec);
      } }, field("Titre", titre), field("Message", corps), field("Catégorie", cat), field("Expire le", exp), el("button", { class: "p", type: "submit" }, "Publier"))),
        card("Rappels automatiques de cotisation", el("p", { class: "mu" }, "Notifie chaque membre dont une cotisation arrive à échéance sous 3 jours ou est en retard. Sans doublon : relancer ne renvoie pas deux fois le même rappel."),
          el("button", { class: "p", onclick: function () { rpc("generer_rappels").then(function (n) { toast(n + " rappel(s) envoyé(s)."); }, echec); } }, "Générer les rappels maintenant")),
        card("Annonces publiées", table([{ t: "Date", f: function (r) { return fd(r.publie_le); } }, { t: "Titre", k: "titre" }, { t: "Catégorie", k: "categorie" }, { t: "Expire", f: function (r) { return r.expire_le ? fd(r.expire_le) : "—"; } },
          { t: "", f: function (r) { return el("button", { class: "s", onclick: function () { from("announcements").delete().eq("id", r.id).then(function (x) { maj(x); toast("Annonce retirée."); A.afficher(); }).catch(echec); } }, "Retirer"); } }], L, "Aucune annonce.")));
    });
  }

  /* ---------- Rapprochement bancaire ---------- */
  function rubBanque() {
    return Promise.all([ok(from("cash_accounts").select("id,code,nom,type").in("type", ["banque", "mobile_money"])), ok(from("bank_lines").select("*").order("date_op", { ascending: false }).limit(60)), ok(from("v_a_rapprocher").select("*"))]).then(function (R) {
      var C = R[0], B = R[1], E = R[2], nom = {}; C.forEach(function (c) { nom[c.id] = c.code; });
      var cible = B.filter(function (b) { return b.statut === "a_rapprocher"; });
      var cols = [{ t: "Compte", f: function (r) { return nom[r.account_id]; } }, { t: "Date", f: function (r) { return fd(r.date_op); } }, { t: "Libellé", k: "libelle" }, { t: "Montant", n: 1, f: function (r) { return fc(r.montant); } }, { t: "Statut", f: function (r) { return r.statut === "rapproche" ? badge("paye") : r.statut === "ecart" ? badge("annulee") : badge("brouillon"); }, x: function (r) { return r.statut; } },
        { t: "", f: function (r) { return r.statut === "a_rapprocher" ? ligneActions(r, E) : ""; } }];
      return el("div", {}, el("div", { class: "grid" }, UI.kpi("lignes à rapprocher", String(cible.length), "🏦"), UI.kpi("écritures sans ligne de relevé", String(E.length), "📒")),
        can("finance.encaisser") && C.length ? formReleve(C) : null, card("Relevé bancaire", table(cols, B, "Aucune ligne importée."), X.barre("releve", cols, B)),
        card("Écritures du grand livre à rapprocher", table([{ t: "Réf.", k: "ref" }, { t: "Compte", f: function (r) { return nom[r.account_id]; } }, { t: "Date", f: function (r) { return fd(r.date_op); } }, { t: "Sens", k: "sens" }, { t: "Montant", n: 1, f: function (r) { return fc(r.montant); } }], E, "Tout est rapproché.")));
    });
  }
  function ligneActions(l, E) {
    var cands = E.filter(function (e) { return e.account_id === l.account_id && Number(l.montant) === (e.sens === "entree" ? Number(e.montant) : -Number(e.montant)); });
    var b = [];
    cands.slice(0, 2).forEach(function (e) { b.push(el("button", { class: "p", onclick: function () { rpc("rapprocher", { p_ligne: l.id, p_mouvement: e.id }).then(fait("Rapprochement enregistré."), echec); } }, "= " + e.ref)); });
    b.push(el("button", { class: "s", onclick: function () { var m = G.prompt("Motif de l'écart (obligatoire) :"); if (!m) return; rpc("signaler_ecart", { p_ligne: l.id, p_motif: m }).then(fait("Écart signalé."), echec); } }, "Écart"));
    return el("div", { class: "row" }, b);
  }
  function formReleve(C) {
    var cpt = el("select", {}, opts(C.map(function (c) { return [c.id, c.code + " — " + c.nom]; }))), f = el("input", { type: "file", accept: ".csv,text/csv,text/plain", required: true });
    return card("Importer un relevé (CSV : date;libellé;montant;référence)", el("form", { onsubmit: function (ev) {
      ev.preventDefault(); var fi = f.files[0]; if (!fi || fi.size > 1048576) return toast("Fichier absent ou trop volumineux (1 Mo max).", true);
      var rd = new G.FileReader(); rd.onload = function () {
        var L = String(rd.result).replace(/^﻿/, "").split(/\r?\n/).map(function (x) { return x.split(";"); }).filter(function (x) { return x.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test((x[0] || "").trim()); })
          .map(function (x) { return { date: x[0].trim(), libelle: (x[1] || "").trim(), montant: Number(String(x[2]).replace(/\s/g, "").replace(",", ".")), ref: (x[3] || "").trim() }; }).filter(function (x) { return isFinite(x.montant) && x.montant !== 0; });
        if (!L.length) return toast("Aucune ligne valide (format : AAAA-MM-JJ;libellé;montant;référence).", true);
        rpc("importer_releve", { p_account: cpt.value, p_lignes: L }).then(function (n) { toast(n + " ligne(s) importée(s)."); A.afficher(); }, echec);
      }; rd.readAsText(fi);
    } }, field("Compte", cpt), field("Fichier", f), el("button", { class: "p", type: "submit" }, "Importer")));
  }

  A.vue("admin", "⚙️ Administration", function () { return RUBRIQUES.some(function (r) { return r[2](); }); }, vueAdmin, "audit");
  A.alerte(function () {
    if (!(can("finance.lire") || can("finance.encaisser"))) return Promise.resolve([]);
    return ok(from("bank_lines").select("id").eq("statut", "a_rapprocher")).then(function (B) { return B.length ? [{ id: "banque" + B.length, c: "wa", t: B.length + " ligne(s) de relevé bancaire à rapprocher.", v: "admin", l: "Voir le rapprochement →", avant: function () { TAB.v = "banque"; } }] : []; });
  });
})(window);
