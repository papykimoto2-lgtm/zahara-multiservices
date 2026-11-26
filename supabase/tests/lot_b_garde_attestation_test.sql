-- Tests de la garde serveur des attestations (supabase/lot_b_garde_attestation.sql) sur un PostgreSQL de test.
-- Usage : psql -U postgres -v ON_ERROR_STOP=1 -f supabase/tests/lot_b_garde_attestation_test.sql
-- Simule Supabase : schéma auth (jwt(), role()), rôles, tables pi_*.
\set ON_ERROR_STOP on
drop schema if exists attestation_garde cascade;
drop schema if exists auth cascade;
drop table if exists public.pi_clients, public.pi_cessions_foncieres, public.pi_validations, public.pi_users cascade;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'agent_app') then create role agent_app nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  grant authenticated to agent_app;
end $$;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;
create table public.pi_clients (id text primary key, data jsonb not null default '{}', updated_at timestamptz default now());
create table public.pi_cessions_foncieres (like public.pi_clients including all);
create table public.pi_validations (like public.pi_clients including all);
create table public.pi_users (id text primary key, login text, nom text, role text, statut text, actif boolean, password text, password_hash text, salt text, pwd_algo text, pwd_iter int, caisse_pin_hash text, caisse_pin_salt text, scope_id text, division_id text, derniere_connexion timestamptz);
grant usage on schema public, auth to agent_app;
grant all on public.pi_clients, public.pi_cessions_foncieres, public.pi_validations, public.pi_users to agent_app;
\i supabase/lot_b_garde_attestation.sql
-- (les droits d'exécution sont donnés par le script lui-même aux rôles anon, authenticated, service_role)

create or replace function pg_temp.essai(p_nom text, p_sql text, p_claims text, p_attendu_refus boolean) returns void language plpgsql as $$
declare refuse boolean := false;
begin
  perform set_config('request.jwt.claims', p_claims, true);
  execute 'set local session authorization agent_app';
  begin
    execute p_sql;
  exception when raise_exception then refuse := true;
  end;
  execute 'reset session authorization';
  if refuse is distinct from p_attendu_refus then
    raise exception 'ÉCHEC « % » : refus=% attendu=%', p_nom, refuse, p_attendu_refus;
  end if;
  raise notice 'ok  — %', p_nom;
end $$;

-- Fixtures (en tant que postgres : la garde laisse passer l'administration)
insert into public.pi_clients values
  ('c1', '{"nom":"A","attestation_solde":{"numero":"ATS-2026-0001","statut":"en_attente","prix":1000,"verse":1000}}'),
  ('c2', '{"nom":"B","attestation_solde":{"numero":"ATS-2026-0002","statut":"valide","valide_par":"DG","valide_le":"2026-11-01","date_emission":"2026-11-01","prix":1000,"verse":1000,"html":"<p>X</p>"}}'),
  ('c3', '{"nom":"C","attestation_solde":{"numero":"ATS-2026-0003","statut":"en_attente","prix":1000,"verse":1000}}'),
  ('c4', '{"nom":"D","attestation_solde":{"numero":"ATS-2026-0004","statut":"en_attente","prix":1000,"verse":1000}}');
insert into public.pi_validations values
  ('v1', '{"type":"attestation_solde","ref_id":"c1","statut":"en_attente"}'),
  ('v2', '{"type":"attestation_solde","ref_id":"c2","statut":"valide"}'),
  ('v3', '{"type":"bon_commande","ref_id":"b1","statut":"en_attente"}');

-- ═══ MODE JOURNAL : rien n'est refusé, tout est consigné ═══
select pg_temp.essai('journal : une écriture non autorisée passe mais est consignée',
  $q$update public.pi_clients set data = jsonb_set(data, '{attestation_solde,statut}', '"valide"') where id = 'c1'$q$,
  '{"role":"anon"}', false);
do $$ begin
  if (select count(*) from attestation_garde.journal where ligne_id = 'c1' and violation like 'validation sans rôle%') <> 1 then
    raise exception 'ÉCHEC : violation non consignée en mode journal'; end if;
  raise notice 'ok  — journal : la violation est consignée';
end $$;
update public.pi_clients set data = jsonb_set(data, '{attestation_solde,statut}', '"en_attente"') where id = 'c1';   -- remise en état (postgres)

-- robustesse : un droit manquant sur le journal ne doit JAMAIS bloquer une écriture de l'ERP (mode journal)
revoke execute on function attestation_garde.consigner(text, text, text, text, jsonb) from public, authenticated, agent_app;
select pg_temp.essai('journal : droit manquant sur la garde = écriture conservée (incident consigné ailleurs)',
  $q$update public.pi_clients set data = jsonb_set(data, '{attestation_solde,statut}', '"valide"') where id = 'c3'$q$,
  '{"role":"anon"}', false);
grant execute on function attestation_garde.consigner(text, text, text, text, jsonb) to public;
update public.pi_clients set data = jsonb_set(data, '{attestation_solde,statut}', '"en_attente"') where id = 'c3';   -- remise en état

update attestation_garde.config set mode = 'bloque';

-- ═══ MODE BLOQUE ═══
select pg_temp.essai('anon ne peut pas valider', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,statut}','"valide"') where id='c1'$q$, '{"role":"anon"}', true);
select pg_temp.essai('un agent (commercial) ne peut pas valider', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,statut}','"valide"') where id='c1'$q$, '{"role":"authenticated","app_role":"commercial"}', true);
select pg_temp.essai('un jeton portail ne peut pas valider', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,statut}','"valide"') where id='c1'$q$, '{"role":"authenticated","kind":"souscripteur","scope_id":"c1"}', true);
select pg_temp.essai('un manager peut valider (en_attente → valide)', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,statut}','"valide"') where id='c1'$q$, '{"role":"authenticated","app_role":"manager"}', false);
select pg_temp.essai('on ne valide pas depuis « brouillon »', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde,statut}','"brouillon"'),'{attestation_solde,x}','1') where id='c3'$q$, '{"role":"authenticated","app_role":"admin"}', false);
select pg_temp.essai('…puis brouillon → valide refusé même pour un admin', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,statut}','"valide"') where id='c3'$q$, '{"role":"authenticated","app_role":"admin"}', true);
select pg_temp.essai('un agent ne publie pas au portail', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,publie_portail}','true') where id='c2'$q$, '{"role":"authenticated","app_role":"commercial"}', true);
select pg_temp.essai('un admin publie une attestation validée', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,publie_portail}','true') where id='c2'$q$, '{"role":"authenticated","app_role":"admin"}', false);
select pg_temp.essai('un agent ne transmet pas au notaire', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,transmis_notaire}','true') where id='c2'$q$, '{"role":"authenticated","app_role":"commercial"}', true);
select pg_temp.essai('attestation validée : le texte est immuable', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,html}','"<script>x</script>"') where id='c2'$q$, '{"role":"authenticated","app_role":"admin"}', true);
select pg_temp.essai('attestation validée : le montant est immuable', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,prix}','1') where id='c2'$q$, '{"role":"authenticated","app_role":"admin"}', true);
select pg_temp.essai('visa : texte modifié avec une entrée de plus dans visa_historique', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde,html}','"<p>X visa</p>"'),'{attestation_solde,visa_historique}','[{"par":"DG"}]') where id='c2'$q$, '{"role":"authenticated","app_role":"admin"}', false);
select pg_temp.essai('un agent peut retirer le texte notaire (obsolescence automatique)', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,obsolete}','{"motif":"x"}') where id='c2'$q$, '{"role":"authenticated","app_role":"commercial"}', false);
select pg_temp.essai('annulation sans trace refusée', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,statut}','"brouillon"') where id='c2'$q$, '{"role":"authenticated","app_role":"admin"}', true);
select pg_temp.essai('annulation par un agent refusée', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde,statut}','"brouillon"'),'{attestation_solde,annulations}','[{"motif":"m"}]') where id='c2'$q$, '{"role":"authenticated","app_role":"commercial"}', true);
select pg_temp.essai('annulation avec motif tracé par un manager', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde,statut}','"brouillon"'),'{attestation_solde,annulations}','[{"motif":"m"}]') where id='c2'$q$, '{"role":"authenticated","app_role":"manager"}', false);
select pg_temp.essai('numéro déjà porté par une attestation validée', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,numero}','"ATS-2026-0001"') where id='c3'$q$, '{"role":"authenticated","app_role":"manager"}', false);
select pg_temp.essai('…validation d''un doublon de numéro refusée', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,statut}','"valide"') where id='c3'$q$, '{"role":"authenticated","app_role":"manager"}', true);
select pg_temp.essai('service_role (Edge Function) peut valider', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,statut}','"valide"') where id='c4'$q$, '{"role":"service_role"}', false);
select pg_temp.essai('…mais l''immutabilité vaut pour tous, service_role compris', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,html}','"<p>maj</p>"') where id='c4'$q$, '{"role":"service_role"}', true);
select pg_temp.essai('upsert d''une ligne existante inchangée : jamais refusé', $q$insert into public.pi_clients (id, data) values ('c2', (select data from public.pi_clients where id='c2')) on conflict (id) do update set data = excluded.data$q$, '{"role":"anon"}', false);
select pg_temp.essai('création d''un client avec attestation validée sans rôle : refusée', $q$insert into public.pi_clients (id, data) values ('cx', '{"attestation_solde":{"numero":"ATS-2026-0099","statut":"valide"}}')$q$, '{"role":"anon"}', true);
select pg_temp.essai('création d''un client ordinaire par anon : libre (formulaires publics)', $q$insert into public.pi_clients (id, data) values ('cy', '{"nom":"Prospect"}')$q$, '{"role":"anon"}', false);
select pg_temp.essai('les autres champs du client restent libres', $q$update public.pi_clients set data = jsonb_set(data,'{nom}','"Nouveau"') where id='c2'$q$, '{"role":"anon"}', false);
-- validations
select pg_temp.essai('anon ne décide pas une validation d''attestation', $q$update public.pi_validations set data = jsonb_set(data,'{statut}','"valide"') where id='v1'$q$, '{"role":"anon"}', true);
select pg_temp.essai('manager décide (en_attente → valide)', $q$update public.pi_validations set data = jsonb_set(data,'{statut}','"valide"') where id='v1'$q$, '{"role":"authenticated","app_role":"manager"}', false);
select pg_temp.essai('valide → rejete (effet refusé par l''ERP) permis au manager', $q$update public.pi_validations set data = jsonb_set(data,'{statut}','"rejete"') where id='v1'$q$, '{"role":"authenticated","app_role":"manager"}', false);
select pg_temp.essai('…mais rejete est définitif (rejete → valide)', $q$update public.pi_validations set data = jsonb_set(data,'{statut}','"valide"') where id='v1'$q$, '{"role":"authenticated","app_role":"manager"}', true);
select pg_temp.essai('valide → annule (annulation) permis au manager', $q$update public.pi_validations set data = jsonb_set(data,'{statut}','"annule"') where id='v2'$q$, '{"role":"authenticated","app_role":"manager"}', false);
select pg_temp.essai('annule est définitif', $q$update public.pi_validations set data = jsonb_set(data,'{statut}','"valide"') where id='v2'$q$, '{"role":"authenticated","app_role":"manager"}', true);
select pg_temp.essai('autres types de validation non concernés', $q$update public.pi_validations set data = jsonb_set(data,'{statut}','"valide"') where id='v3'$q$, '{"role":"authenticated","app_role":"commercial"}', false);
-- robustesse
select pg_temp.essai('données absurdes sur une fiche sans attestation validée : pas d''incident bloquant', $q$update public.pi_clients set data = '{"attestation_solde":"texte"}' where id='cy'$q$, '{"role":"authenticated","app_role":"admin"}', false);
select pg_temp.essai('écraser une attestation validée par n''importe quoi : refusé', $q$update public.pi_clients set data = '{"attestation_solde":"texte"}' where id='c1'$q$, '{"role":"authenticated","app_role":"admin"}', true);

-- ═══ REVUE OPUS 26/11/2026 ═══
insert into public.pi_clients values ('c6', '{"nom":"F","attestation_solde":{"numero":"ATS-2026-0006","statut":"valide","valide_par":"DG","valide_le":"2026-11-01","prix":1000,"verse":1000,"html":"<p>X</p>","visa_historique":[{"par":"a"}]}}');
-- C2 : visa sans rôle
select pg_temp.essai('C2 visa : un agent ne peut pas réécrire le texte avec une fausse entrée de visa', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde,html}','"<p>FAUX</p>"'),'{attestation_solde,visa_historique}','[{"par":"x"},{"par":"y"}]') where id='c6'$q$, '{"role":"anon"}', true);
select pg_temp.essai('C2 visa : un commercial non plus', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde,html}','"<p>FAUX</p>"'),'{attestation_solde,visa_historique}','[{"par":"x"},{"par":"y"}]') where id='c6'$q$, '{"role":"authenticated","app_role":"commercial"}', true);
select pg_temp.essai('C2 : visa_historique ne raccourcit pas', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,visa_historique}','[]') where id='c6'$q$, '{"role":"authenticated","app_role":"admin"}', true);
-- C3 : valeurs « vraies »
select pg_temp.essai('C3 publie_portail: 1 refusé pour un agent', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,publie_portail}','1') where id='c4'$q$, '{"role":"authenticated","app_role":"commercial"}', true);
select pg_temp.essai('C3 publie_portail: "oui" refusé pour un agent', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,publie_portail}','"oui"') where id='c6'$q$, '{"role":"authenticated","app_role":"commercial"}', true);
-- C4 : changement de type
select pg_temp.essai('C4 changer le type d''une validation d''attestation refusé', $q$update public.pi_validations set data = jsonb_set(data,'{type}','"autre"') where id='v2'$q$, '{"role":"authenticated","app_role":"manager"}', true);
select pg_temp.essai('C4 faire passer une validation ordinaire en attestation_solde refusé', $q$update public.pi_validations set data = jsonb_set(data,'{type}','"attestation_solde"') where id='v3'$q$, '{"role":"authenticated","app_role":"manager"}', true);
-- C6 : fonction SECURITY DEFINER appelée par l'API
create or replace function public.pg_test_definer() returns void language sql security definer as $$ update public.pi_clients set data = jsonb_set(data,'{attestation_solde,prix}','7') where id='c6' $$;
grant execute on function public.pg_test_definer() to agent_app;
select pg_temp.essai('C6 une RPC SECURITY DEFINER n''échappe pas à la garde', $q$select public.pg_test_definer()$q$, '{"role":"anon"}', true);
-- C7 : partage notaire
select pg_temp.essai('C7 notaire_intervenant_id figé pour un agent', $q$update public.pi_clients set data = jsonb_set(data,'{notaire_intervenant_id}','"autre"') where id='c6'$q$, '{"role":"authenticated","app_role":"commercial"}', true);
-- E3 : suppression
select pg_temp.essai('E3 suppression d''une fiche avec attestation validée refusée (même admin)', $q$delete from public.pi_clients where id='c6'$q$, '{"role":"authenticated","app_role":"admin"}', true);
select pg_temp.essai('E3 suppression d''une décision prise refusée', $q$delete from public.pi_validations where id='v1'$q$, '{"role":"authenticated","app_role":"admin"}', true);
select pg_temp.essai('E3 suppression d''une fiche ordinaire permise', $q$delete from public.pi_clients where id='cy'$q$, '{"role":"authenticated","app_role":"commercial"}', false);
-- E4 : numéro obligatoire, registre, réutilisation
insert into public.pi_clients values ('c5', '{"attestation_solde":{"statut":"en_attente","prix":1,"verse":1}}');
select pg_temp.essai('E4 validation sans numéro refusée', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,statut}','"valide"') where id='c5'$q$, '{"role":"authenticated","app_role":"manager"}', true);
select pg_temp.essai('E4 numéro d''une attestation annulée non réutilisable', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde,numero}','"ATS-2026-0002"'),'{attestation_solde,statut}','"valide"') where id='c5'$q$, '{"role":"authenticated","app_role":"manager"}', true);
select pg_temp.essai('E4 l''attestation initiale et la finale partagent le registre', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde_finale}','{"numero":"ATS-2026-0001","statut":"valide"}'::jsonb),'{x}','1') where id='c5'$q$, '{"role":"authenticated","app_role":"manager"}', true);
-- E6 : sceau serveur
select pg_temp.essai('E6 validation par un manager', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde,numero}','"ATS-2026-0555"'),'{attestation_solde,statut}','"valide"') where id='c5'$q$, '{"role":"authenticated","app_role":"manager","login":"dg1","sub":"u1"}', false);
do $$ begin
  if (select data -> 'attestation_solde' ->> 'valide_par_serveur' from public.pi_clients where id = 'c5') is distinct from 'dg1' then raise exception 'ÉCHEC E6 : identité serveur non apposée'; end if;
  if (select data -> 'attestation_solde' ->> 'valide_le_serveur' from public.pi_clients where id = 'c5') is null then raise exception 'ÉCHEC E6 : date serveur non apposée'; end if;
  raise notice 'ok  — E6 identité et date du serveur apposées';
end $$;
select pg_temp.essai('E6 valide_par_serveur est immuable', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,valide_par_serveur}','"autre"') where id='c5'$q$, '{"role":"authenticated","app_role":"admin"}', true);
-- F1 : rôle personnalisé
insert into attestation_garde.roles_autorises values ('dg');
select pg_temp.essai('F1 un rôle personnalisé ajouté à la table peut publier', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,publie_portail}','true') where id='c5'$q$, '{"role":"authenticated","app_role":"dg"}', false);
-- F4 : comparaison numérique
select pg_temp.essai('F4 prix "1000" = 1000 : pas de fausse alerte', $q$update public.pi_clients set data = jsonb_set(data,'{attestation_solde,prix}','"1"') where id='c5'$q$, '{"role":"authenticated","app_role":"admin"}', false);
-- E1 : incident interne en mode bloque
alter table public.pi_clients disable trigger zz_attestation_garde_clients;
alter table public.pi_clients enable trigger zz_attestation_garde_clients;
create or replace function attestation_garde.reserver_numero(p_table text, p_id text, p_cle text, p_numero text) returns boolean language plpgsql security definer set search_path = '' as $$ begin raise exception 'panne simulée'; end $$;
select pg_temp.essai('E1 incident interne + attestation sensible : refus par prudence', $q$update public.pi_clients set data = jsonb_set(jsonb_set(data,'{attestation_solde,numero}','"ATS-2026-0777"'),'{attestation_solde,statut}','"valide"') where id='c3'$q$, '{"role":"authenticated","app_role":"manager"}', true);
select pg_temp.essai('E1 incident interne + écriture ordinaire : passe', $q$update public.pi_clients set data = jsonb_set(data,'{nom}','"Z"') where id='c1'$q$, '{"role":"authenticated","app_role":"commercial"}', false);
-- C1 : pi_users
insert into public.pi_users (id, login, role, statut, actif, password_hash, salt) values ('u1', 'ag1', 'commercial', 'actif', true, 'h', 's'), ('u2', 'ad1', 'admin', 'actif', true, 'h', 's');
select pg_temp.essai('C1 anon ne crée pas de compte admin', $q$insert into public.pi_users (id, login, role, statut, actif, password) values ('u9','x','admin','actif',true,'y')$q$, '{"role":"anon"}', true);
select pg_temp.essai('C1 un agent ne s''attribue pas le rôle admin', $q$update public.pi_users set role = 'admin' where id = 'u1'$q$, '{"role":"authenticated","app_role":"commercial","sub":"u1"}', true);
select pg_temp.essai('C1 un agent ne change pas le mot de passe d''un autre', $q$update public.pi_users set password_hash = 'z' where id = 'u2'$q$, '{"role":"authenticated","app_role":"commercial","sub":"u1"}', true);
select pg_temp.essai('C1 un agent change son propre mot de passe', $q$update public.pi_users set password_hash = 'z' where id = 'u1'$q$, '{"role":"authenticated","app_role":"commercial","sub":"u1"}', false);
select pg_temp.essai('C1 un admin gère les comptes', $q$update public.pi_users set role = 'manager' where id = 'u1'$q$, '{"role":"authenticated","app_role":"admin","sub":"u2"}', false);
select pg_temp.essai('C1 staff-login (service_role) met à jour la connexion', $q$update public.pi_users set derniere_connexion = now(), password_hash = 'n' where id = 'u1'$q$, '{"role":"service_role"}', false);
select pg_temp.essai('C1 la dernière connexion reste libre', $q$update public.pi_users set derniere_connexion = now() where id = 'u2'$q$, '{"role":"authenticated","app_role":"commercial","sub":"u1"}', false);
-- C5 : pull_incremental restreint
create function pg_temp.pull(p_claims text) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform set_config('request.jwt.claims', p_claims, true);
  execute 'set local session authorization agent_app';
  select attestation_garde.pull_autorise() into r;
  execute 'reset session authorization';
  return r;
end $$;
do $$ begin
  if not pg_temp.pull('{"role":"anon"}') then raise exception 'ÉCHEC C5 : anon refusé avant activation'; end if;
  update attestation_garde.config set pull_restreint = true;
  if pg_temp.pull('{"role":"anon"}') then raise exception 'ÉCHEC C5 : anon accepté'; end if;
  if pg_temp.pull('{"role":"authenticated","kind":"souscripteur","scope_id":"c1"}') then raise exception 'ÉCHEC C5 : jeton portail accepté'; end if;
  if not pg_temp.pull('{"role":"authenticated","app_role":"commercial"}') then raise exception 'ÉCHEC C5 : personnel refusé'; end if;
  if not pg_temp.pull('{"role":"service_role"}') then raise exception 'ÉCHEC C5 : service_role refusé'; end if;
  update attestation_garde.config set pull_restreint = false;
  raise notice 'ok  — C5 pull_incremental : anon et jeton portail refusés, personnel accepté';
end $$;
do $$ begin
  raise notice 'journal : % lignes, dont % incident(s) interne(s)', (select count(*) from attestation_garde.journal), (select count(*) from attestation_garde.journal where mode = 'erreur');
end $$;
\echo TOUS LES TESTS SONT PASSÉS
