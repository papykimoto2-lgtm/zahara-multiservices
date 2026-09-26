-- Table des bordereaux de transmission des pièces de caisse au Gérant Holding
-- (circuit de visas papier, décision DG du 26/09/2026). Structure identique
-- aux autres tables de l'ERP { id, data, updated_at } ; horloge serveur pour
-- updated_at ; RLS et temps réel comme les tables sœurs. Idempotent.
create table if not exists public.pi_bordereaux_caisse (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists pi_bordereaux_caisse_updated_at_idx on public.pi_bordereaux_caisse (updated_at);
grant all on table public.pi_bordereaux_caisse to anon, authenticated;
alter table public.pi_bordereaux_caisse enable row level security;
drop policy if exists pi_bordereaux_caisse_all on public.pi_bordereaux_caisse;
create policy pi_bordereaux_caisse_all on public.pi_bordereaux_caisse for all to anon, authenticated using (true) with check (true);
create or replace function public._touch_updated()
returns trigger language plpgsql set search_path to 'public'
as $function$ BEGIN NEW.updated_at := now(); RETURN NEW; END $function$;
drop trigger if exists trg_upd_pi_bordereaux_caisse on public.pi_bordereaux_caisse;
create trigger trg_upd_pi_bordereaux_caisse before insert or update on public.pi_bordereaux_caisse for each row execute function public._touch_updated();
do $$ begin
  alter publication supabase_realtime add table public.pi_bordereaux_caisse;
exception when duplicate_object then null; end $$;
notify pgrst, 'reload schema';
