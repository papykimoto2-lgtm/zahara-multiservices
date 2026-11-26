/* Accès aux données ARC-EN-CIEL CONNECT : client Supabase (schéma « app »), configuration de l'instance, mode démonstration.
   - La configuration vient de config.js (window.ARC_CONFIG) ou, à défaut, de l'écran « Connecter la cité » (localStorage « arc_cfg »).
   - Seules l'URL du projet et la clé « anon » (publiable) sont acceptées ; une clé service_role est refusée côté écran.
   - Le jeton de l'utilisateur reste dans sessionStorage : onglet fermé = déconnecté.
   - Les droits chargés ici ne servent QU'À l'affichage : la sécurité est appliquée par RLS et par les fonctions SQL.
   Dépend de vendor/supabase-js-2.45.4.js et demo-engine.js. Expose ARC_API. */
(function (G) {
  "use strict";
  var URL_OK = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
  function lire(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  var C = (G.ARC_CONFIG && G.ARC_CONFIG.url) ? G.ARC_CONFIG : (lire("arc_cfg") || {});
  var enDemo = (function () { try { return sessionStorage.getItem("arc_demo") === "1"; } catch (e) { return false; } })();
  var reel = !!(URL_OK.test(C.url || "") && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(C.anonKey || "") && G.supabase);
  var sb = enDemo ? G.ARC_DEMO.client : reel ? G.supabase.createClient(C.url, C.anonKey, {
    db: { schema: "app" },
    auth: { persistSession: true, autoRefreshToken: true, storage: G.sessionStorage, detectSessionInUrl: false }
  }) : null;

  /* Résultat ou exception (les erreurs PostgREST portent le message métier en français). */
  function ok(p) { return p.then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function rpc(fn, args) { return ok(sb.rpc(fn, args)); }
  function from(t) { return sb.from(t); }

  function chargerDroits(uid) {
    var auj = new Date().toISOString().slice(0, 10), actifs;
    return ok(from("user_roles").select("role_code,date_debut,date_fin").eq("user_id", uid)).then(function (roles) {
      actifs = roles.filter(function (r) { return r.date_debut <= auj && (!r.date_fin || r.date_fin >= auj); }).map(function (r) { return r.role_code; });
      return actifs.length ? ok(from("role_permissions").select("role_code,perm_code").in("role_code", actifs)) : [];
    }).then(function (rp) { return { roles: actifs, perms: new Set(rp.map(function (x) { return x.perm_code; })) }; });
  }

  G.ARC_API = { sb: sb, configured: reel || enDemo, enDemo: enDemo, reel: reel, urlValide: function (u) { return URL_OK.test(u); }, ok: ok, rpc: rpc, from: from, chargerDroits: chargerDroits };
})(window);
