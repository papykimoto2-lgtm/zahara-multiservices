-- ═══════════════════════════════════════════════════════════════════════════
-- Tables SMQ : maîtrise documentaire, non-conformités et actions correctives,
-- réclamations, satisfaction des clients, audits internes (Paramètres ▸ Qualité (SMQ)).
--
-- À exécuter TEL QUEL sur CHAQUE projet Supabase (Zahara ET Menco) :
-- Supabase ▸ SQL Editor ▸ coller ▸ Run. Idempotent (relançable sans dommage).
-- Même structure que toutes les tables de l'ERP : { id text, data jsonb, updated_at }.
-- Sans ces tables, les données restent enregistrées sur le poste mais ne se
-- synchronisent pas entre les postes.
-- Politique permissive identique aux autres tables pi_* (voir pi_demandes_reappro.sql).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.pi_smq_documents (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_documents to anon, authenticated;
alter table public.pi_smq_documents enable row level security;
drop policy if exists pi_smq_documents_all on public.pi_smq_documents;
create policy pi_smq_documents_all on public.pi_smq_documents for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_documents;
exception
  when duplicate_object then null;
end$$;

create table if not exists public.pi_smq_nc (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_nc to anon, authenticated;
alter table public.pi_smq_nc enable row level security;
drop policy if exists pi_smq_nc_all on public.pi_smq_nc;
create policy pi_smq_nc_all on public.pi_smq_nc for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_nc;
exception
  when duplicate_object then null;
end$$;

create table if not exists public.pi_smq_reclamations (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_reclamations to anon, authenticated;
alter table public.pi_smq_reclamations enable row level security;
drop policy if exists pi_smq_reclamations_all on public.pi_smq_reclamations;
create policy pi_smq_reclamations_all on public.pi_smq_reclamations for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_reclamations;
exception
  when duplicate_object then null;
end$$;

create table if not exists public.pi_smq_satisfaction (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_satisfaction to anon, authenticated;
alter table public.pi_smq_satisfaction enable row level security;
drop policy if exists pi_smq_satisfaction_all on public.pi_smq_satisfaction;
create policy pi_smq_satisfaction_all on public.pi_smq_satisfaction for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_satisfaction;
exception
  when duplicate_object then null;
end$$;

create table if not exists public.pi_smq_audits (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_audits to anon, authenticated;
alter table public.pi_smq_audits enable row level security;
drop policy if exists pi_smq_audits_all on public.pi_smq_audits;
create policy pi_smq_audits_all on public.pi_smq_audits for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_audits;
exception
  when duplicate_object then null;
end$$;

create table if not exists public.pi_smq_revues (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_revues to anon, authenticated;
alter table public.pi_smq_revues enable row level security;
drop policy if exists pi_smq_revues_all on public.pi_smq_revues;
create policy pi_smq_revues_all on public.pi_smq_revues for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_revues;
exception
  when duplicate_object then null;
end$$;

create table if not exists public.pi_smq_politiques (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_politiques to anon, authenticated;
alter table public.pi_smq_politiques enable row level security;
drop policy if exists pi_smq_politiques_all on public.pi_smq_politiques;
create policy pi_smq_politiques_all on public.pi_smq_politiques for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_politiques;
exception
  when duplicate_object then null;
end$$;

create table if not exists public.pi_smq_objectifs (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_objectifs to anon, authenticated;
alter table public.pi_smq_objectifs enable row level security;
drop policy if exists pi_smq_objectifs_all on public.pi_smq_objectifs;
create policy pi_smq_objectifs_all on public.pi_smq_objectifs for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_objectifs;
exception
  when duplicate_object then null;
end$$;

create table if not exists public.pi_smq_risques (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_risques to anon, authenticated;
alter table public.pi_smq_risques enable row level security;
drop policy if exists pi_smq_risques_all on public.pi_smq_risques;
create policy pi_smq_risques_all on public.pi_smq_risques for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_risques;
exception
  when duplicate_object then null;
end$$;

create table if not exists public.pi_smq_evaluations (
  id         text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on table public.pi_smq_evaluations to anon, authenticated;
alter table public.pi_smq_evaluations enable row level security;
drop policy if exists pi_smq_evaluations_all on public.pi_smq_evaluations;
create policy pi_smq_evaluations_all on public.pi_smq_evaluations for all to anon, authenticated using (true) with check (true);
do $$
begin
  alter publication supabase_realtime add table public.pi_smq_evaluations;
exception
  when duplicate_object then null;
end$$;

-- Vérification : doit renvoyer 10 lignes avec rls_active = true.
select c.relname as table_name, c.relrowsecurity as rls_active
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('pi_smq_documents','pi_smq_nc','pi_smq_reclamations','pi_smq_satisfaction','pi_smq_audits','pi_smq_revues','pi_smq_politiques','pi_smq_objectifs','pi_smq_risques','pi_smq_evaluations');
