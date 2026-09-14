-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — ÉTAPE 2 : PILOTE SUR UNE SEULE TABLE
--
-- ⚠️ NE PAS EXÉCUTER avant d'avoir lancé rls_01_inspection.sql et rempli la
--    condition ci-dessous. Le script REFUSE de s'exécuter tant qu'elle porte
--    encore sa valeur d'exemple.
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
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PARAMÉTRAGE ────────────────────────────────────────────────────────────
-- Remplacer la condition par CELLE RELEVÉE dans la requête 1 de l'étape 1
-- (colonne « qual » de la politique de pi_users).
--
-- ⚠️ Si cette expression est liée aux colonnes de pi_users (par exemple
--    « id = auth.jwt() ->> 'user_id' », qui restreint chacun à sa propre
--    ligne), NE PAS la recopier telle quelle : elle n'aurait aucun sens ici.
--    Ne garder que la partie qui distingue un membre du personnel d'un
--    visiteur — c'est cette partie-là qui nous intéresse.

do $$
declare
  -- ▼▼▼ À REMPLACER ▼▼▼
  cond text := $c$ (auth.jwt() ->> 'REMPLACER_PAR_LE_CLAIM_RELEVE') is not null $c$;
  -- ▲▲▲ À REMPLACER ▲▲▲
begin
  if position('REMPLACER' in cond) > 0 then
    raise exception
      'Script non paramétré : remplacer la condition par celle relevée à l''étape 1 (pg_policies sur pi_users).';
  end if;

  -- La politique permissive actuelle est retirée et remplacée dans la même
  -- transaction : la table n'est jamais laissée sans politique.
  execute 'drop policy if exists pi_demandes_reappro_all on public.pi_demandes_reappro';
  execute format(
    'create policy pi_demandes_reappro_staff on public.pi_demandes_reappro '
    'for all to authenticated using (%s) with check (%s)', cond, cond);

  -- anon perd l'accès en écriture comme en lecture : c'est précisément ce que
  -- le pilote doit démontrer.
  execute 'revoke all on table public.pi_demandes_reappro from anon';

  raise notice 'Pilote appliqué sur pi_demandes_reappro.';
end$$;

-- ── VÉRIFICATION ───────────────────────────────────────────────────────────
select policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'pi_demandes_reappro';

-- ── RECETTE À FAIRE DANS L'ERP, dans cet ordre ─────────────────────────────
--  1. Session du personnel ouverte : créer une demande de réapprovisionnement.
--     → doit afficher le toast VERT de confirmation cloud.
--  2. Se déconnecter (le jeton du personnel disparaît, sbAuth() retombe sur la
--     clé anon) puis recharger : la liste des demandes doit être vide ou en
--     erreur — c'est le comportement ATTENDU, il prouve que anon est bloqué.
--  3. Se reconnecter : les demandes doivent réapparaître.
--  4. Sur un second poste connecté, vérifier qu'une nouvelle demande apparaît
--     sans rechargement — sinon le Realtime ne porte pas le jeton (point connu
--     du chantier, index.html:78505).
--
-- Tant que les points 1 et 3 ne passent pas, NE PAS étendre à d'autres tables.

-- ═══════════════════════════════════════════════════════════════════════════
-- ── RETOUR ARRIÈRE (à garder sous la main pendant toute la recette) ────────
-- Restaure l'état permissif d'origine. À exécuter tel quel, sans paramétrage.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  drop policy if exists pi_demandes_reappro_staff on public.pi_demandes_reappro;
--  grant all on table public.pi_demandes_reappro to anon, authenticated;
--  create policy pi_demandes_reappro_all on public.pi_demandes_reappro
--    for all to anon, authenticated using (true) with check (true);
