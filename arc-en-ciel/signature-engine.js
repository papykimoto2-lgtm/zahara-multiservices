/* Signature numérique ARC-EN-CIEL CONNECT : ECDSA P-256 (WebCrypto), clé PRIVÉE non exportable gardée dans IndexedDB de l'appareil du signataire.
   - La base ne reçoit que la clé publique (enregistrer_cle) et le registre des documents signés (enregistrer_signature, immuable, journalisé).
   - Texte signé : « ARC1|référence|empreinte SHA-256|identifiant de clé ». Le QR porte référence, empreinte, clé et signature ; verifier.html confirme
     l'origine (clé publique du registre), l'intégrité (empreinte) et l'état de la clé (révocation), sans connexion.
   - Perte de l'appareil : révoquer la clé (le registre indique alors si la signature précède la révocation).
   Dépend de api-engine.js (ARC_API). Expose ARC_SIGN. */
(function (G) {
  "use strict";
  var API = G.ARC_API, enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  var B = "arc_signature_v1", ST = "cles";
  function b64u(buf) { var s = "", u = new Uint8Array(buf), i; for (i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return G.btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  function dispo() { return !!(G.crypto && G.crypto.subtle && G.indexedDB && enc); }
  function base() { return /^https?:$/.test(G.location.protocol) ? G.location.origin + G.location.pathname.replace(/[^\/]*$/, "") : ""; }

  function ouvrir() {
    return new Promise(function (ok, ko) {
      var r = G.indexedDB.open(B, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST, { keyPath: "uid" }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ko(r.error); };
    });
  }
  function lire(uid) { return ouvrir().then(function (d) { return new Promise(function (ok, ko) { var q = d.transaction(ST).objectStore(ST).get(uid); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ko(q.error); }; }); }); }
  function ecrire(rec) { return ouvrir().then(function (d) { return new Promise(function (ok, ko) { var t = d.transaction(ST, "readwrite"); t.objectStore(ST).put(rec); t.oncomplete = ok; t.onerror = function () { ko(t.error); }; }); }); }
  function uid() { return G.ARC_APP && G.ARC_APP.S.user ? G.ARC_APP.S.user.id : "demo"; }

  /* Clé de l'utilisateur sur cet appareil : { kid, fonction } ou null. */
  function etat() { if (!dispo() || API.enDemo) return Promise.resolve(null); return lire(uid()).then(function (r) { return r ? { kid: r.kid, fonction: r.fonction } : null; }); }
  function pret() { return etat().then(function (e) { return !!e; }, function () { return false; }); }

  function creer(fonction) {
    if (!dispo()) return Promise.reject({ message: "Signature indisponible sur cet appareil (HTTPS et IndexedDB requis)." });
    var paire, jwk, kid;
    return G.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]).then(function (p) {
      paire = p; return G.crypto.subtle.exportKey("jwk", p.publicKey);
    }).then(function (j) {
      jwk = { kty: j.kty, crv: j.crv, x: j.x, y: j.y };
      return G.crypto.subtle.digest("SHA-256", enc.encode(jwk.x + "." + jwk.y));
    }).then(function (h) {
      kid = b64u(h).slice(0, 22);
      return API.rpc("enregistrer_cle", { p_kid: kid, p_jwk: jwk, p_fonction: fonction });                  /* la clé publique est inscrite AVANT d'être gardée */
    }).then(function () { return ecrire({ uid: uid(), kid: kid, fonction: fonction, priv: paire.privateKey }); }).then(function () { return { kid: kid }; });
  }
  function sha(texte) { return G.crypto.subtle.digest("SHA-256", enc.encode(texte)).then(hex); }

  /* Signe un contenu et l'inscrit au registre. Retourne { ref, hash, kid, sig, canon, qr, fonction }. */
  function signer(titre, texte) {
    var rec, h, ref, canon, sig;
    return lire(uid()).then(function (r) {
      if (!r) throw { message: "Aucune clé de signature sur cet appareil : créez-la dans Administration → Signature." };
      rec = r; return sha(String(texte));
    }).then(function (x) {
      h = x; ref = "ARC-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + h.slice(0, 6).toUpperCase() + hex(G.crypto.getRandomValues(new Uint8Array(2))).toUpperCase();
      canon = "ARC1|" + ref + "|" + h + "|" + rec.kid;
      return G.crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, rec.priv, enc.encode(canon));
    }).then(function (s) {
      sig = b64u(s);
      return API.rpc("enregistrer_signature", { p_ref: ref, p_hash: h, p_kid: rec.kid, p_signature: sig, p_titre: titre, p_canon: canon });
    }).then(function () {
      var b = base(), p = [ref, h, rec.kid, sig];
      return { ref: ref, hash: h, kid: rec.kid, sig: sig, canon: canon, fonction: rec.fonction, qr: b ? b + "verifier.html#" + p.join(".") : "ARCV1|" + p.join("|") };
    });
  }
  G.ARC_SIGN = { dispo: dispo, etat: etat, pret: pret, creer: creer, signer: signer, b64u: b64u };
})(window);
