-- ═════════════════════════════════════════════════════════════════════════
-- RLS — ÉTAPE 3 : FERMETURE PAR VAGUES (script PRÉPARÉ, NON APPLIQUÉ)
--
-- ⛔ NE RIEN EXÉCUTER avant d'avoir lu supabase/RLS_RECETTE_FERMETURE.md.
--    Ce fichier ne fait que créer des fonctions et une table de sauvegarde ;
--    il ne retire aucune politique tant que fermer() n'est pas appelée avec
--    p_simulation => false.
--
-- Principe
--   · On retire les politiques « ouvertes » (cmd ALL, condition vide ou true,
--     pour anon / authenticated / public) : *_open_rollback, anon_all, auth_all,
--     *_all (anon,authenticated).
--   · On GARDE personnel_tout (jeton du personnel, claim app_role) et toutes les
--     politiques portail_* (jetons du portail, INSERT anonymes de formulaires).
--   · Chaque politique retirée est d'abord SAUVEGARDÉE dans
--     rls_fermeture.politiques_sauvegarde : restaurer() les recrée à l'identique.
--   · fermer() refuse une table sans politique personnel_tout.
--
-- À jouer sur UNE instance à la fois, d'abord sur une COPIE (branche Supabase).
-- Confirmer l'organisation ET le nom du projet avant d'écrire (voir
-- rls_02_pilote.sql, « confusion de compte »).
-- ═════════════════════════════════════════════════════════════════════════

create schema if not exists rls_fermeture;

create table if not exists rls_fermeture.politiques_sauvegarde (
  id            bigserial primary key,
  vague         text        not null,
  sauvegarde_le timestamptz not null default now(),
  tablename     text        not null,
  policyname    text        not null,
  permissive    text,
  roles         text,
  cmd           text,
  qual          text,
  with_check    text,
  restauree_le  timestamptz
);

-- Politiques « ouvertes » d'une table (candidates au retrait).
create or replace function rls_fermeture.politiques_ouvertes(p_table text)
returns table(policyname name, permissive text, roles name[], cmd text, qual text, with_check text)
language sql stable as $$
  select p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = p_table and p.cmd = 'ALL'
    and p.roles && array['anon','authenticated','public']::name[]
    and coalesce(trim(p.qual), 'true') in ('true', '(true)')
    and p.policyname <> 'personnel_tout'
$$;

-- Tables exposées au portail (déduites de portail-unique.html, 31/10/2026).
-- pi_users et pi_employes n'y figurent plus : le portail ne les lit plus.
create or replace function rls_fermeture.tables_portail() returns text[] language sql immutable as $$
  select array['pi_af_financiers','pi_af_manifestations','pi_af_operations','pi_af_versements_financiers','pi_ag_copro',
    'pi_amenageurs','pi_appels_charges_copro','pi_apporteurs','pi_baux','pi_cessions_foncieres','pi_clients','pi_commissions',
    'pi_conventions','pi_conventions_amenagement','pi_coproprietes','pi_declarations_versement_financier',
    'pi_declarations_versement_foncier','pi_diaspo_dossiers','pi_diaspo_jalons','pi_diaspo_parts','pi_diaspo_preuves',
    'pi_dossiers_lot','pi_fonds_travaux_copro','pi_lots_copro','pi_ordres_travaux','pi_paiements_online',
    'pi_partenaires_lot','pi_proprietaires_bailleurs','pi_quittances','pi_rapports_lot','pi_receptions_dossiers',
    'pi_signalements','pi_situations_amenagement','pi_versements']::text[]
$$;

-- Tables sensibles ou à double usage : vague C, une par une.
create or replace function rls_fermeture.tables_speciales() returns text[] language sql immutable as $$
  select array['pi_users','pi_params','pi_suppressions','pi_logs_connexion','pi_leads','pi_portail_analytics',
    'pi_portail_medias','pi_portail_messages','pi_audit_log','pi_documents','pi_messages','pi_conversations',
    'pi_validations']::text[]
$$;

-- Autres applications (hub Menko, Menko Agro) : hors périmètre, NE PAS toucher ici.
create or replace function rls_fermeture.tables_exclues() returns text[] language sql immutable as $$
  select array['agro_state','menko_hub_users','menko_hub_audit','api_keys','api_access_log']::text[]
$$;

-- Tables encore ouvertes dans la base courante.
create or replace function rls_fermeture.tables_ouvertes() returns text[] language sql stable as $$
  select coalesce(array_agg(distinct t.tablename order by t.tablename), '{}')
  from pg_tables t
  where t.schemaname = 'public'
    and exists (select 1 from rls_fermeture.politiques_ouvertes(t.tablename))
$$;

-- Vagues : A = internes (le portail n'y touche pas), B = exposées au portail (politiques portail_* conservées),
--          C = sensibles / double usage.
create or replace function rls_fermeture.vague(p_nom text) returns text[] language sql stable as $$
  select coalesce(array_agg(t order by t), '{}') from unnest(rls_fermeture.tables_ouvertes()) t
  where t <> all (rls_fermeture.tables_exclues())
    and case upper(p_nom)
          when 'A' then t <> all (rls_fermeture.tables_portail()) and t <> all (rls_fermeture.tables_speciales())
          when 'B' then t = any (rls_fermeture.tables_portail()) and t <> all (rls_fermeture.tables_speciales())
          when 'C' then t = any (rls_fermeture.tables_speciales())
          else false end
$$;

-- Fermeture. SIMULATION PAR DÉFAUT : ne retire rien, liste seulement.
create or replace function rls_fermeture.fermer(p_tables text[], p_vague text, p_simulation boolean default true)
returns table(tbl text, pol text, action text) language plpgsql as $$
declare t text; r record;
begin
  foreach t in array p_tables loop
    if not exists (select 1 from pg_tables x where x.schemaname = 'public' and x.tablename = t) then
      tbl := t; pol := '-'; action := 'table absente'; return next; continue;
    end if;
    if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.policyname = 'personnel_tout') then
      raise exception 'Table % sans politique personnel_tout : fermeture refusée (le personnel perdrait l''accès).', t;
    end if;
    for r in select * from rls_fermeture.politiques_ouvertes(t) loop
      tbl := t; pol := r.policyname;
      if p_simulation then action := 'SIMULATION : serait retirée'; return next; continue; end if;
      insert into rls_fermeture.politiques_sauvegarde(vague, tablename, policyname, permissive, roles, cmd, qual, with_check)
      values (p_vague, t, r.policyname, r.permissive, array_to_string(r.roles, ','), r.cmd, r.qual, r.with_check);
      execute format('drop policy %I on public.%I', r.policyname, t);
      action := 'retirée'; return next;
    end loop;
  end loop;
end $$;

-- Retour arrière : recrée à l'identique les politiques retirées (toutes, ou d'une vague).
create or replace function rls_fermeture.restaurer(p_vague text default null) returns integer language plpgsql as $$
declare r record; n integer := 0;
begin
  for r in select * from rls_fermeture.politiques_sauvegarde
           where restauree_le is null and (p_vague is null or vague = p_vague) order by id desc loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    execute format('create policy %I on public.%I as %s for %s to %s%s%s', r.policyname, r.tablename,
      coalesce(r.permissive, 'PERMISSIVE'), r.cmd, r.roles,
      case when r.qual is not null then ' using (' || r.qual || ')' else '' end,
      case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end);
    update rls_fermeture.politiques_sauvegarde set restauree_le = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───────────────────────── MODE D'EMPLOI (à copier, pas à exécuter d'un bloc) ─────────────────────────
-- 0. État des lieux (lecture seule) :
--      select unnest(rls_fermeture.tables_ouvertes());
--      select rls_fermeture.vague('A'), rls_fermeture.vague('B'), rls_fermeture.vague('C');
--
-- 1. PRÉALABLE aux vagues B et C : les vues publiques en « security_invoker » lisent les tables de base avec les droits
--    de l'appelant (anon) ; une fois ces tables fermées elles deviendraient VIDES. On les repasse en droits du
--    propriétaire (elles n'exposent déjà que leurs colonnes publiques) :
--      alter view if exists public.pi_parcelles_public       set (security_invoker = false);
--      alter view if exists public.pi_operations_public      set (security_invoker = false);
--      alter view if exists public.pi_biens_louer_public     set (security_invoker = false);
--      alter view if exists public.pi_appel_financiers_public set (security_invoker = false);
--    Retour arrière : même commande avec set (security_invoker = true).
--
-- 2. Vague A (simulation, puis réelle). Recette après CHAQUE vague (RLS_RECETTE_FERMETURE.md) :
--      select * from rls_fermeture.fermer(rls_fermeture.vague('A'), 'A');                -- simulation
--      select * from rls_fermeture.fermer(rls_fermeture.vague('A'), 'A', false);         -- réel
--
-- 3. Vague B, puis vague C table par table :
--      select * from rls_fermeture.fermer(array['pi_leads'], 'C-leads', false);
--
-- 4. Retour arrière immédiat si la recette échoue :
--      select rls_fermeture.restaurer('A');   -- une vague
--      select rls_fermeture.restaurer();      -- tout
