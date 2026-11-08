-- ═══════════════════════════════════════════════════════════════════════════
-- Relances WhatsApp (WhatsApp Cloud API) — journal d'envoi + désinscriptions
-- Fonctions : supabase/functions/wa-relances (envoi) et wa-webhook (statuts, STOP).
-- Écriture : clé de service uniquement (les fonctions). Lecture : personnel (claim app_role).
-- Rollback : drop table public.wa_relances_log; drop table public.wa_optout;
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.wa_relances_log (
  id            uuid primary key default gen_random_uuid(),
  client_id     text        not null,
  palier        text        not null check (palier in ('J-3','J0','J3','J10')),
  cycle         date        not null,                 -- échéance mensuelle concernée
  tel           text        not null,                 -- E.164 sans « + »
  montant       numeric     not null check (montant >= 100),
  mois_retard   integer     not null default 0,
  template      text        not null,
  payment_url   text,
  transaction_id text,
  wa_message_id text,
  statut        text        not null default 'en_cours'
                check (statut in ('en_cours','envoye','delivre','lu','echec')),
  erreur        text,
  envoye_par    text,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  -- Anti-doublon : un palier ne part qu'une fois par client et par échéance.
  constraint wa_relances_unique unique (client_id, cycle, palier)
);
create index if not exists wa_relances_log_client_idx on public.wa_relances_log (client_id, cree_le desc);
create index if not exists wa_relances_log_msg_idx    on public.wa_relances_log (wa_message_id) where wa_message_id is not null;

create table if not exists public.wa_optout (
  tel      text primary key,                          -- E.164 sans « + »
  motif    text not null default 'stop',
  cree_le  timestamptz not null default now()
);

alter table public.wa_relances_log enable row level security;
alter table public.wa_optout       enable row level security;
revoke all on public.wa_relances_log, public.wa_optout from anon;
revoke insert, update, delete on public.wa_relances_log, public.wa_optout from authenticated;

drop policy if exists wa_relances_log_staff_read on public.wa_relances_log;
create policy wa_relances_log_staff_read on public.wa_relances_log
  for select to authenticated using ((auth.jwt() ->> 'app_role') is not null);

drop policy if exists wa_optout_staff_read on public.wa_optout;
create policy wa_optout_staff_read on public.wa_optout
  for select to authenticated using ((auth.jwt() ->> 'app_role') is not null);

grant select on public.wa_relances_log, public.wa_optout to authenticated;
