import { demoClient } from "./demo.js";
const lire = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const C = (window.ARC_CONFIG && window.ARC_CONFIG.url) ? window.ARC_CONFIG : (lire("arc_cfg") || {});
const URL_OK = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
export const enDemo = (() => { try { return sessionStorage.getItem("arc_demo") === "1"; } catch (e) { return false; } })();
export const reel = !!(URL_OK.test(C.url || "") && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(C.anonKey || "") && window.supabase);
export const configured = reel || enDemo;
export const URL_VALIDE = u => URL_OK.test(u);
// Le jeton utilisateur reste en mémoire de session (sessionStorage) : fermé = déconnecté.
export const sb = enDemo ? demoClient : reel ? window.supabase.createClient(C.url, C.anonKey, {
  db: { schema: "app" },
  auth: { persistSession: true, autoRefreshToken: true, storage: window.sessionStorage, detectSessionInUrl: false }
}) : null;

// Résultat ou exception (les erreurs PostgREST portent le message métier en français)
export async function ok(p) { const { data, error } = await p; if (error) throw error; return data; }
export const rpc = (fn, args) => ok(sb.rpc(fn, args));
export const from = t => sb.from(t);

// Permissions de l'utilisateur : utilisées UNIQUEMENT pour l'affichage. La sécurité est appliquée par RLS et par les fonctions SQL.
export async function chargerDroits(uid) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const roles = await ok(from("user_roles").select("role_code,date_debut,date_fin").eq("user_id", uid));
  const actifs = roles.filter(r => r.date_debut <= aujourdhui && (!r.date_fin || r.date_fin >= aujourdhui)).map(r => r.role_code);
  const rp = actifs.length ? await ok(from("role_permissions").select("role_code,perm_code").in("role_code", actifs)) : [];
  return { roles: actifs, perms: new Set(rp.map(x => x.perm_code)) };
}
