-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — ÉTAPE 1 : INSPECTION (lecture seule, ne modifie RIEN)
--
-- À exécuter sur CHAQUE projet Supabase. Aucune de ces requêtes n'écrit ni ne
-- verrouille quoi que ce soit : on peut les lancer en production sans risque.
--
-- Objectif : répondre aux questions restées ouvertes en phase 0, notamment
-- « quel claim les politiques exigent-elles ? », avant d'écrire la moindre
-- politique nouvelle.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La politique de référence ───────────────────────────────────────────
-- pi_users est déjà protégée et fonctionne : sa politique est le modèle à
-- répliquer. L'expression renvoyée dans « qual » contient littéralement le
-- claim exigé.
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'pi_users'
order by policyname;

-- ── 2. État réel de toutes les tables pi_* ─────────────────────────────────
-- Combien sont déjà protégées, combien restent ouvertes. C'est la photo de
-- départ : à comparer après chaque étape.
select c.relname                                     as table_name,
       c.relrowsecurity                              as rls_active,
       count(p.policyname)                           as nb_politiques,
       bool_or(p.roles::text like '%anon%')          as ouverte_a_anon
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
       on p.schemaname = 'public' and p.tablename = c.relname
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'pi\_%'
group by c.relname, c.relrowsecurity
order by ouverte_a_anon desc nulls last, c.relname;

-- ── 3. Synthèse ────────────────────────────────────────────────────────────
select count(*) filter (where rls)                as protegees,
       count(*) filter (where not rls)            as sans_rls,
       count(*)                                   as total
from (
  select c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'pi\_%'
) s;

-- ── 4. Distinguer le personnel des souscripteurs ───────────────────────────
-- Les jetons du portail portent eux aussi role=authenticated. Cette requête
-- liste les politiques qui n'exigent RIEN de plus que ce rôle : sur une table
-- interne, chacune de ces lignes signifie qu'un souscripteur connecté au
-- portail peut lire la table.
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename like 'pi\_%'
  and (qual is null or qual = 'true')
order by tablename;

-- ═══════════════════════════════════════════════════════════════════════════
-- À FAIRE ENSUITE, hors SQL : décoder un jeton réel du personnel pour voir
-- les claims réellement émis. ERP ouvert, session du personnel active,
-- console du navigateur :
--
--   JSON.parse(atob(JSON.parse(localStorage.sb_staff).token.split('.')[1]))
--
-- Ce que la requête 1 EXIGE doit se retrouver dans ce que le jeton PORTE.
-- Tant que ces deux éléments ne concordent pas, ne pas passer à l'étape 2.
-- ═══════════════════════════════════════════════════════════════════════════
