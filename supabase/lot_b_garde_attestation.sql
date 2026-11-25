-- ═══════════════════════════════════════════════════════════════════════════
-- Lot B — phase 4 : GARDE SERVEUR des transitions d'attestation de solde (script PRÉPARÉ, NON APPLIQUÉ)
--
-- Pourquoi : aujourd'hui toute personne disposant de la clé publique peut écrire « statut = valide », « publie_portail » ou
-- « transmis_notaire » dans pi_clients (politiques ouvertes). Les contrôles de rôle de l'ERP ne valent que dans le navigateur.
--
-- Ce que le script fait (triggers BEFORE INSERT/UPDATE, jamais de DELETE) :
--   pi_clients, pi_cessions_foncieres — objets data.attestation_solde / data.attestation_solde_finale
--     · passer à « valide » : seulement depuis « en_attente », par un jeton de personnel de rôle admin ou manager ;
--     · publie_portail / transmis_notaire passant à vrai : même exigence, et attestation « valide » ;
--     · une attestation « valide » est IMMUABLE (html, numéro, valideur, date, prix, versé) sauf deux chemins :
--         – annulation (retour hors « valide ») : rôle admin / manager ET une entrée de plus dans « annulations » ;
--         – visa (html / html_notaire modifiés) : une entrée de plus dans « visa_historique » ;
--     · un numéro d'attestation validée ne peut pas être porté deux fois.
--   pi_validations — types attestation_solde, attestation_solde_finale, attestation_solde_cession :
--     · « valide » / « rejete » / « annule » : rôle admin / manager ; une décision ne se rejoue pas
--       (en_attente → valide | rejete | annule ; valide → annule ; rejete et annule sont définitifs).
--   Passent toujours : le rôle service_role (Edge Functions) et les rôles d'administration de la base.
--
-- Deux modes (attestation_garde.config) :
--   'journal' (défaut) : n'empêche rien, enregistre chaque violation dans attestation_garde.journal ;
--   'bloque'           : refuse l'écriture (exception).
-- Tout incident INTERNE de la garde (bug) est consigné et l'écriture passe : la garde ne peut pas bloquer l'ERP par erreur.
--
-- Déploiement conseillé : appliquer en 'journal', laisser tourner plusieurs jours d'usage réel, lire le journal
--   (select * from attestation_garde.journal order by at desc), corriger les faux positifs, PUIS :
--   update attestation_garde.config set mode = 'bloque';
-- Retour arrière : voir le bas du fichier (drop des triggers et du schéma).
-- ═══════════════════════════════════════════════════════════════════════════
create schema if not exists attestation_garde;

create table if not exists attestation_garde.config (
  id   boolean primary key default true check (id),
  mode text not null default 'journal' check (mode in ('journal', 'bloque'))
);
insert into attestation_garde.config (id) values (true) on conflict do nothing;

create table if not exists attestation_garde.journal (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  table_nom text not null,
  ligne_id  text,
  role_app  text,
  mode      text,
  violation text not null,
  detail    jsonb
);
alter table attestation_garde.config  enable row level security;
alter table attestation_garde.journal enable row level security;   -- aucune politique : réservé au rôle propriétaire / service_role


-- Accès internes (SECURITY DEFINER) : le journal, la config et la recherche d'un numéro ne dépendent PAS des droits de l'appelant
-- (anon / jeton portail n'ont aucun droit sur ces objets). Le contrôle de rôle, lui, reste en SECURITY INVOKER
-- (current_user doit rester celui de l'appelant).
create or replace function attestation_garde.mode() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select mode from attestation_garde.config where id), 'journal')
$$;
create or replace function attestation_garde.consigner(p_table text, p_ligne text, p_mode text, p_violation text, p_detail jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into attestation_garde.journal (table_nom, ligne_id, role_app, mode, violation, detail)
  values (p_table, p_ligne, auth.jwt() ->> 'app_role', p_mode, p_violation, p_detail)
$$;
create or replace function attestation_garde.numero_pris(p_table text, p_id text, p_cle text, p_numero text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare r boolean;
begin
  execute format('select exists (select 1 from public.%I c where c.id <> $1 and c.data -> $2 ->> ''numero'' = $3 and c.data -> $2 ->> ''statut'' = ''valide'')', p_table)
    into r using p_id, p_cle, p_numero;
  return coalesce(r, false);
end $$;

create or replace function attestation_garde.ligne_existe(p_table text, p_id text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare r boolean;
begin
  execute format('select exists (select 1 from public.%I where id = $1)', p_table) into r using p_id;
  return coalesce(r, false);
end $$;

-- Rôle autorisé à valider / diffuser : jeton du personnel avec app_role admin ou manager, ou service_role / administration.
create or replace function attestation_garde.est_autorise() returns boolean
language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role'
      or current_user in ('postgres', 'supabase_admin')
      or coalesce(auth.jwt() ->> 'app_role', '') in ('admin', 'manager')
$$;

create or replace function attestation_garde.violations_attestation(o jsonb, n jsonb) returns text[]
language plpgsql stable as $$
declare
  v text[] := '{}';
  os text := coalesce(o ->> 'statut', '');
  ns text := coalesce(n ->> 'statut', '');
  ok boolean := attestation_garde.est_autorise();
  k text;
  visa boolean := false;
begin
  if n is null or jsonb_typeof(n) <> 'object' then
    if os = 'valide' then v := array_append(v, 'suppression d''une attestation validée'); end if;
    return v;
  end if;
  if ns = 'valide' and os <> 'valide' then
    if o is not null and os <> 'en_attente' then v := array_append(v, ('validation depuis le statut « ' || os || ' »')); end if;
    if not ok then v := array_append(v, 'validation sans rôle admin / manager'); end if;
  end if;
  if coalesce(n ->> 'publie_portail', '') = 'true' and coalesce(o ->> 'publie_portail', '') <> 'true' then
    if not ok then v := array_append(v, 'publication au portail sans rôle admin / manager'); end if;
    if ns <> 'valide' then v := array_append(v, 'publication d''une attestation non validée'); end if;
  end if;
  if coalesce(n ->> 'transmis_notaire', '') = 'true' and coalesce(o ->> 'transmis_notaire', '') <> 'true' then
    if not ok then v := array_append(v, 'transmission au notaire sans rôle admin / manager'); end if;
    if ns <> 'valide' then v := array_append(v, 'transmission d''une attestation non validée'); end if;
  end if;
  if os = 'valide' and ns = 'valide' then
    foreach k in array array['numero', 'valide_par', 'valide_le', 'date_emission', 'prix', 'verse'] loop
      if (o -> k) is distinct from (n -> k) then v := array_append(v, ('modification de « ' || k || ' » d''une attestation validée')); end if;
    end loop;
    visa := coalesce(jsonb_typeof(n -> 'visa_historique') = 'array'
        and jsonb_array_length(n -> 'visa_historique') > coalesce(jsonb_array_length(case when jsonb_typeof(o -> 'visa_historique') = 'array' then o -> 'visa_historique' end), 0), false);
    if (o -> 'html') is distinct from (n -> 'html') and not visa then
      v := array_append(v, 'modification du texte d''une attestation validée hors visa');
    end if;
    -- le texte notaire est (re)généré à la transmission (droit de diffuser) ; le retirer reste permis à tous (obsolescence automatique)
    if (n ->> 'html_notaire') is not null and (o -> 'html_notaire') is distinct from (n -> 'html_notaire') and not visa and not ok then
      v := array_append(v, 'texte transmis au notaire modifié sans rôle admin / manager');
    end if;
  end if;
  if os = 'valide' and ns <> 'valide' then
    if not ok then v := array_append(v, 'annulation de validation sans rôle admin / manager'); end if;
    if not coalesce(jsonb_typeof(n -> 'annulations') = 'array'
            and jsonb_array_length(n -> 'annulations') > coalesce(jsonb_array_length(case when jsonb_typeof(o -> 'annulations') = 'array' then o -> 'annulations' end), 0), false) then
      v := array_append(v, 'annulation sans trace (« annulations » inchangé)');
    end if;
  end if;
  return v;
end $$;

create or replace function attestation_garde.trg_donnees() returns trigger
language plpgsql as $$
declare
  cle text; o jsonb; n jsonb; v text[]; m text; x text; num text; refus boolean := false;
begin
  begin
    if tg_op = 'INSERT' and attestation_garde.ligne_existe(tg_table_name, new.id) then return new; end if;   -- upsert : contrôlé par le trigger UPDATE
    m := attestation_garde.mode();
    foreach cle in array array['attestation_solde', 'attestation_solde_finale'] loop
      if tg_op = 'INSERT' then o := null; else o := old.data -> cle; end if;
      n := new.data -> cle;
      if n is null and o is null then continue; end if;
      v := attestation_garde.violations_attestation(o, n);
      -- unicité du numéro d'une attestation validée
      num := n ->> 'numero';
      if coalesce(n ->> 'statut', '') = 'valide' and coalesce(o ->> 'statut', '') <> 'valide' and coalesce(num, '') <> '' then
        if attestation_garde.numero_pris('pi_clients', new.id, cle, num) then
          v := array_append(v, ('numéro « ' || num || ' » déjà porté par une autre attestation validée'));
        end if;
      end if;
      foreach x in array v loop
        perform attestation_garde.consigner(tg_table_name, new.id, m, x, jsonb_build_object('objet', cle, 'avant', o ->> 'statut', 'apres', n ->> 'statut'));
      end loop;
      if m = 'bloque' and coalesce(array_length(v, 1), 0) > 0 then
        refus := true;
        raise exception 'Attestation de solde : % (écriture refusée par la garde serveur)', v[1] using errcode = '42501';
      end if;
    end loop;
  exception when others then
    if refus then raise; end if;   -- refus délibéré du mode « bloque » ; tout autre incident (y compris un droit manquant) est consigné et l'écriture passe
    -- incident interne de la garde : consigné, l'écriture passe (la garde ne doit jamais bloquer l'ERP par erreur)
    begin
      perform attestation_garde.consigner(tg_table_name, new.id, 'erreur', 'incident interne de la garde', jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm));
    exception when others then null;
    end;
  end;
  return new;
end $$;

create or replace function attestation_garde.trg_cessions() returns trigger
language plpgsql as $$
declare
  o jsonb; n jsonb; v text[]; m text; x text; num text; refus boolean := false;
begin
  begin
    if tg_op = 'INSERT' and attestation_garde.ligne_existe(tg_table_name, new.id) then return new; end if;   -- upsert : contrôlé par le trigger UPDATE
    m := attestation_garde.mode();
    if tg_op = 'INSERT' then o := null; else o := old.data -> 'attestation_solde'; end if;
    n := new.data -> 'attestation_solde';
    if n is null and o is null then return new; end if;
    v := attestation_garde.violations_attestation(o, n);
    num := n ->> 'numero';
    if coalesce(n ->> 'statut', '') = 'valide' and coalesce(o ->> 'statut', '') <> 'valide' and coalesce(num, '') <> '' then
      if attestation_garde.numero_pris('pi_cessions_foncieres', new.id, 'attestation_solde', num) then
        v := array_append(v, ('numéro « ' || num || ' » déjà porté par une autre attestation validée'));
      end if;
    end if;
    foreach x in array v loop
      perform attestation_garde.consigner(tg_table_name, new.id, m, x, jsonb_build_object('avant', o ->> 'statut', 'apres', n ->> 'statut'));
    end loop;
    if m = 'bloque' and coalesce(array_length(v, 1), 0) > 0 then
      refus := true;
      raise exception 'Attestation de solde : % (écriture refusée par la garde serveur)', v[1] using errcode = '42501';
    end if;
  exception when others then
    if refus then raise; end if;   -- refus délibéré du mode « bloque » ; tout autre incident (y compris un droit manquant) est consigné et l'écriture passe
    begin
      perform attestation_garde.consigner(tg_table_name, new.id, 'erreur', 'incident interne de la garde', jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm));
    exception when others then null;
    end;
  end;
  return new;
end $$;

create or replace function attestation_garde.trg_validations() returns trigger
language plpgsql as $$
declare
  o text; n text; t text; m text; v text[] := '{}'; x text; refus boolean := false;
begin
  begin
    if tg_op = 'INSERT' and attestation_garde.ligne_existe(tg_table_name, new.id) then return new; end if;   -- upsert : contrôlé par le trigger UPDATE
    t := coalesce(new.data ->> 'type', '');
    if t not in ('attestation_solde', 'attestation_solde_finale', 'attestation_solde_cession') then return new; end if;
    m := attestation_garde.mode();
    n := coalesce(new.data ->> 'statut', '');
    o := case when tg_op = 'INSERT' then '' else coalesce(old.data ->> 'statut', '') end;
    if n <> o then
      if n in ('valide', 'rejete', 'annule') and not attestation_garde.est_autorise() then v := array_append(v, ('décision « ' || n || ' » sans rôle admin / manager')); end if;
      if o = 'valide' and n <> 'annule' then v := array_append(v, ('validation « valide » devenue « ' || n || ' » (seule l''annulation est permise)')); end if;
      if o in ('rejete', 'annule') then v := array_append(v, ('décision « ' || o || ' » définitive modifiée en « ' || n || ' »')); end if;
    end if;
    foreach x in array v loop
      perform attestation_garde.consigner(tg_table_name, new.id, m, x, jsonb_build_object('type', t, 'avant', o, 'apres', n));
    end loop;
    if m = 'bloque' and coalesce(array_length(v, 1), 0) > 0 then
      refus := true;
      raise exception 'Validation d''attestation : % (écriture refusée par la garde serveur)', v[1] using errcode = '42501';
    end if;
  exception when others then
    if refus then raise; end if;   -- refus délibéré du mode « bloque » ; tout autre incident (y compris un droit manquant) est consigné et l'écriture passe
    begin
      perform attestation_garde.consigner(tg_table_name, new.id, 'erreur', 'incident interne de la garde', jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm));
    exception when others then null;
    end;
  end;
  return new;
end $$;

drop trigger if exists attestation_garde_clients on public.pi_clients;
create trigger attestation_garde_clients before insert or update on public.pi_clients
  for each row execute function attestation_garde.trg_donnees();
drop trigger if exists attestation_garde_cessions on public.pi_cessions_foncieres;
create trigger attestation_garde_cessions before insert or update on public.pi_cessions_foncieres
  for each row execute function attestation_garde.trg_cessions();
drop trigger if exists attestation_garde_validations on public.pi_validations;
create trigger attestation_garde_validations before insert or update on public.pi_validations
  for each row execute function attestation_garde.trg_validations();

-- Droits : les rôles de l'API doivent pouvoir EXÉCUTER la garde (elle tourne avec leurs droits) ; ils n'ont aucun droit sur les tables.
do $$ declare r text; begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant usage on schema attestation_garde to %I', r);
      execute format('grant execute on all functions in schema attestation_garde to %I', r);
    end if;
  end loop;
end $$;

-- ── RETOUR ARRIÈRE ────────────────────────────────────────────────────────
--   drop trigger if exists attestation_garde_clients      on public.pi_clients;
--   drop trigger if exists attestation_garde_cessions     on public.pi_cessions_foncieres;
--   drop trigger if exists attestation_garde_validations  on public.pi_validations;
--   -- (le schéma attestation_garde et son journal peuvent rester pour analyse ; sinon : drop schema attestation_garde cascade;)
