-- Arc-en-Ciel Connect — V1 · 003 Gouvernance : réunions, PV versionnés, décisions, annonces, notifications, documents

create table app.meetings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  type text not null check (type in ('bureau','commission','ag_ordinaire','ag_extraordinaire','information','chantier','communautaire')),
  titre text not null,
  date_heure timestamptz not null,
  lieu text,
  ordre_du_jour text,
  convoquee boolean not null default false,
  cree_par uuid default auth.uid()
);
create table app.meeting_attendees (
  meeting_id uuid not null references app.meetings(id) on delete cascade,
  member_id uuid not null references app.members(id),
  statut text not null default 'convoque' check (statut in ('convoque','confirme','excuse','present','represente')),
  primary key (meeting_id, member_id)
);

-- Un PV : versions successives ; une version validée ou publiée ne change plus.
create table app.minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references app.meetings(id),
  version int not null check (version >= 1),
  contenu text not null,
  quorum_atteint boolean,
  statut text not null default 'brouillon' check (statut in ('brouillon','valide','publie')),
  redige_par uuid default auth.uid(),
  cree_le timestamptz not null default now(),
  unique (meeting_id, version)
);
create or replace function app.minutes_garde() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'PV non supprimable.' using errcode='42501'; end if;
  if old.statut = 'publie' then raise exception 'PV publié : créer une nouvelle version.' using errcode='42501'; end if;
  if old.statut = 'valide' and new.statut <> 'publie' then raise exception 'PV validé : seule la publication est possible.' using errcode='42501'; end if;
  if old.statut = 'valide' and (new.contenu is distinct from old.contenu) then raise exception 'PV validé : contenu figé.' using errcode='42501'; end if;
  return new;
end $$;
create trigger minutes_garde before update or delete on app.minutes for each row execute function app.minutes_garde();

create table app.resolutions (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  meeting_id uuid references app.meetings(id),
  organe text not null,
  sujet text not null,
  texte text not null,
  responsable text,
  echeance date,
  budget numeric(14,0),
  statut text not null default 'a_faire' check (statut in ('a_faire','en_cours','execute','bloque','annule')),
  cree_le timestamptz not null default now()
);

create table app.announcements (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  corps text not null,
  categorie text not null default 'officielle' check (categorie in ('officielle','finance','convocation','travaux','securite','solidarite','projet')),
  publie_le timestamptz not null default now(),
  expire_le timestamptz,
  auteur uuid default auth.uid()
);
create table app.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references app.members(id),
  titre text not null,
  corps text,
  lien text,
  lu_le timestamptz,
  cree_le timestamptz not null default now()
);
create index on app.notifications (member_id, cree_le desc);

-- Documents : métadonnées ici, fichier dans le Storage PRIVÉ (bucket « documents »).
create table app.documents (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  categorie text not null check (categorie in ('statuts','reglement','pv','rapport','budget','facture','devis','contrat','assurance','correspondance','autre')),
  version int not null default 1,
  chemin text not null unique check (chemin !~ '\.\.' and chemin ~ '^[A-Za-z0-9_./-]+$'),
  visibilite text not null default 'bureau' check (visibilite in ('membres','bureau','controle')),
  exercice int,
  depose_par uuid default auth.uid(),
  cree_le timestamptz not null default now()
);

-- Publication des états financiers (instantané figé, visible des membres)
create table app.etats_publies (
  id uuid primary key default gen_random_uuid(),
  periode text not null,
  titre text not null,
  contenu jsonb not null,
  publie_par uuid default auth.uid(),
  publie_le timestamptz not null default now(),
  unique (periode, titre)
);
create or replace function app.publier_etat_financier(p_periode text, p_debut date, p_fin date)
returns uuid language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; c jsonb;
begin
  if not app.a_perm('finance.publier') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  select jsonb_build_object(
    'periode', p_periode, 'du', p_debut, 'au', p_fin,
    'recettes', coalesce((select sum(montant) from app.cash_movements where sens='entree' and source_type='paiement' and date_op between p_debut and p_fin
                          and not exists (select 1 from app.cash_movements x where x.contre_ecriture_de = cash_movements.id)), 0),
    'depenses', coalesce((select sum(montant) from app.cash_movements where sens='sortie' and source_type='depense' and date_op between p_debut and p_fin
                          and not exists (select 1 from app.cash_movements x where x.contre_ecriture_de = cash_movements.id)), 0),
    'appele', coalesce((select sum(montant_appele) from app.contribution_calls where echeance between p_debut and p_fin), 0),
    'impayes', coalesce((select sum(reste) from app.v_appels where echeance between p_debut and p_fin and statut <> 'paye'), 0),
    'engage_non_paye', coalesce((select sum(montant) from app.expense_requests where statut in ('soumise','approuvee')), 0),
    'tresorerie', coalesce((select sum(solde) from app.v_soldes_comptes), 0)
  ) into c;
  insert into app.etats_publies (periode, titre, contenu) values (p_periode, 'Situation financière', c)
  on conflict (periode, titre) do nothing returning id into v_id;
  if v_id is null then raise exception 'État déjà publié pour cette période (non modifiable).'; end if;
  perform app.journaliser('ETAT_PUBLIE', 'etats_publies', v_id::text, null, c);
  return v_id;
end $$;

create or replace function app.publier_pv(p_minute uuid) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if not app.a_perm('pv.publier') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  update app.minutes set statut = 'publie' where id = p_minute and statut = 'valide';
  if not found then raise exception 'Seul un PV validé peut être publié.'; end if;
  perform app.journaliser('PV_PUBLIE', 'minutes', p_minute::text, null, null);
end $$;

do $$ declare t text; begin
  foreach t in array array['meetings','minutes','resolutions','announcements','documents','etats_publies'] loop
    execute format('create trigger %I after insert or update or delete on app.%I for each row execute function app.audit_trigger()', 'aud_'||t, t);
  end loop; end $$;
