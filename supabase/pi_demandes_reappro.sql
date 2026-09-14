-- ═══════════════════════════════════════════════════════════════════════════
-- Table pi_demandes_reappro — Demandes de réapprovisionnement de fonds
-- des caisses de division (module Caisse → onglet Réapprovisionnement).
--
-- À exécuter TEL QUEL sur CHAQUE projet Supabase (Zahara ET Menco) :
-- Supabase ▸ SQL Editor ▸ coller ▸ Run. Le script est identique pour les
-- deux instances, seul le projet sur lequel on l'exécute change.
--
-- Idempotent : il peut être relancé sans dommage (create if not exists,
-- drop policy if exists, ajout à la publication protégé par exception).
--
-- Structure volontairement identique à celle de toutes les autres tables de
-- l'ERP — { id text, data jsonb, updated_at } — car la couche de synchro
-- (SUPA_STORE_MAP / _supaRow) écrit et relit uniformément sous cette forme.
-- Changer la forme ici casserait la synchronisation de ce store.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.pi_demandes_reappro (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- L'ERP se synchronise avec la clé anon (voir SB_KEY) : sans ce grant, les
-- demandes resteraient enregistrées en local sans jamais remonter au cloud,
-- silencieusement.
grant all on table public.pi_demandes_reappro to anon, authenticated;

alter table public.pi_demandes_reappro enable row level security;

-- Politique permissive, identique à celle des autres tables de l'ERP.
-- ⚠️ Conséquence à connaître : la clé anon figure en clair dans le portail
-- public, donc quiconque la récupère peut lire cette table. C'est une
-- propriété de l'architecture actuelle (toutes les tables pi_* sont ainsi),
-- pas une particularité de celle-ci. La resserrer suppose d'abord que l'ERP
-- s'authentifie autrement qu'avec la clé anon.
drop policy if exists pi_demandes_reappro_all on public.pi_demandes_reappro;
create policy pi_demandes_reappro_all on public.pi_demandes_reappro
  for all to anon, authenticated
  using (true) with check (true);

-- Realtime : permet aux autres postes de voir une demande apparaître ou
-- changer d'état sans recharger. L'exception évite l'échec si la table est
-- déjà dans la publication.
do $$
begin
  alter publication supabase_realtime add table public.pi_demandes_reappro;
exception
  when duplicate_object then null;
end$$;

-- ── Vérification ───────────────────────────────────────────────────────────
-- Doit renvoyer une ligne : la table, RLS activée, et sa politique.
select c.relname                              as table_name,
       c.relrowsecurity                       as rls_active,
       (select count(*) from pg_policies p
         where p.tablename = 'pi_demandes_reappro') as nb_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'pi_demandes_reappro';
