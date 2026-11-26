/* Vérification publique d'un document signé ARC-EN-CIEL CONNECT (page verifier.html, sans connexion).
   - Entrée : lien du QR (verifier.html#ref.empreinte.clé.signature), texte « ARCV1|… » collé, ou saisie de la référence.
   - Contrôles : (1) le document est inscrit au registre ; (2) l'empreinte du QR est celle du registre ; (3) la signature ECDSA P-256 est valide avec la clé PUBLIQUE du registre ;
     (4) la clé n'est pas révoquée (ou la signature précède la révocation). Toute anomalie est dite en toutes lettres.
   - Seule l'URL du projet et la clé « anon » de config.js sont utilisées ; la fonction SQL ne renvoie que la clé publique et ce qu'imprime déjà le QR. */
(function (G) {
  "use strict";
  var D = G.document, enc = new TextEncoder();
  function lire(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  var C = (G.ARC_CONFIG && G.ARC_CONFIG.url) ? G.ARC_CONFIG : (lire("arc_cfg") || {});
  var URL_OK = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
  function u8(b64u) { var s = b64u.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var r = G.atob(s), o = new Uint8Array(r.length), i; for (i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function el(t, a) { var e = D.createElement(t), k; for (k in a || {}) e.setAttribute(k, a[k]); (function aj(L) { L.forEach(function (c) { if (Array.isArray(c)) aj(c); else e.append(c); }); })(Array.prototype.slice.call(arguments, 2)); return e; }

  function analyser(txt) {
    txt = String(txt || "").trim();
    var m = txt.match(/#([A-Za-z0-9_-]+)\.([0-9a-f]{64})\.([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{80,100})$/) || txt.match(/^ARCV1\|([A-Za-z0-9._-]+)\|([0-9a-f]{64})\|([A-Za-z0-9_-]{8,64})\|([A-Za-z0-9_-]{80,100})$/)
      || txt.match(/^([A-Za-z0-9_-]+)\.([0-9a-f]{64})\.([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{80,100})$/);
    if (m) return { ref: m[1], hash: m[2], kid: m[3], sig: m[4] };
    return /^[A-Za-z0-9._-]{6,64}$/.test(txt) ? { ref: txt } : null;
  }
  function interroger(ref) {
    if (!URL_OK.test(C.url || "") || !C.anonKey) return Promise.reject(new Error("Cette installation n'est pas configurée (config.js)."));
    return G.fetch(C.url + "/rest/v1/rpc/verifier_signature", { method: "POST", headers: { apikey: C.anonKey, Authorization: "Bearer " + C.anonKey, "Content-Type": "application/json", "Content-Profile": "app", "Accept-Profile": "app" }, body: JSON.stringify({ p_ref: ref }) })
      .then(function (r) { if (!r.ok) throw new Error("Registre injoignable (" + r.status + ")."); return r.json(); });
  }
  /* Résultat : { etat: "ok" | "attention" | "ko", lignes: [...] } */
  function verifier(q) {
    return interroger(q.ref).then(function (reg) {
      if (reg.inconnu) return { etat: "ko", lignes: ["Ce document n'est pas inscrit au registre de la cité : il n'a pas été signé par elle ou la référence est fausse."] };
      var L = [], etat = "ok";
      if (q.hash && q.hash !== reg.hash) return { etat: "ko", lignes: ["L'empreinte du QR ne correspond pas à celle du registre : le QR ou le document a été modifié."], reg: reg };
      var canon = "ARC1|" + reg.ref + "|" + reg.hash + "|" + reg.kid, sig = q.sig || reg.signature;
      if (q.sig && q.sig !== reg.signature) return { etat: "ko", lignes: ["La signature du QR diffère de celle du registre : QR falsifié."], reg: reg };
      if (reg.canon !== canon) return { etat: "ko", lignes: ["Le texte signé du registre est incohérent."], reg: reg };
      return G.crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: reg.jwk.x, y: reg.jwk.y, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"])
        .then(function (k) { return G.crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, u8(sig), enc.encode(canon)); })
        .then(function (valide) {
          if (!valide) return { etat: "ko", lignes: ["La signature numérique est INVALIDE : le document ne provient pas de la clé enregistrée."], reg: reg };
          L.push("Signature ECDSA P-256 valide — origine et intégrité confirmées.");
          if (reg.revoquee_le) {
            if (new Date(reg.signe_le) < new Date(reg.revoquee_le)) { etat = "attention"; L.push("La clé a été révoquée le " + new Date(reg.revoquee_le).toLocaleDateString("fr-FR") + " (" + reg.motif_revocation + "), mais ce document a été signé AVANT cette révocation."); }
            else return { etat: "ko", lignes: ["Document signé APRÈS la révocation de la clé : à rejeter."], reg: reg };
          } else L.push("La clé de signature est valide (non révoquée).");
          return { etat: etat, lignes: L, reg: reg };
        });
    });
  }
  function afficher(r, zone) {
    var reg = r.reg, titre = r.etat === "ok" ? "✅ Document authentique" : r.etat === "attention" ? "🟠 Document authentique — à lire avec attention" : "❌ Document NON reconnu";
    zone.replaceChildren(el("h2", { class: r.etat === "ko" ? "er" : "ok" }, titre), el("ul", {}, r.lignes.map(function (x) { return el("li", {}, x); })));
    if (reg) zone.append(el("table", {}, [["Titre", reg.titre], ["Référence", reg.ref], ["Signé par", reg.fonction], ["Date de signature", new Date(reg.signe_le).toLocaleString("fr-FR")], ["Empreinte SHA-256", reg.hash], ["Clé", reg.kid]].map(function (x) { return el("tr", {}, el("th", {}, x[0]), el("td", {}, x[1])); })));
  }
  function demarrer() {
    var zone = D.getElementById("res"), champ = D.getElementById("q"), form = D.getElementById("f");
    function lancer(txt) {
      var q = analyser(txt); if (!q) return zone.replaceChildren(el("p", { class: "er" }, "Lien ou référence non reconnu."));
      zone.replaceChildren(el("p", { class: "mu" }, "Vérification…"));
      verifier(q).then(function (r) { afficher(r, zone); }, function (e) { zone.replaceChildren(el("p", { class: "er" }, String(e && e.message || e))); });
    }
    form.addEventListener("submit", function (ev) { ev.preventDefault(); lancer(champ.value); });
    if (G.location.hash.length > 5) { champ.value = G.location.href; lancer(G.location.href); }
  }
  G.ARC_VERIF = { analyser: analyser, verifier: verifier };
  if (D.getElementById("f")) { if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", demarrer); else demarrer(); }
})(window);
