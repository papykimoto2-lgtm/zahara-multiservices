-- ═══════════════════════════════════════════════════════════════════════════
-- Alertes de caisse envoyées par le serveur (e-mail) — table de suivi + planification
-- Fonction : supabase/functions/caisse-alertes (à déployer AVANT de planifier).
-- La fonction ne fait rien tant que l'envoi serveur n'est pas activé dans Menko Immo.
-- Rollback : select cron.unschedule('caisse-alertes'); drop table public.caisse_alertes_envoyees;
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.caisse_alertes_envoyees (
  session_id text primary key,
  envoye_le  timestamptz not null default now()
);
-- Accès réservé à la clé de service (la fonction) : RLS activé, aucune politique.
alter table public.caisse_alertes_envoyees enable row level security;
revoke all on public.caisse_alertes_envoyees from anon, authenticated;

-- Toutes les 30 minutes. Remplacer <ANON_KEY> par la clé « anon » publique du projet.
select cron.schedule('caisse-alertes', '*/30 * * * *', $$
  select net.http_post(
    url     := 'https://ilvusckdanwrckxqvhmr.supabase.co/functions/v1/caisse-alertes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
    body    := '{}'::jsonb
  );
$$);
