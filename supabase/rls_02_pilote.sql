-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — ÉTAPE 2 : PILOTE SUR UNE SEULE TABLE
--
-- ✅ APPLIQUÉ SUR ZAHARA (ilvusckdanwrckxqvhmr, projet « Zahara Multi
--    service ») le 14/09/2026, comme l'affirmait la version originale de ce
--    commentaire. Re-vérifié directement le 15/09/2026 :
--      · politique pi_demandes_reappro_staff — authenticated, ALL,
--        ((auth.jwt() ->> 'app_role') IS NOT NULL)
--      · RLS active sur pi_demandes_reappro, table vide (0 ligne, module
--        livré mais pas encore utilisé en production)
--    NON appliqué sur Menco : un pilote se mène sur une seule instance.
--
--    ⚠️ HISTORIQUE DE LA CONFUSION (pour ne pas la reproduire) : le
--    15/09/2026, une vérification via le connecteur Supabase MCP a semblé
--    montrer que ce pilote n'avait jamais été appliqué. C'était faux : le
--    connecteur était en réalité relié à un AUTRE compte Supabase, contenant
--    un projet sans rapport avec Zahara (mêmes noms de tables pi_*, mais
--    gérante, fournisseurs et données différents). Le pilote a alors été
--    réappliqué PAR ERREUR sur ce mauvais projet, puis retiré une fois
--    l'erreur découverte. Le vrai projet Zahara (ref ilvusckdanwrckxqvhmr)
--    n'a jamais cessé d'avoir ce pilote correctement en place depuis le
--    14/09. Leçon : une référence de projet ne suffit pas à s'identifier —
--    toujours confirmer via le tableau de bord Supabase de l'utilisateur
--    (organisation, nom du projet) avant d'agir, pas seulement via les
--    données qu'on y trouve.
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
