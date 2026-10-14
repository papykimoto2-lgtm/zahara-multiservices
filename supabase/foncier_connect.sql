-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — tables Supabase (Portefeuille foncier › Sécurisation du titre)
--
-- À exécuter sur CHAQUE projet Supabase (Zahara ET Menco), SQL Editor ▸ Run.
-- Idempotent : relançable sans dommage.
--
-- PRÉREQUIS : staff-login déployé (claim `app_role` dans le jeton du personnel)
-- et pilote RLS validé (rls_02_pilote.sql). Ces tables sont créées SANS aucun
-- accès `anon` : un poste non authentifié ne lit ni n'écrit rien.
--
-- Format uniforme de l'ERP : id / data jsonb / updated_at (+ scope_id).
-- Pas d'organization_id : une base par client.
--
-- Tables (une par store local de index.html / menko-immo.html) :
--   pi_dossiers_fonciers · pi_evenements_fonciers (journal, ajout seul)
--   pi_intervenants_fonciers · pi_missions_foncieres
--   pi_publications_foncieres · pi_demandes_fonciers
--   pi_notifications_foncieres · pi_pieces_foncieres · pi_groupes_fonciers
--
-- Accès :
--   · personnel  (jwt.app_role non nul)  : lecture/écriture sur tout ;
--   · souscripteur (jwt.kind='souscripteur', jwt.client_id) : uniquement SES
--     demandes d'information (pi_demandes_fonciers) ;
--   · intervenant externe : aucun accès direct (pas de portail en base) ;
--   · journal : INSERT + SELECT seulement ; UPDATE/DELETE refusés par droits,
--     par RLS ET par trigger (valable même pour service_role).
--
-- APRÈS exécution côté application (hors de ce script) :
--   1. ajouter les 9 stores à SUPA_STORE_MAP ;
--   2. les retirer de SANIX_STORES_LOCAL_UNIQUEMENT ;
--   3. faire la recette (voir fin de fichier).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tables ──────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'pi_dossiers_fonciers','pi_evenements_fonciers','pi_intervenants_fonciers',
    'pi_missions_foncieres','pi_publications_foncieres','pi_demandes_fonciers',
    'pi_notifications_foncieres','pi_pieces_foncieres','pi_groupes_fonciers']
  loop
    execute format($f$
      create table if not exists public.%I (
        id         text        primary key,
        data       jsonb       not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        scope_id   text
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- Aucun accès anon, jamais.
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from public', t);
  end loop;
end$$;

-- ── 2. Index (filtres réellement utilisés par l'application) ───────────────
create index if not exists pi_df_parcelle   on public.pi_dossiers_fonciers   ((data->>'parcelle_id'));
create index if not exists pi_df_statut     on public.pi_dossiers_fonciers   ((data->>'statut'));
create index if not exists pi_df_ref        on public.pi_dossiers_fonciers   ((data->>'reference'));
create index if not exists pi_ef_dossier    on public.pi_evenements_fonciers ((data->>'dossier_id'), updated_at desc);
create index if not exists pi_mf_dossier    on public.pi_missions_foncieres  ((data->>'dossier_id'));
create index if not exists pi_mf_interv     on public.pi_missions_foncieres  ((data->>'intervenant_id'));
create index if not exists pi_pf_dossier    on public.pi_publications_foncieres ((data->>'dossier_id'));
create index if not exists pi_dmf_client    on public.pi_demandes_fonciers   ((data->>'client_id'));
create index if not exists pi_nf_dest       on public.pi_notifications_foncieres ((data->>'statut'), updated_at desc);
create index if not exists pi_pcf_dossier   on public.pi_pieces_foncieres    ((data->>'dossier_id'));

-- ── 3. Politiques RLS ──────────────────────────────────────────────────────
-- Personnel : toutes tables sauf le journal (traité à part, ajout seul).
do $$
declare
  t text;
  staff constant text := $c$ (auth.jwt() ->> 'app_role') is not null $c$;
begin
  foreach t in array array[
    'pi_dossiers_fonciers','pi_intervenants_fonciers','pi_missions_foncieres',
    'pi_publications_foncieres','pi_demandes_fonciers','pi_notifications_foncieres',
    'pi_pieces_foncieres','pi_groupes_fonciers']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (%s) with check (%s)',
      t || '_staff', t, staff, staff);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end$$;

-- Journal : ajout seul (RM-02, §14).
drop policy if exists pi_evenements_fonciers_select on public.pi_evenements_fonciers;
drop policy if exists pi_evenements_fonciers_insert on public.pi_evenements_fonciers;
create policy pi_evenements_fonciers_select on public.pi_evenements_fonciers
  for select to authenticated using ((auth.jwt() ->> 'app_role') is not null);
create policy pi_evenements_fonciers_insert on public.pi_evenements_fonciers
  for insert to authenticated with check ((auth.jwt() ->> 'app_role') is not null);
revoke all on table public.pi_evenements_fonciers from authenticated;
grant select, insert on table public.pi_evenements_fonciers to authenticated;

-- Trigger : bloque UPDATE/DELETE même pour service_role (qui contourne la RLS).
create or replace function public.pi_evenements_fonciers_ajout_seul()
returns trigger language plpgsql as $$
begin
  raise exception 'Journal foncier en ajout seul : % interdit', tg_op
    using errcode = '42501';
end$$;
drop trigger if exists pi_evenements_fonciers_immuable on public.pi_evenements_fonciers;
create trigger pi_evenements_fonciers_immuable
  before update or delete on public.pi_evenements_fonciers
  for each row execute function public.pi_evenements_fonciers_ajout_seul();

-- Souscripteur : ses propres demandes d'information uniquement (§9.6).
-- Le jeton du portail porte kind='souscripteur' et client_id (portal-login).
drop policy if exists pi_demandes_fonciers_souscripteur_select on public.pi_demandes_fonciers;
drop policy if exists pi_demandes_fonciers_souscripteur_insert on public.pi_demandes_fonciers;
drop policy if exists pi_demandes_fonciers_souscripteur_update on public.pi_demandes_fonciers;
create policy pi_demandes_fonciers_souscripteur_select on public.pi_demandes_fonciers
  for select to authenticated
  using ((auth.jwt() ->> 'kind') = 'souscripteur'
     and data ->> 'client_id' = (auth.jwt() ->> 'client_id'));
create policy pi_demandes_fonciers_souscripteur_insert on public.pi_demandes_fonciers
  for insert to authenticated
  with check ((auth.jwt() ->> 'kind') = 'souscripteur'
          and data ->> 'client_id' = (auth.jwt() ->> 'client_id'));
-- Ajout d'un message à sa propre demande ; le client_id ne peut pas changer.
create policy pi_demandes_fonciers_souscripteur_update on public.pi_demandes_fonciers
  for update to authenticated
  using ((auth.jwt() ->> 'kind') = 'souscripteur'
     and data ->> 'client_id' = (auth.jwt() ->> 'client_id'))
  with check ((auth.jwt() ->> 'kind') = 'souscripteur'
          and data ->> 'client_id' = (auth.jwt() ->> 'client_id'));

-- Publications et dossiers : PAS d'accès souscripteur direct. Le lien
-- dossier → souscripteur passe par les lots de la parcelle (calculé côté
-- application, fcDossiersDuSouscripteur) et n'existe pas en base. À traiter
-- avec le portail : fonction SECURITY DEFINER renvoyant la vue publique
-- (cf. fcVueSouscripteur), jamais l'accès brut à la table.

-- ── 4. updated_at automatique ──────────────────────────────────────────────
create or replace function public.pi_foncier_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end$$;

do $$
declare t text;
begin
  foreach t in array array[
    'pi_dossiers_fonciers','pi_intervenants_fonciers','pi_missions_foncieres',
    'pi_publications_foncieres','pi_demandes_fonciers','pi_notifications_foncieres',
    'pi_pieces_foncieres','pi_groupes_fonciers']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.pi_foncier_touch()',
      t || '_touch', t);
  end loop;
end$$;

-- ── 5. Realtime (la RLS s'applique aussi aux abonnements) ──────────────────
-- pi_pieces_foncieres exclue : pièces d'identité et titres, aucune diffusion.
do $$
declare t text;
begin
  foreach t in array array[
    'pi_dossiers_fonciers','pi_evenements_fonciers','pi_missions_foncieres',
    'pi_publications_foncieres','pi_demandes_fonciers','pi_notifications_foncieres',
    'pi_groupes_fonciers','pi_intervenants_fonciers']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end$$;

-- ── 6. Vérification ────────────────────────────────────────────────────────
-- 9 lignes attendues : rls_active = true, anon_grants = 0.
select c.relname as table_name,
       c.relrowsecurity as rls_active,
       (select count(*) from pg_policies p where p.tablename = c.relname) as nb_policies,
       (select count(*) from information_schema.role_table_grants g
         where g.table_name = c.relname and g.grantee = 'anon') as anon_grants
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'pi_dossiers_fonciers','pi_evenements_fonciers','pi_intervenants_fonciers',
  'pi_missions_foncieres','pi_publications_foncieres','pi_demandes_fonciers',
  'pi_notifications_foncieres','pi_pieces_foncieres','pi_groupes_fonciers')
order by 1;

-- ── RECETTE (après branchement dans SUPA_STORE_MAP) ────────────────────────
--  1. Personnel connecté : ouvrir un dossier foncier → toast cloud vert.
--  2. Clé anon seule (déconnecté) : lecture/écriture refusées (401/403).
--  3. Journal : `update pi_evenements_fonciers set data='{}'` → erreur 42501.
--  4. Jeton souscripteur : ne voit que ses demandes ; rien d'autre.
--  5. Second poste : un dossier créé apparaît sans rechargement.
--
-- ── RETOUR ARRIÈRE ─────────────────────────────────────────────────────────
--  Les données restent en local : supprimer les tables ne perd rien tant que
--  les stores sont dans SANIX_STORES_LOCAL_UNIQUEMENT.
--  drop table if exists public.pi_dossiers_fonciers, public.pi_evenements_fonciers,
--    public.pi_intervenants_fonciers, public.pi_missions_foncieres,
--    public.pi_publications_foncieres, public.pi_demandes_fonciers,
--    public.pi_notifications_foncieres, public.pi_pieces_foncieres,
--    public.pi_groupes_fonciers cascade;
