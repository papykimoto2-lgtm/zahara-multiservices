-- ═══════════════════════════════════════════════════════════════════════════
-- Correctif synchronisation : tables absentes de pull_incremental()
--
-- Symptôme : une caissière soumet une demande de réapprovisionnement, elle
-- arrive bien dans pi_demandes_reappro, mais les validateurs ne la voient
-- jamais. Cause : pull_incremental() (récupération groupée utilisée par tous
-- les postes) contient une LISTE FIGÉE de tables, générée avant la création
-- de 5 tables : pi_demandes_reappro, pi_incidents, pi_demandes_paiement,
-- pi_conventions_reglementees, pi_rapports_commissaire_copro. Leurs lignes
-- n'étaient donc jamais redescendues sur les autres postes.
--
-- Correctif : la fonction d'origine est conservée (pull_incremental_v1) ;
-- la nouvelle pull_incremental() l'appelle puis complète automatiquement
-- avec TOUTE table demandée par le client (clés de "cursors") qu'elle aurait
-- omise — y compris les tables créées à l'avenir. Noms de tables validés
-- (motif pi_… + existence réelle des colonnes id/data/updated_at).
-- Horloge serveur pour updated_at sur les tables qui n'avaient pas le
-- déclencheur : le curseur incrémental ne dépend plus de l'heure des postes.
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════
do $$ begin
  if to_regprocedure('public.pull_incremental_v1(jsonb)') is null then
    alter function public.pull_incremental(jsonb) rename to pull_incremental_v1;
  end if;
end $$;

create or replace function public.pull_incremental(cursors jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result jsonb;
  t text;
  cur text;
  rows jsonb;
begin
  result := public.pull_incremental_v1(cursors);
  for t in select jsonb_object_keys(coalesce(cursors, '{}'::jsonb)) loop
    continue when result ? t;
    continue when t !~ '^pi_[a-z0-9_]+$';
    continue when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = t
                     and column_name in ('id','data','updated_at')) < 3;
    cur := cursors->>t;
    if cur is null or cur = '' then
      execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'', id, ''data'', data, ''updated_at'', updated_at)), ''[]''::jsonb) from public.%I', t)
        into rows;
    else
      execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'', id, ''data'', data, ''updated_at'', updated_at)), ''[]''::jsonb) from public.%I where updated_at > $1::timestamptz', t)
        into rows using cur;
    end if;
    result := result || jsonb_build_object(t, rows);
  end loop;
  return result;
end;
$function$;

grant execute on function public.pull_incremental(jsonb) to anon, authenticated, service_role;

create or replace function public._touch_updated()
returns trigger language plpgsql set search_path to 'public'
as $function$ BEGIN NEW.updated_at := now(); RETURN NEW; END $function$;

do $$
declare t text;
begin
  foreach t in array array['pi_demandes_reappro','pi_incidents','pi_demandes_paiement','pi_conventions_reglementees',
                           'pi_rapports_commissaire_copro','pi_fiches_engagement_depense'] loop
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='updated_at')
       and not exists (select 1 from pg_trigger where tgrelid = ('public.' || t)::regclass and tgname = 'trg_upd_' || t) then
      execute format('create trigger %I before insert or update on public.%I for each row execute function public._touch_updated()', 'trg_upd_' || t, t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
