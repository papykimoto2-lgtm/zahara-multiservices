-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — ÉTAPE 2 : PILOTE SUR UNE SEULE TABLE
--
-- ✅ APPLIQUÉ SUR ZAHARA (ilvusckdanwrckxqvhmr) le 14/09/2026.
--    Migrations : create_pi_demandes_reappro, puis rls_pilote_demandes_reappro.
--    État vérifié après application :
--      · politique pi_demandes_reappro_staff — authenticated, ALL,
--        ((auth.jwt() ->> 'app_role') IS NOT NULL)
--      · has_table_privilege authenticated : SELECT/INSERT/UPDATE = true
--      · has_table_privilege anon          : SELECT/INSERT = false
--      · expression testée avec de vrais jeux de claims :
--          jeton personnel  (app_role=admin)      → autorisé
--          jeton souscripteur (kind=souscripteur) → refusé
--    Préalable confirmé : staff-login délivre bien des jetons (78 connexions
--    serveur réussies en base, la dernière le jour même).
--    NON appliqué sur Menco : un pilote se mène sur une seule instance.
--
-- Table pilote : pi_demandes_reappro — choisie parce qu'elle ne contient
-- AUCUNE donnée de production (module livré mais pas encore utilisé), qu'elle
-- est interne (le portail n'y touche pas) et que l'ERP y écrit avec un retour
-- visible : en cas de refus, la génération d'une demande affiche « NON
-- confirmé dans le cloud » au lieu d'échouer en silence. Un pilote raté ne
-- coûte donc rien et se voit immédiatement.
--
-- Le but n'est pas de sécuriser cette table — c'est de prouver la chaîne
-- complète sur un périmètre sans conséquence : le jeton du personnel passe,
-- la clé anon est refusée, le Realtime continue de délivrer.
--
-- ⚠️ CE PILOTE EST INDISPENSABLE. L'inspection a montré que le mécanisme
--    n'est aujourd'hui éprouvé NULLE PART : les 162 tables des deux instances
--    ont une politique anon sans condition. Rien ne prouve encore qu'une
--    politique exigeant le jeton du personnel laisse réellement passer l'ERP.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── La condition, vérifiée ─────────────────────────────────────────────────
-- Le jeton émis par staff-login porte le claim `app_role` (rôle métier de
-- l'utilisateur). Les jetons du portail portent `kind` / `portal_kind` et
-- JAMAIS `app_role` : exiger sa présence distingue donc un membre du
-- personnel d'un souscripteur connecté au portail.
--
-- Vérifié sur les sources déployées des deux instances — voir
-- functions/staff-login/CONTRAT.md §1.

do $$
declare
  cond constant text := $c$ (auth.jwt() ->> 'app_role') is not null $c$;
begin
  -- La politique permissive actuelle est retirée et remplacée dans la même
  -- transaction : la table n'est jamais laissée sans politique.
  execute 'drop policy if exists pi_demandes_reappro_all on public.pi_demandes_reappro';
  execute format(
    'create policy pi_demandes_reappro_staff on public.pi_demandes_reappro '
    'for all to authenticated using (%s) with check (%s)', cond, cond);

  -- anon perd l'accès en lecture comme en écriture : c'est précisément ce que
  -- le pilote doit démontrer.
  execute 'revoke all on table public.pi_demandes_reappro from anon';

  raise notice 'Pilote appliqué sur pi_demandes_reappro.';
end$$;

-- ── VÉRIFICATION ───────────────────────────────────────────────────────────
select policyname, roles::text, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'pi_demandes_reappro';

-- ── RECETTE À FAIRE DANS L'ERP, dans cet ordre ─────────────────────────────
--  1. Session du personnel ouverte : créer une demande de réapprovisionnement.
--     → doit afficher le toast VERT de confirmation cloud.
--     → si le toast est ROUGE (« NON confirmé dans le cloud »), le jeton du
--       personnel n'atteint pas PostgREST : ARRÊTER et faire le retour arrière.
--  2. Se déconnecter (sbAuth() retombe sur la clé anon) puis recharger : les
--     demandes doivent disparaître ou remonter en erreur — comportement
--     ATTENDU, il prouve que anon est bloqué.
--  3. Se reconnecter : les demandes doivent réapparaître.
--  4. Sur un second poste connecté, vérifier qu'une nouvelle demande apparaît
--     sans rechargement — sinon le Realtime ne porte pas le jeton (point connu
--     du chantier, index.html:78505, client créé avec la clé anon).
--
-- Tant que les points 1 et 3 ne passent pas, NE PAS étendre à d'autres tables.

-- ═══════════════════════════════════════════════════════════════════════════
-- ── RETOUR ARRIÈRE (à garder sous la main pendant toute la recette) ────────
-- Restaure l'état permissif d'origine.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  drop policy if exists pi_demandes_reappro_staff on public.pi_demandes_reappro;
--  grant all on table public.pi_demandes_reappro to anon, authenticated;
--  create policy pi_demandes_reappro_all on public.pi_demandes_reappro
--    for all to anon, authenticated using (true) with check (true);
