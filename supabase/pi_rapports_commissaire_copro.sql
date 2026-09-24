-- Table manquante signalée par Paramètres → Synchronisation :
--   HTTP 404 PGRST205 « Could not find the table 'public.pi_rapports_commissaire_copro' »
-- Le client la déclare dans SUPA_STORE_MAP (store rapports_commissaire_copro)
-- mais elle n'avait jamais été créée. Structure, index, RLS et realtime
-- calqués à l'identique sur les tables sœurs pi_ag_copro / pi_fonds_travaux_copro.
create table if not exists public.pi_rapports_commissaire_copro (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);
create index if not exists idx_rapports_commissaire_copro_copro
  on public.pi_rapports_commissaire_copro ((data ->> 'copropriete_id'));
create index if not exists pi_rapports_commissaire_copro_updated_at_idx
  on public.pi_rapports_commissaire_copro (updated_at);

alter table public.pi_rapports_commissaire_copro enable row level security;
drop policy if exists pi_rapports_commissaire_copro_open_rollback on public.pi_rapports_commissaire_copro;
create policy pi_rapports_commissaire_copro_open_rollback on public.pi_rapports_commissaire_copro
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.pi_rapports_commissaire_copro to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.pi_rapports_commissaire_copro;
exception when duplicate_object then null; end $$;

-- Recharge le cache de schéma PostgREST (sinon 404 jusqu'au prochain rechargement)
notify pgrst, 'reload schema';
