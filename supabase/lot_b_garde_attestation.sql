-- ═══════════════════════════════════════════════════════════════════════════
-- Lot B — phase 4 (v2, revue Opus du 26/11/2026) : GARDE SERVEUR des attestations de solde (PRÉPARÉ, NON APPLIQUÉ en bloque)
--
-- Pourquoi : toute personne disposant de la clé publique peut écrire « statut = valide », « publie_portail » ou « transmis_notaire »
-- dans pi_clients (politiques ouvertes). Les contrôles de rôle de l'ERP ne valent que dans le navigateur.
--
-- Triggers (zz_… : exécutés EN DERNIER parmi les BEFORE) :
--   pi_clients, pi_cessions_foncieres — data.attestation_solde / attestation_solde_finale
--     · valider : depuis « en_attente » seulement, rôle autorisé (table attestation_garde.roles_autorises : admin, manager…) ; numéro obligatoire ;
--       le serveur appose lui-même valide_par_serveur / valide_le_serveur (identité du jeton, horloge serveur) ;
--     · publie_portail / transmis_notaire : toute valeur « vraie » (true, 1, "oui"…), rôle autorisé, attestation validée ;
--     · attestation validée IMMUABLE (html, numéro, valideur, dates, prix, versé — comparaison numérique) sauf :
--         – annulation : rôle autorisé ET une entrée de plus dans « annulations » ;
--         – visa : rôle autorisé ET une entrée de plus dans « visa_historique » ; « annulations » / « visa_historique » ne raccourcissent jamais ;
--     · numéro unique, réservé dans attestation_garde.numeros (clé primaire : atomique, jamais réutilisé) ;
--     · notaire_intervenant_id / transmission_notaire figés une fois l'attestation validée (sauf rôle autorisé) ;
--     · suppression d'une fiche portant une attestation validée : refusée (conservation).
--   pi_validations (types attestation_solde, _finale, _cession) : type et ref_id immuables ; « valide » / « annule » : rôle autorisé ;
--     « rejete » : tout agent du personnel (jeton app_role) ; en_attente → valide | rejete | annule ; valide → annule | rejete (rejet de l'effet
--     refusé par l'ERP, rôle autorisé) ; rejete et annule définitifs ; suppression d'une décision prise refusée.
--   pi_users : role, statut, actif, login, scope_id, division_id, mots de passe : administrateur seulement (changement de son propre mot de passe permis).
--   Passent toujours : service_role (Edge Functions) et la connexion d'administration directe (session_user postgres / supabase_admin).
--
-- Deux modes (attestation_garde.config.mode) : 'journal' (défaut : n'empêche rien, consigne) puis 'bloque' (refuse, message « GARDE_ATTESTATION… », HTTP 400
--   → l'ERP met l'écriture en quarantaine sans geler la file). Incident INTERNE de la garde : consigné ; en mode 'bloque' l'écriture est refusée
--   seulement si elle touche une attestation validée ou en cours de validation.
--
-- Déploiement : appliquer en 'journal' ; lire le journal (select * from attestation_garde.journal order by at desc) ; ajouter les rôles personnalisés
--   légitimes (insert into attestation_garde.roles_autorises values ('dg')) ; PUIS update attestation_garde.config set mode = 'bloque'.
--   Ne passer en 'bloque' qu'APRÈS fermeture de pi_users (RLS) : sinon un compte admin peut être créé avec la clé publique.
-- Retour arrière : voir le bas du fichier.
-- ═══════════════════════════════════════════════════════════════════════════
create schema if not exists attestation_garde;

create table if not exists attestation_garde.config (
  id   boolean primary key default true check (id),
  mode text not null default 'journal' check (mode in ('journal', 'bloque'))
);
alter table attestation_garde.config add column if not exists pull_restreint boolean not null default false;   -- vague A : pull_incremental réservé au personnel
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
-- Rôles du personnel autorisés à valider / diffuser (rôles personnalisés : à ajouter ici selon le niveau voulu)
create table if not exists attestation_garde.roles_autorises (role text primary key);
insert into attestation_garde.roles_autorises (role) values ('admin'), ('manager') on conflict do nothing;
-- Registre des numéros d'attestation validée : clé primaire = unicité atomique, un numéro n'est jamais réutilisé
create table if not exists attestation_garde.numeros (
  numero text primary key, table_nom text not null, ligne_id text not null, cle text not null, at timestamptz not null default now()
);
alter table attestation_garde.config          enable row level security;
alter table attestation_garde.journal         enable row level security;
alter table attestation_garde.roles_autorises enable row level security;
alter table attestation_garde.numeros         enable row level security;   -- aucune politique : réservé au propriétaire / service_role

-- Reprise de l'existant (sans écraser)
insert into attestation_garde.numeros (numero, table_nom, ligne_id, cle)
select c.data -> k ->> 'numero', 'pi_clients', c.id, k from public.pi_clients c, unnest(array['attestation_solde', 'attestation_solde_finale']) k
 where coalesce(c.data -> k ->> 'numero', '') <> '' and coalesce(c.data -> k ->> 'statut', '') in ('valide', 'emise', 'delivre')
on conflict do nothing;
insert into attestation_garde.numeros (numero, table_nom, ligne_id, cle)
select c.data -> 'attestation_solde' ->> 'numero', 'pi_cessions_foncieres', c.id, 'attestation_solde' from public.pi_cessions_foncieres c
 where coalesce(c.data -> 'attestation_solde' ->> 'numero', '') <> '' and coalesce(c.data -> 'attestation_solde' ->> 'statut', '') in ('valide', 'emise', 'delivre')
on conflict do nothing;

-- Accès internes (SECURITY DEFINER) : indépendants des droits de l'appelant. Le contrôle de rôle reste en SECURITY INVOKER.
create or replace function attestation_garde.mode() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select mode from attestation_garde.config where id), 'journal')
$$;
create or replace function attestation_garde.consigner(p_table text, p_ligne text, p_mode text, p_violation text, p_detail jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into attestation_garde.journal (table_nom, ligne_id, role_app, mode, violation, detail)
  values (left(p_table, 60), left(p_ligne, 80), left(auth.jwt() ->> 'app_role', 60), p_mode, left(p_violation, 200),
          coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('login', left(auth.jwt() ->> 'login', 60), 'sub', left(auth.jwt() ->> 'sub', 60),
                                                                 'kind', left(auth.jwt() ->> 'kind', 30), 'role_pg', auth.jwt() ->> 'role'))
$$;
-- pull_incremental() (SECURITY DEFINER, lit toutes les tables pi_*) : réservé au personnel / service_role une fois la restriction activée
create or replace function attestation_garde.pull_autorise() returns boolean
language sql stable security definer set search_path = '' as $$
  select not coalesce((select pull_restreint from attestation_garde.config where id), false)
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or coalesce(auth.jwt() ->> 'app_role', '') <> ''
      or session_user in ('postgres', 'supabase_admin')
$$;
create or replace function attestation_garde.role_ok(p_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from attestation_garde.roles_autorises where role = p_role)
$$;
-- Réserve un numéro ; vrai si ce numéro appartient (déjà ou désormais) à cette attestation
create or replace function attestation_garde.reserver_numero(p_table text, p_id text, p_cle text, p_numero text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare r boolean;
begin
  insert into attestation_garde.numeros (numero, table_nom, ligne_id, cle) values (p_numero, p_table, p_id, p_cle) on conflict do nothing;
  select (n.table_nom = p_table and n.ligne_id = p_id and n.cle = p_cle) into r from attestation_garde.numeros n where n.numero = p_numero;
  return coalesce(r, false);
end $$;
create or replace function attestation_garde.ligne_existe(p_table text, p_id text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare r boolean;
begin
  execute format('select exists (select 1 from public.%I where id::text = $1)', p_table) into r using p_id;
  return coalesce(r, false);
end $$;

-- Administration directe (SQL editor, migrations) : session_user, PAS current_user (une fonction SECURITY DEFINER appelée par l'API reste contrôlée).
create or replace function attestation_garde.est_admin_base() returns boolean
language sql stable set search_path = '' as $$
  select session_user in ('postgres', 'supabase_admin') and coalesce(auth.jwt() ->> 'role', '') not in ('anon', 'authenticated')
$$;
create or replace function attestation_garde.est_autorise() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.role(), '') = 'service_role'
      or attestation_garde.est_admin_base()
      or attestation_garde.role_ok(coalesce(auth.jwt() ->> 'app_role', ''))
$$;
create or replace function attestation_garde.est_personnel() returns boolean
language sql stable set search_path = '' as $$
  select attestation_garde.est_autorise() or coalesce(auth.jwt() ->> 'app_role', '') <> ''
$$;
-- Valeur « vraie » côté JavaScript (le portail teste if (x)) : tout sauf null, false, 0, "", "false", "0"
create or replace function attestation_garde.vrai(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select j is not null and j not in ('null'::jsonb, 'false'::jsonb, '0'::jsonb, '""'::jsonb, '"false"'::jsonb, '"0"'::jsonb)
$$;
-- Égalité numérique tolérante (1000 = "1000" = 1000.0) ; à défaut, égalité jsonb
create or replace function attestation_garde.num_egal(a jsonb, b jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if a is not distinct from b then return true; end if;
  if a is null or b is null then return false; end if;
  return (a #>> '{}')::numeric = (b #>> '{}')::numeric;
exception when others then return false;
end $$;
create or replace function attestation_garde.jour(j jsonb) returns text
language sql immutable set search_path = '' as $$ select left(coalesce(j #>> '{}', ''), 10) $$;
create or replace function attestation_garde.longueur(j jsonb) returns integer
language sql immutable set search_path = '' as $$ select case when jsonb_typeof(j) = 'array' then jsonb_array_length(j) else 0 end $$;

create or replace function attestation_garde.violations_attestation(o jsonb, n jsonb) returns text[]
language plpgsql stable set search_path = '' as $$
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
    if not ok then v := array_append(v, 'validation sans rôle autorisé'); end if;
    if coalesce(n ->> 'numero', '') = '' then v := array_append(v, 'validation sans numéro'); end if;
  end if;
  if attestation_garde.vrai(n -> 'publie_portail') and not attestation_garde.vrai(o -> 'publie_portail') then
    if not ok then v := array_append(v, 'publication au portail sans rôle autorisé'); end if;
    if ns <> 'valide' then v := array_append(v, 'publication d''une attestation non validée'); end if;
  end if;
  if attestation_garde.vrai(n -> 'transmis_notaire') and not attestation_garde.vrai(o -> 'transmis_notaire') then
    if not ok then v := array_append(v, 'transmission au notaire sans rôle autorisé'); end if;
    if ns <> 'valide' then v := array_append(v, 'transmission d''une attestation non validée'); end if;
  end if;
  if os = 'valide' and ns = 'valide' then
    foreach k in array array['numero', 'valide_par', 'valide_par_serveur', 'valide_le_serveur', 'id_demande'] loop
      if (o -> k) is distinct from (n -> k) then v := array_append(v, ('modification de « ' || k || ' » d''une attestation validée')); end if;
    end loop;
    foreach k in array array['valide_le', 'date_emission'] loop
      if attestation_garde.jour(o -> k) <> attestation_garde.jour(n -> k) then v := array_append(v, ('modification de « ' || k || ' » d''une attestation validée')); end if;
    end loop;
    foreach k in array array['prix', 'verse'] loop
      if not attestation_garde.num_egal(o -> k, n -> k) then v := array_append(v, ('modification de « ' || k || ' » d''une attestation validée')); end if;
    end loop;
    if attestation_garde.longueur(n -> 'visa_historique') < attestation_garde.longueur(o -> 'visa_historique') then
      v := array_append(v, '« visa_historique » raccourci');
    end if;
    visa := attestation_garde.longueur(n -> 'visa_historique') > attestation_garde.longueur(o -> 'visa_historique');
    if visa and not ok then v := array_append(v, 'visa sans rôle autorisé'); end if;
    if (o -> 'html') is distinct from (n -> 'html') and not (visa and ok) then
      v := array_append(v, 'modification du texte d''une attestation validée hors visa autorisé');
    end if;
    -- le texte notaire est (re)généré à la transmission (rôle autorisé) ; le retirer reste permis à tous (obsolescence automatique)
    if (n ->> 'html_notaire') is not null and (o -> 'html_notaire') is distinct from (n -> 'html_notaire') and not ok then
      v := array_append(v, 'texte transmis au notaire modifié sans rôle autorisé');
    end if;
    if attestation_garde.longueur(n -> 'annulations') < attestation_garde.longueur(o -> 'annulations') then
      v := array_append(v, '« annulations » raccourci');
    end if;
  end if;
  if os = 'valide' and ns <> 'valide' then
    if not ok then v := array_append(v, 'annulation de validation sans rôle autorisé'); end if;
    if attestation_garde.longueur(n -> 'annulations') <= attestation_garde.longueur(o -> 'annulations') then
      v := array_append(v, 'annulation sans trace (« annulations » inchangé)');
    end if;
  end if;
  return v;
end $$;

-- Une écriture est « sensible » si elle touche une attestation validée / en cours de validation (incident interne : refus en mode bloque)
create or replace function attestation_garde.sensible(o jsonb, n jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(o ->> 'statut', '') in ('valide', 'emise', 'delivre') or coalesce(n ->> 'statut', '') in ('valide', 'emise', 'delivre')
$$;

-- Corps commun : contrôle d'UNE attestation. Renvoie les violations ; réserve le numéro ; appose le sceau serveur.
create or replace function attestation_garde.controle(p_table text, p_id text, p_cle text, o jsonb, inout n jsonb, out v text[])
language plpgsql set search_path = '' as $$
declare num text := n ->> 'numero'; ns text := coalesce(n ->> 'statut', ''); os text := coalesce(o ->> 'statut', '');
begin
  v := attestation_garde.violations_attestation(o, n);
  if jsonb_typeof(n) = 'object' and ns in ('valide', 'emise', 'delivre') and os not in ('valide', 'emise', 'delivre') and coalesce(num, '') <> '' then
    if not attestation_garde.reserver_numero(p_table, p_id, p_cle, num) then
      v := array_append(v, ('numéro « ' || left(num, 40) || ' » déjà porté par une autre attestation'));
    end if;
  end if;
  if jsonb_typeof(n) = 'object' and ns = 'valide' and os <> 'valide' then   -- identité et horloge du SERVEUR (valide_par / valide_le viennent du navigateur)
    n := n || jsonb_build_object('valide_par_serveur', coalesce(auth.jwt() ->> 'login', auth.jwt() ->> 'sub', session_user), 'valide_le_serveur', now());
  end if;
end $$;

create or replace function attestation_garde.trg_donnees() returns trigger
language plpgsql set search_path = '' as $$
declare
  cle text; o jsonb; n jsonb; v text[]; m text; x text; refus boolean := false; sens boolean := false; r record;
begin
  begin
    if tg_op = 'DELETE' then
      m := attestation_garde.mode();
      foreach cle in array array['attestation_solde', 'attestation_solde_finale'] loop
        if coalesce(old.data -> cle ->> 'statut', '') = 'valide' and not attestation_garde.est_admin_base() then
          perform attestation_garde.consigner(tg_table_name, old.id::text, m, 'suppression d''une fiche portant une attestation validée', jsonb_build_object('objet', cle));
          if m = 'bloque' then refus := true; raise exception 'GARDE_ATTESTATION : suppression d''une fiche portant une attestation validée (conservation)'; end if;
        end if;
      end loop;
      return old;
    end if;
    if tg_op = 'INSERT' and attestation_garde.ligne_existe(tg_table_name, new.id::text) then return new; end if;   -- upsert : contrôlé par le trigger UPDATE
    m := attestation_garde.mode();
    foreach cle in array array['attestation_solde', 'attestation_solde_finale'] loop
      if tg_op = 'INSERT' then o := null; else o := old.data -> cle; end if;
      n := new.data -> cle;
      if n is null and o is null then continue; end if;
      sens := sens or attestation_garde.sensible(o, n);
      select * into r from attestation_garde.controle(tg_table_name::text, new.id::text, cle, o, n);
      v := r.v; n := r.n;
      if n is distinct from (new.data -> cle) and jsonb_typeof(n) = 'object' then new.data := jsonb_set(new.data, array[cle], n); end if;
      foreach x in array v loop
        perform attestation_garde.consigner(tg_table_name, new.id::text, m, x, jsonb_build_object('objet', cle, 'avant', o ->> 'statut', 'apres', n ->> 'statut'));
      end loop;
      if m = 'bloque' and coalesce(array_length(v, 1), 0) > 0 then
        refus := true;
        raise exception 'GARDE_ATTESTATION : % (écriture refusée par la garde serveur)', v[1];
      end if;
    end loop;
    -- partage notaire figé une fois l'attestation validée
    if tg_op = 'UPDATE' and not attestation_garde.est_autorise()
       and (coalesce(old.data -> 'attestation_solde' ->> 'statut', '') = 'valide' or coalesce(old.data -> 'attestation_solde_finale' ->> 'statut', '') = 'valide')
       and ((old.data -> 'notaire_intervenant_id') is distinct from (new.data -> 'notaire_intervenant_id')
         or (old.data -> 'transmission_notaire') is distinct from (new.data -> 'transmission_notaire')) then
      perform attestation_garde.consigner(tg_table_name, new.id::text, m, 'partage notaire modifié sans rôle autorisé', '{}'::jsonb);
      if m = 'bloque' then refus := true; raise exception 'GARDE_ATTESTATION : partage notaire modifié sans rôle autorisé'; end if;
    end if;
  exception when others then
    if refus then raise; end if;   -- refus délibéré du mode « bloque » ; tout autre incident est consigné
    begin
      perform attestation_garde.consigner(tg_table_name, coalesce(case when tg_op = 'DELETE' then old.id::text else new.id::text end, ''), 'erreur', 'incident interne de la garde', jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm));
    exception when others then null;
    end;
    if sens and coalesce(m, '') = 'bloque' then raise exception 'GARDE_ATTESTATION : contrôle indisponible, écriture sur une attestation refusée par prudence'; end if;
  end;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function attestation_garde.trg_cessions() returns trigger
language plpgsql set search_path = '' as $$
declare
  o jsonb; n jsonb; v text[]; m text; x text; refus boolean := false; sens boolean := false; r record;
begin
  begin
    if tg_op = 'DELETE' then
      m := attestation_garde.mode();
      if coalesce(old.data -> 'attestation_solde' ->> 'statut', '') = 'valide' and not attestation_garde.est_admin_base() then
        perform attestation_garde.consigner(tg_table_name, old.id::text, m, 'suppression d''une fiche portant une attestation validée', '{}'::jsonb);
        if m = 'bloque' then refus := true; raise exception 'GARDE_ATTESTATION : suppression d''une fiche portant une attestation validée (conservation)'; end if;
      end if;
      return old;
    end if;
    if tg_op = 'INSERT' and attestation_garde.ligne_existe(tg_table_name, new.id::text) then return new; end if;
    m := attestation_garde.mode();
    if tg_op = 'INSERT' then o := null; else o := old.data -> 'attestation_solde'; end if;
    n := new.data -> 'attestation_solde';
    if n is null and o is null then return new; end if;
    sens := attestation_garde.sensible(o, n);
    select * into r from attestation_garde.controle(tg_table_name::text, new.id::text, 'attestation_solde', o, n);
    v := r.v; n := r.n;
    if n is distinct from (new.data -> 'attestation_solde') and jsonb_typeof(n) = 'object' then new.data := jsonb_set(new.data, array['attestation_solde'], n); end if;
    foreach x in array v loop
      perform attestation_garde.consigner(tg_table_name, new.id::text, m, x, jsonb_build_object('avant', o ->> 'statut', 'apres', n ->> 'statut'));
    end loop;
    if m = 'bloque' and coalesce(array_length(v, 1), 0) > 0 then
      refus := true;
      raise exception 'GARDE_ATTESTATION : % (écriture refusée par la garde serveur)', v[1];
    end if;
  exception when others then
    if refus then raise; end if;
    begin
      perform attestation_garde.consigner(tg_table_name, coalesce(case when tg_op = 'DELETE' then old.id::text else new.id::text end, ''), 'erreur', 'incident interne de la garde', jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm));
    exception when others then null;
    end;
    if sens and coalesce(m, '') = 'bloque' then raise exception 'GARDE_ATTESTATION : contrôle indisponible, écriture sur une attestation refusée par prudence'; end if;
  end;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function attestation_garde.trg_validations() returns trigger
language plpgsql set search_path = '' as $$
declare
  o text; n text; t text; to_ text; m text; v text[] := '{}'; x text; refus boolean := false;
  tp constant text[] := array['attestation_solde', 'attestation_solde_finale', 'attestation_solde_cession'];
begin
  begin
    if tg_op = 'DELETE' then
      if coalesce(old.data ->> 'type', '') = any (tp) and coalesce(old.data ->> 'statut', '') in ('valide', 'rejete', 'annule') and not attestation_garde.est_admin_base() then
        m := attestation_garde.mode();
        perform attestation_garde.consigner(tg_table_name, old.id::text, m, 'suppression d''une décision de validation prise', jsonb_build_object('type', old.data ->> 'type', 'statut', old.data ->> 'statut'));
        if m = 'bloque' then refus := true; raise exception 'GARDE_ATTESTATION : suppression d''une décision de validation prise (conservation)'; end if;
      end if;
      return old;
    end if;
    if tg_op = 'INSERT' and attestation_garde.ligne_existe(tg_table_name, new.id::text) then return new; end if;
    t := coalesce(new.data ->> 'type', '');
    to_ := case when tg_op = 'INSERT' then t else coalesce(old.data ->> 'type', '') end;
    if not (t = any (tp) or to_ = any (tp)) then return new; end if;   -- ancien OU nouveau type concerné (changer le type n'échappe plus au contrôle)
    m := attestation_garde.mode();
    n := coalesce(new.data ->> 'statut', '');
    o := case when tg_op = 'INSERT' then '' else coalesce(old.data ->> 'statut', '') end;
    if tg_op = 'UPDATE' and (t <> to_ or (old.data -> 'ref_id') is distinct from (new.data -> 'ref_id')) then
      v := array_append(v, 'type ou référence d''une validation d''attestation modifié');
    end if;
    if n <> o then
      if n in ('valide', 'annule') and not attestation_garde.est_autorise() then v := array_append(v, ('décision « ' || n || ' » sans rôle autorisé')); end if;
      if n = 'rejete' and not attestation_garde.est_personnel() then v := array_append(v, 'rejet sans jeton du personnel'); end if;
      if o = 'valide' and n = 'rejete' and not attestation_garde.est_autorise() then v := array_append(v, 'validation « valide » repassée « rejete » sans rôle autorisé'); end if;
      if o = 'valide' and n not in ('annule', 'rejete') then v := array_append(v, ('validation « valide » devenue « ' || n || ' » (seule l''annulation est permise)')); end if;
      if o in ('rejete', 'annule') then v := array_append(v, ('décision « ' || o || ' » définitive modifiée en « ' || n || ' »')); end if;
    end if;
    foreach x in array v loop
      perform attestation_garde.consigner(tg_table_name, new.id::text, m, x, jsonb_build_object('type', t, 'avant', o, 'apres', n));
    end loop;
    if m = 'bloque' and coalesce(array_length(v, 1), 0) > 0 then
      refus := true;
      raise exception 'GARDE_ATTESTATION : % (écriture refusée par la garde serveur)', v[1];
    end if;
  exception when others then
    if refus then raise; end if;
    begin
      perform attestation_garde.consigner(tg_table_name, coalesce(case when tg_op = 'DELETE' then old.id::text else new.id::text end, ''), 'erreur', 'incident interne de la garde', jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm));
    exception when others then null;
    end;
    if coalesce(m, '') = 'bloque' and n in ('valide', 'annule') then raise exception 'GARDE_ATTESTATION : contrôle indisponible, décision refusée par prudence'; end if;
  end;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- pi_users : un compte ne devient pas administrateur (ni ne change de rôle / statut / mot de passe) sans être administrateur.
create or replace function attestation_garde.trg_users() returns trigger
language plpgsql set search_path = '' as $$
declare m text; v text[] := '{}'; x text; refus boolean := false; admin boolean; moi boolean; k text; changes text[] := '{}';
begin
  begin
    if tg_op = 'DELETE' then return old; end if;
    if tg_op = 'INSERT' and attestation_garde.ligne_existe(tg_table_name, new.id::text) then return new; end if;
    m := attestation_garde.mode();
    admin := coalesce(auth.role(), '') = 'service_role' or attestation_garde.est_admin_base() or coalesce(auth.jwt() ->> 'app_role', '') = 'admin';
    if admin then return new; end if;
    if tg_op = 'INSERT' then
      v := array_append(v, 'création d''un compte sans rôle administrateur');
    else
      foreach k in array array['role', 'statut', 'actif', 'login', 'scope_id', 'division_id'] loop
        if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then changes := array_append(changes, k); end if;
      end loop;
      moi := coalesce(auth.jwt() ->> 'sub', '') = old.id::text and coalesce(auth.jwt() ->> 'app_role', '') <> '';
      if array_length(changes, 1) > 0 then v := array_append(v, ('modification de « ' || array_to_string(changes, ', ') || ' » d''un compte sans rôle administrateur')); end if;
      foreach k in array array['password', 'password_hash', 'salt', 'pwd_algo', 'pwd_iter', 'caisse_pin_hash', 'caisse_pin_salt'] loop
        if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) and not moi then
          v := array_append(v, ('modification de « ' || k || ' » d''un autre compte sans rôle administrateur')); exit;
        end if;
      end loop;
    end if;
    foreach x in array v loop
      perform attestation_garde.consigner(tg_table_name, new.id::text, m, x, jsonb_build_object('role_cible', left(new.role, 40)));
    end loop;
    if m = 'bloque' and coalesce(array_length(v, 1), 0) > 0 then
      refus := true;
      raise exception 'GARDE_ATTESTATION : % (écriture refusée par la garde serveur)', v[1];
    end if;
  exception when others then
    if refus then raise; end if;
    begin
      perform attestation_garde.consigner(tg_table_name, coalesce(new.id::text, ''), 'erreur', 'incident interne de la garde', jsonb_build_object('sqlstate', sqlstate, 'message', sqlerrm));
    exception when others then null;
    end;
  end;
  return new;
end $$;

-- Anciens noms (v1) retirés ; nouveaux noms en « zz_ » : exécutés après les autres BEFORE (ils voient la ligne finale)
drop trigger if exists attestation_garde_clients      on public.pi_clients;
drop trigger if exists attestation_garde_cessions     on public.pi_cessions_foncieres;
drop trigger if exists attestation_garde_validations  on public.pi_validations;
drop trigger if exists zz_attestation_garde_clients     on public.pi_clients;
create trigger zz_attestation_garde_clients before insert or update or delete on public.pi_clients
  for each row execute function attestation_garde.trg_donnees();
drop trigger if exists zz_attestation_garde_cessions    on public.pi_cessions_foncieres;
create trigger zz_attestation_garde_cessions before insert or update or delete on public.pi_cessions_foncieres
  for each row execute function attestation_garde.trg_cessions();
drop trigger if exists zz_attestation_garde_validations on public.pi_validations;
create trigger zz_attestation_garde_validations before insert or update or delete on public.pi_validations
  for each row execute function attestation_garde.trg_validations();
drop trigger if exists zz_attestation_garde_users       on public.pi_users;
do $$ begin
  if to_regclass('public.pi_users') is not null then
    create trigger zz_attestation_garde_users before insert or update on public.pi_users
      for each row execute function attestation_garde.trg_users();
  end if;
end $$;

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
--   drop trigger if exists zz_attestation_garde_clients      on public.pi_clients;
--   drop trigger if exists zz_attestation_garde_cessions     on public.pi_cessions_foncieres;
--   drop trigger if exists zz_attestation_garde_validations  on public.pi_validations;
--   drop trigger if exists zz_attestation_garde_users        on public.pi_users;
--   -- (le schéma attestation_garde, son journal et le registre des numéros peuvent rester ; sinon : drop schema attestation_garde cascade;)
