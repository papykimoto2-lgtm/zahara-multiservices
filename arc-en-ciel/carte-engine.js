/* Carte de la cité ARC-EN-CIEL CONNECT (V3) : équipements et incidents ouverts, sans fond de carte externe (pas de traceur, fonctionne hors ligne).
   - Couche publique uniquement (vue v_carte) : jamais le déclarant, jamais un lot habité ni un nom de résident.
   - Position par GPS de l'appareil (« Ma position », HTTPS requis) ou saisie ; l'adresse OpenStreetMap s'ouvre dans un nouvel onglet à la demande.
   Dépend de arc-engine.js (ARC_APP), ui-engine.js, api-engine.js, export-engine.js. */
(function (G) {
  "use strict";
  var A = G.ARC_APP, UI = G.ARC_UI, API = G.ARC_API, X = G.ARC_EXPORT;
  if (!A) return;
  var D = G.document, el = UI.el, card = UI.card, table = UI.table, toast = UI.toast, field = UI.field, msgErr = UI.msgErr, badge = UI.badge, kpi = UI.kpi;
  var ok = API.ok, rpc = API.rpc, from = API.from, can = A.can, NS = "http://www.w3.org/2000/svg";
  function echec(e) { toast(msgErr(e), true); }
  var TYPES = ["lampadaire", "voie", "canalisation", "evacuation", "espace_vert", "aire_jeux", "local", "portail", "securite", "autre"];
  function s(tag, attrs) { var e = D.createElementNS(NS, tag), k; for (k in attrs || {}) e.setAttribute(k, attrs[k]); Array.prototype.slice.call(arguments, 2).forEach(function (c) { e.appendChild(c.nodeType ? c : D.createTextNode(c)); }); return e; }
  function position(cb) {
    if (!G.navigator.geolocation) return toast("Géolocalisation indisponible sur cet appareil.", true);
    G.navigator.geolocation.getCurrentPosition(function (p) { cb(p.coords.latitude, p.coords.longitude, p.coords.accuracy); }, function () { toast("Position refusée ou indisponible (HTTPS requis).", true); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  function dessiner(pts, detail) {
    var W = 760, H = 460, P = 28;
    if (!pts.length) return el("p", { class: "mu" }, "Aucun point géolocalisé pour l'instant.");
    var la = pts.map(function (p) { return Number(p.lat); }), lo = pts.map(function (p) { return Number(p.lng); });
    var minLa = Math.min.apply(null, la), maxLa = Math.max.apply(null, la), minLo = Math.min.apply(null, lo), maxLo = Math.max.apply(null, lo);
    var k = Math.cos(((minLa + maxLa) / 2) * Math.PI / 180), spLo = Math.max((maxLo - minLo) * k, 1e-5), spLa = Math.max(maxLa - minLa, 1e-5), sc = Math.min((W - 2 * P) / spLo, (H - 2 * P) / spLa);
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Carte schématique de la cité", width: "100%" }, s("rect", { x: 0, y: 0, width: W, height: H, rx: 14, fill: "#eef3f1", stroke: "#cfd8d4" }));
    for (var i = 1; i < 4; i++) { svg.appendChild(s("line", { x1: (W / 4) * i, y1: 0, x2: (W / 4) * i, y2: H, stroke: "#dde5e1" })); svg.appendChild(s("line", { x1: 0, y1: (H / 4) * i, x2: W, y2: (H / 4) * i, stroke: "#dde5e1" })); }
    pts.forEach(function (p) {
      var x = P + (Number(p.lng) - minLo) * k * sc, y = H - P - (Number(p.lat) - minLa) * sc, inc = p.couche === "incident";
      var c = s("circle", { cx: x, cy: y, r: inc ? 9 : 7, fill: inc ? "#c62828" : p.statut === "hors_service" ? "#b86e00" : "#118a4b", stroke: "#fff", "stroke-width": 2, tabindex: 0, role: "button", "aria-label": p.libelle });
      c.appendChild(s("title", {}, (inc ? "Incident : " : "Équipement : ") + p.libelle));
      var ouvre = function () { detail(p); }; c.addEventListener("click", ouvre); c.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") ouvre(); });
      svg.appendChild(c);
    });
    return svg;
  }
  function vueCarte() {
    return Promise.all([ok(from("v_carte").select("*")), ok(from("incidents").select("id,ref,description,statut,lat").in("statut", ["nouveau", "en_analyse", "planifie", "en_intervention"]))]).then(function (R) {
      var pts = R[0], miens = R[1], info = el("p", { class: "mu" }, "Touchez un point pour voir le détail.");
      function detail(p) {
        var lien = el("a", { href: "https://www.openstreetmap.org/?mlat=" + p.lat + "&mlon=" + p.lng + "&zoom=19", target: "_blank", rel: "noopener noreferrer" }, "Ouvrir dans OpenStreetMap");
        info.replaceChildren(el("b", {}, p.ref + " — " + p.libelle), " · " + p.sous_type + " · ", p.statut, " · ", lien);
      }
      var cols = [{ t: "Couche", k: "couche" }, { t: "Réf.", k: "ref" }, { t: "Libellé", k: "libelle" }, { t: "Statut", k: "statut" }, { t: "Latitude", k: "lat" }, { t: "Longitude", k: "lng" }];
      return el("div", {},
        el("div", { class: "grid" }, kpi("équipements localisés", String(pts.filter(function (p) { return p.couche === "equipement"; }).length), "📍"), kpi("incidents ouverts localisés", String(pts.filter(function (p) { return p.couche === "incident"; }).length), "🚨")),
        card("Carte de la cité", dessiner(pts, detail), info, el("p", { class: "mu" }, "🟢 équipement en bon état · 🟠 hors service · 🔴 incident ouvert. Carte schématique : aucune donnée de résident n'y figure."), X.barre("carte-cite", cols, pts)),
        can("incident.traiter") ? formActif() : null, miens.length ? formIncidentPos(miens) : null,
        card("Points géolocalisés", table(cols.slice(0, 4).concat([{ t: "Position", f: function (r) { return Number(r.lat).toFixed(5) + ", " + Number(r.lng).toFixed(5); } }]), pts, "Aucun point.")));
    });
  }
  function formActif() {
    var type = el("select", {}, TYPES.map(function (t) { return el("option", { value: t }, t); })), nom = el("input", { required: true, maxlength: 100 }), loc = el("input", { maxlength: 120, placeholder: "Voie, repère…" });
    var la = el("input", { type: "number", step: "0.000001", min: -90, max: 90, required: true }), lo = el("input", { type: "number", step: "0.000001", min: -180, max: 180, required: true });
    return card("Ajouter un équipement sur la carte", el("form", { onsubmit: function (ev) {
      ev.preventDefault();
      from("assets").insert([{ ref: "EQ-" + Date.now().toString(36).toUpperCase(), type: type.value, nom: nom.value.trim(), localisation: loc.value.trim() || null, lat: Number(la.value), lng: Number(lo.value) }])
        .then(function (r) { if (r.error) throw r.error; toast("Équipement ajouté."); A.afficher(); }).catch(echec);
    } }, field("Type", type), field("Nom", nom), field("Repère", loc), field("Latitude", la), field("Longitude", lo),
      el("button", { class: "s", type: "button", onclick: function () { position(function (a, b, p) { la.value = a.toFixed(6); lo.value = b.toFixed(6); toast("Position relevée (±" + Math.round(p) + " m)."); }); } }, "📍 Ma position"), el("button", { class: "p", type: "submit" }, "Ajouter")));
  }
  function formIncidentPos(miens) {
    var sel = el("select", {}, miens.map(function (i) { return el("option", { value: i.id }, i.ref + " — " + i.description.slice(0, 50) + (i.lat == null ? "" : " (déjà localisé)")); }));
    return card("Localiser un incident", el("p", { class: "mu" }, "Placez-vous sur le lieu de l'incident, puis touchez le bouton."),
      field("Incident", sel), el("button", { class: "p", onclick: function () { position(function (a, b) { rpc("positionner_incident", { p_id: sel.value, p_lat: a, p_lng: b }).then(function () { toast("Incident localisé."); A.afficher(); }, echec); }); } }, "📍 L'incident est ici"));
  }
  A.vue("carte", "🗺️ Carte", function () { return true; }, vueCarte, "reclamations");
})(window);
