-- Arc-en-Ciel Connect — V1 · 001 Noyau : identités, rôles, permissions, lots, journal d'audit
-- Sanix Africa Division Technologies. Exécuter dans un projet Supabase DÉDIÉ à la cité (jamais celui d'une autre entreprise).

create schema if not exists app;

-- ───────── Rôles et permissions ─────────
create table app.roles (
  code text primary key check (code ~ '^[a-z_]{2,40}$'),
  libelle text not null
);
create table app.permissions (
  code text primary key check (code ~ '^[a-z_]+\.[a-z_]+$'),
  libelle text not null
);
create table app.role_permissions (
  role_code text not null references app.roles(code) on delete cascade,
  perm_code text not null references app.permissions(code) on delete cascade,
  primary key (role_code, perm_code)
);

-- ───────── Membres et lots ─────────
create table app.members (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  nom text not null check (length(trim(nom)) > 0),
  prenoms text,
  telephone text check (telephone is null or telephone ~ '^\+?[0-9 ]{8,20}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  statut text not null default 'coproprietaire' check (statut in ('coproprietaire','resident','locataire','representant','autre')),
  date_adhesion date not null default current_date,
  user_id uuid unique references auth.users(id) on delete set null,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
create index on app.members (nom);

create table app.lots (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  libelle text,
  statut text not null default 'occupe' check (statut in ('occupe','vacant')),
  cree_le timestamptz not null default now()
);

create table app.lot_ownerships (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references app.lots(id),
  member_id uuid not null references app.members(id),
  lien text not null check (lien in ('proprietaire','indivisaire','locataire','resident','representant')),
  quote_part numeric(7,4) not null default 1 check (quote_part > 0 and quote_part <= 1),
  date_debut date not null default current_date,
  date_fin date,
  check (date_fin is null or date_fin >= date_debut)
);
create index on app.lot_ownerships (member_id);
create index on app.lot_ownerships (lot_id);

-- Mandats : l'historique des fonctions n'est jamais effacé (fin de mandat = date_fin).
create table app.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_code text not null references app.roles(code),
  date_debut date not null default current_date,
  date_fin date,
  accorde_par uuid references auth.users(id),
  check (date_fin is null or date_fin >= date_debut)
);
create index on app.user_roles (user_id);
create unique index user_roles_actif_uq on app.user_roles (user_id, role_code) where date_fin is null;

-- ───────── Fonctions d'autorisation (appliquées en base, jamais seulement dans l'interface) ─────────
create or replace function app.a_role(r text, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from app.user_roles ur
                 where ur.user_id = u and ur.role_code = r
                   and ur.date_debut <= current_date and (ur.date_fin is null or ur.date_fin >= current_date));
$$;

create or replace function app.a_perm(p text, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from app.user_roles ur
                 join app.role_permissions rp on rp.role_code = ur.role_code
                 where ur.user_id = u and rp.perm_code = p
                   and ur.date_debut <= current_date and (ur.date_fin is null or ur.date_fin >= current_date));
$$;

create or replace function app.mon_membre() returns uuid
language sql stable security definer set search_path = app, public as $$
  select id from app.members where user_id = auth.uid() and actif;
$$;

-- ───────── Journal d'audit : append-only, chaîné par empreintes ─────────
create table app.audit_logs (
  id bigint generated always as identity primary key,
  le timestamptz not null default clock_timestamp(),
  acteur uuid,
  action text not null,
  table_nom text not null,
  ligne_id text,
  avant jsonb,
  apres jsonb,
  empreinte_prec text,
  empreinte text not null
);
create index on app.audit_logs (table_nom, ligne_id);
create index on app.audit_logs (acteur, le desc);

create or replace function app.audit_immuable() returns trigger language plpgsql as $$
begin raise exception 'audit_logs est en ajout seul (%).', tg_op using errcode = '42501'; end $$;
create trigger audit_no_update before update or delete on app.audit_logs for each row execute function app.audit_immuable();
create trigger audit_no_truncate before truncate on app.audit_logs for each statement execute function app.audit_immuable();

create or replace function app.audit_trigger() returns trigger language plpgsql security definer set search_path = app, public as $$
declare prec text; h text; o jsonb; n jsonb; rid text;
begin
  perform pg_advisory_xact_lock(7001);                         -- sérialise la chaîne
  select empreinte into prec from app.audit_logs order by id desc limit 1;
  o := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  rid := coalesce(n->>'id', o->>'id');
  h := encode(sha256(convert_to(coalesce(prec,'') || tg_op || tg_table_name || coalesce(rid,'') || coalesce(o::text,'') || coalesce(n::text,'') || clock_timestamp()::text, 'UTF8')), 'hex');
  insert into app.audit_logs (acteur, action, table_nom, ligne_id, avant, apres, empreinte_prec, empreinte)
  values (auth.uid(), tg_op, tg_table_name, rid, o, n, prec, h);
  return coalesce(new, old);
end $$;

-- Vérifie l'intégrité de la chaîne (contrôleurs) : retourne les ruptures.
create or replace function app.verifier_chaine_audit() returns table (id bigint, motif text)
language sql stable security definer set search_path = app, public as $$
  select a.id, 'empreinte_prec incohérente'
  from (select id, empreinte_prec, lag(empreinte) over (order by id) as attendu from app.audit_logs) a
  where a.empreinte_prec is distinct from a.attendu and app.a_perm('audit.lire');
$$;

do $$ declare t text; begin
  foreach t in array array['members','lots','lot_ownerships','user_roles','roles','role_permissions'] loop
    execute format('create trigger %I after insert or update or delete on app.%I for each row execute function app.audit_trigger()', 'aud_'||t, t);
  end loop; end $$;

-- ───────── Rôles et permissions de référence (à ajuster par le comité de pilotage) ─────────
insert into app.roles (code, libelle) values
 ('admin_technique','Administrateur technique'),('president','Président'),('vice_president','Vice-président'),
 ('secretaire','Secrétaire général'),('tresorier','Trésorier'),('tresorier_adjoint','Trésorier adjoint'),
 ('second_approbateur','Second approbateur'),('responsable_commission','Responsable de commission'),
 ('controleur','Contrôleur financier'),('commission_sociale','Commission sociale'),('membre','Membre');

insert into app.permissions (code, libelle) values
 ('membres.gerer','Gérer membres et lots'),('droits.gerer','Attribuer les rôles'),
 ('finance.lire','Lire toute la trésorerie'),('finance.encaisser','Enregistrer les encaissements'),
 ('finance.annuler','Annuler / contrepasser une opération'),('finance.publier','Publier les états financiers'),
 ('cotisations.gerer','Créer les campagnes et appels de cotisation'),
 ('budget.gerer','Gérer les budgets'),
 ('depense.creer','Créer une demande de dépense'),('depense.approuver','Approuver une dépense'),('depense.payer','Payer une dépense'),
 ('regles.gerer','Modifier les seuils de validation'),
 ('reunion.gerer','Gérer réunions, PV et décisions'),('pv.publier','Publier un procès-verbal'),
 ('annonce.publier','Publier une annonce'),('document.gerer','Gérer les documents'),
 ('audit.lire','Lire le journal d''audit');

insert into app.role_permissions (role_code, perm_code) values
 ('admin_technique','membres.gerer'),('admin_technique','droits.gerer'),
 ('president','finance.lire'),('president','finance.publier'),('president','depense.creer'),('president','depense.approuver'),('president','regles.gerer'),('president','reunion.gerer'),('president','pv.publier'),('president','annonce.publier'),('president','cotisations.gerer'),('president','budget.gerer'),('president','membres.gerer'),('president','droits.gerer'),
 ('vice_president','finance.lire'),('vice_president','depense.creer'),('vice_president','depense.approuver'),
 ('secretaire','membres.gerer'),('secretaire','reunion.gerer'),('secretaire','pv.publier'),('secretaire','annonce.publier'),('secretaire','document.gerer'),
 ('tresorier','finance.lire'),('tresorier','finance.encaisser'),('tresorier','finance.annuler'),('tresorier','finance.publier'),('tresorier','cotisations.gerer'),('tresorier','budget.gerer'),('tresorier','depense.creer'),('tresorier','depense.approuver'),('tresorier','depense.payer'),
 ('tresorier_adjoint','finance.lire'),('tresorier_adjoint','finance.encaisser'),('tresorier_adjoint','depense.creer'),
 ('second_approbateur','depense.approuver'),('second_approbateur','finance.lire'),
 ('responsable_commission','depense.creer'),('responsable_commission','depense.approuver'),
 ('controleur','finance.lire'),('controleur','audit.lire'),
 ('commission_sociale','depense.creer');
