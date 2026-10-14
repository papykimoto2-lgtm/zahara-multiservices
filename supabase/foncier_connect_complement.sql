-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — COMPLÉMENT (14/10/2026)
-- À exécuter sur Zahara (ilvusckdanwrckxqvhmr) ET Menco (pxwgefdxgrskusjbzrxz)
-- après foncier_connect.sql. Idempotent.
--
-- Constat : sur les deux projets, l'exécution s'est arrêtée avant la création
-- de la fonction du journal. Manquaient : trigger « ajout seul », 3 politiques
-- souscripteur, triggers updated_at, Realtime.
-- Faille corrigée : les privilèges par défaut de Supabase donnaient TRUNCATE
-- à `authenticated` ; TRUNCATE contourne la RLS (un jeton portail pouvait
-- vider une table). Retiré ici.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Retrait TRUNCATE / REFERENCES / TRIGGER (contournement RLS)
do $$
declare t text;
begin
  foreach t in array array[
    'pi_dossiers_fonciers','pi_evenements_fonciers','pi_intervenants_fonciers',
    'pi_missions_foncieres','pi_publications_foncieres','pi_demandes_fonciers',
    'pi_notifications_foncieres','pi_pieces_foncieres','pi_groupes_fonciers']
  loop
    execute format('revoke truncate, references, trigger on table public.%I from authenticated', t);
  end loop;
end$$;

-- 2. Journal en ajout seul (bloque UPDATE/DELETE, même pour service_role)
create or replace function public.pi_evenements_fonciers_ajout_seul()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  raise exception 'Journal foncier en ajout seul : % interdit', tg_op using errcode = '42501';
end
$fn$;

drop trigger if exists pi_evenements_fonciers_immuable on public.pi_evenements_fonciers;
create trigger pi_evenements_fonciers_immuable
  before update or delete on public.pi_evenements_fonciers
  for each row execute function public.pi_evenements_fonciers_ajout_seul();

-- 3. Souscripteur : ses propres demandes d'information uniquement
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
create policy pi_demandes_fonciers_souscripteur_update on public.pi_demandes_fonciers
  for update to authenticated
  using ((auth.jwt() ->> 'kind') = 'souscripteur'
     and data ->> 'client_id' = (auth.jwt() ->> 'client_id'))
  with check ((auth.jwt() ->> 'kind') = 'souscripteur'
          and data ->> 'client_id' = (auth.jwt() ->> 'client_id'));

-- 4. updated_at automatique
create or replace function public.pi_foncier_touch()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;

do $$
declare t text;
begin
  foreach t in array array[
    'pi_dossiers_fonciers','pi_intervenants_fonciers','pi_missions_foncieres',
    'pi_publications_foncieres','pi_demandes_fonciers','pi_notifications_foncieres',
    'pi_pieces_foncieres','pi_groupes_fonciers']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.pi_foncier_touch()', t || '_touch', t);
  end loop;
end$$;

-- 5. Realtime (pi_pieces_foncieres exclue)
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

-- 6. Vérification — 9 lignes attendues :
--    pol = 1 (4 pour demandes, 2 pour evenements), trg = 1, anon = 0,
--    truncate = false, realtime = true (false pour pieces)
select c.relname as table_name,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as pol,
       (select count(*) from pg_trigger tg where tg.tgrelid=c.oid and not tg.tgisinternal) as trg,
       (select count(*) from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=c.relname and g.grantee='anon') as anon,
       has_table_privilege('authenticated', c.oid, 'TRUNCATE') as truncate,
       exists(select 1 from pg_publication_tables pt where pt.pubname='supabase_realtime' and pt.schemaname='public' and pt.tablename=c.relname) as realtime
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname in (
  'pi_dossiers_fonciers','pi_evenements_fonciers','pi_intervenants_fonciers',
  'pi_missions_foncieres','pi_publications_foncieres','pi_demandes_fonciers',
  'pi_notifications_foncieres','pi_pieces_foncieres','pi_groupes_fonciers')
order by 1;
