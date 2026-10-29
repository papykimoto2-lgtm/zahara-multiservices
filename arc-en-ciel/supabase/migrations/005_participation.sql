-- Arc-en-Ciel Connect — V2 · 005 Participation : consultations et votes (bulletin secret, un vote par membre), idées, réclamations, incidents
-- Un sondage numérique n'est pas une assemblée générale : `consultatif` reste vrai tant que le cadre juridique n'a pas validé le vote à distance.

insert into app.permissions (code, libelle) values
 ('vote.gerer','Organiser consultations et votes'),('proposition.traiter','Traiter les idées et propositions'),
 ('reclamation.traiter','Traiter les réclamations'),('mediation.lire','Lire les dossiers de médiation confidentiels'),
 ('incident.traiter','Traiter les incidents'),('projet.gerer','Gérer les projets'),
 ('social.instruire','Instruire les demandes d''aide'),('social.valider','Valider les aides sociales'),
 ('prestataire.gerer','Gérer prestataires et devis');
insert into app.role_permissions (role_code, perm_code) values
 ('president','vote.gerer'),('president','proposition.traiter'),('president','reclamation.traiter'),('president','mediation.lire'),('president','incident.traiter'),('president','projet.gerer'),('president','social.valider'),('president','prestataire.gerer'),
 ('vice_president','proposition.traiter'),('vice_president','reclamation.traiter'),('vice_president','incident.traiter'),('vice_president','projet.gerer'),
 ('secretaire','vote.gerer'),('secretaire','proposition.traiter'),('secretaire','reclamation.traiter'),
 ('responsable_commission','incident.traiter'),('responsable_commission','projet.gerer'),
 ('commission_sociale','social.instruire'),('tresorier','prestataire.gerer');

-- ───────── Consultations et votes ─────────
create table app.consultations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  titre text not null check (length(trim(titre)) >= 3),
  description text,
  type text not null default 'consultation' check (type in ('consultation','sondage','vote_formel','priorisation')),
  options text[] not null check (cardinality(options) between 2 and 12),
  eligibles text[] not null default '{coproprietaire}',
  ouverture timestamptz not null,
  cloture timestamptz not null,
  quorum_pct numeric(5,2) not null default 0 check (quorum_pct between 0 and 100),
  majorite text not null default 'simple' check (majorite in ('simple','absolue','deux_tiers')),
  consultatif boolean not null default true,
  statut text not null default 'brouillon' check (statut in ('brouillon','ouverte','close')),
  resultat jsonb,
  cree_par uuid default auth.uid(),
  check (cloture > ouverture)
);
-- Émargement : QUI a voté (jamais pour quoi). Bulletins : POUR QUOI (jamais par qui). Le lien est rompu par construction.
create table app.emargements (
  consultation_id uuid not null references app.consultations(id),
  member_id uuid not null references app.members(id),
  le timestamptz not null default now(),
  primary key (consultation_id, member_id)
);
create table app.bulletins (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references app.consultations(id),
  choix int not null check (choix >= 0),
  recu text not null unique
);
create index on app.bulletins (consultation_id);

create or replace function app.garde_consultation() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Consultation non supprimable.' using errcode='42501'; end if;
  if old.statut = 'close' then raise exception 'Consultation close : résultat figé.' using errcode='42501'; end if;
  if old.statut = 'ouverte' and (new.options is distinct from old.options or new.eligibles is distinct from old.eligibles or new.majorite is distinct from old.majorite or new.quorum_pct is distinct from old.quorum_pct)
     then raise exception 'Consultation ouverte : règles figées.' using errcode='42501'; end if;
  if new.statut = 'close' and old.statut <> 'close' and new.resultat is null then raise exception 'Utiliser clore_consultation().' using errcode='42501'; end if;
  return new;
end $$;
create trigger consultation_garde before update or delete on app.consultations for each row execute function app.garde_consultation();
create or replace function app.bulletin_immuable() returns trigger language plpgsql as $$
begin raise exception 'Bulletin et émargement immuables.' using errcode='42501'; end $$;
create trigger bul_no_mod before update or delete on app.bulletins for each row execute function app.bulletin_immuable();
create trigger ema_no_mod before update or delete on app.emargements for each row execute function app.bulletin_immuable();

create or replace function app.ouvrir_consultation(p_id uuid) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if not app.a_perm('vote.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  update app.consultations set statut = 'ouverte' where id = p_id and statut = 'brouillon';
  if not found then raise exception 'Seule une consultation en brouillon peut être ouverte.'; end if;
end $$;

create or replace function app.voter(p_consultation uuid, p_choix int) returns text
language plpgsql security definer set search_path = app, public as $$
declare c app.consultations; m app.members; v_recu text;
begin
  select * into m from app.members where user_id = auth.uid() and actif;
  if not found then raise exception 'Seuls les membres actifs votent.' using errcode='42501'; end if;
  select * into c from app.consultations where id = p_consultation for share;
  if not found then raise exception 'Consultation inconnue.'; end if;
  if c.statut <> 'ouverte' or now() < c.ouverture or now() > c.cloture then raise exception 'Consultation non ouverte au vote.'; end if;
  if not (m.statut = any (c.eligibles)) then raise exception 'Votre statut (%) n''est pas éligible à cette consultation.', m.statut using errcode='42501'; end if;
  if p_choix is null or p_choix < 0 or p_choix >= cardinality(c.options) then raise exception 'Choix invalide.'; end if;
  insert into app.emargements (consultation_id, member_id) values (c.id, m.id);   -- 23505 si déjà voté
  v_recu := encode(sha256(convert_to(c.id::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex');
  insert into app.bulletins (consultation_id, choix, recu) values (c.id, p_choix, v_recu);
  return v_recu;
exception when unique_violation then
  if sqlerrm like '%emargements%' then raise exception 'Vous avez déjà voté.'; end if; raise;
end $$;

create or replace function app.a_vote(p_consultation uuid) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from app.emargements e join app.members m on m.id = e.member_id where e.consultation_id = p_consultation and m.user_id = auth.uid());
$$;

create or replace function app.clore_consultation(p_id uuid) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare c app.consultations; n_el int; n_v int; dec jsonb; tot int[]; i int; gagnant int := null; max_v int := -1; egalite boolean := false; adopte boolean; seuil numeric;
begin
  if not app.a_perm('vote.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  select * into c from app.consultations where id = p_id for update;
  if not found then raise exception 'Consultation inconnue.'; end if;
  if c.statut <> 'ouverte' then raise exception 'Consultation non ouverte.'; end if;
  if now() < c.cloture then raise exception 'La période de vote n''est pas terminée (clôture prévue le %).', c.cloture; end if;
  select count(*) into n_el from app.members where actif and statut = any (c.eligibles);
  select count(*) into n_v from app.bulletins where consultation_id = c.id;
  tot := array_fill(0, array[cardinality(c.options)]);
  for i in 0 .. cardinality(c.options) - 1 loop tot[i + 1] := (select count(*) from app.bulletins where consultation_id = c.id and choix = i); end loop;
  for i in 1 .. cardinality(c.options) loop
    if tot[i] > max_v then max_v := tot[i]; gagnant := i - 1; egalite := false; elsif tot[i] = max_v then egalite := true; end if;
  end loop;
  seuil := case c.majorite when 'simple' then 0 when 'absolue' then n_v / 2.0 else n_v * 2.0 / 3 end;
  adopte := n_v > 0 and not egalite and (n_v * 100.0 / greatest(n_el,1) >= c.quorum_pct)
            and (c.majorite = 'simple' or (c.majorite = 'absolue' and max_v > seuil) or (c.majorite = 'deux_tiers' and max_v >= seuil));
  dec := jsonb_build_object('electeurs', n_el, 'votants', n_v, 'participation_pct', round(n_v * 100.0 / greatest(n_el,1), 1), 'quorum_pct', c.quorum_pct,
    'quorum_atteint', n_v * 100.0 / greatest(n_el,1) >= c.quorum_pct, 'majorite', c.majorite, 'consultatif', c.consultatif,
    'options', to_jsonb(c.options), 'voix', to_jsonb(tot), 'gagnant', case when egalite then null else gagnant end, 'egalite', egalite, 'adopte', adopte,
    'recus', (select coalesce(jsonb_agg(recu order by recu), '[]') from app.bulletins where consultation_id = c.id));
  update app.consultations set statut = 'close', resultat = dec where id = c.id;
  perform app.journaliser('CONSULTATION_CLOSE', 'consultations', c.id::text, null, dec - 'recus');
  return dec;
end $$;

-- ───────── Idées et propositions ─────────
create table app.propositions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  member_id uuid not null references app.members(id),
  titre text not null check (length(trim(titre)) >= 3),
  description text not null,
  categorie text not null check (categorie in ('securite','environnement','infrastructures','solidarite','activites','finances','modernisation','economie','autre')),
  estimation numeric(14,0) check (estimation is null or estimation >= 0),
  priorite text not null default 'normale' check (priorite in ('basse','normale','haute')),
  statut text not null default 'recue' check (statut in ('recue','a_etude','acceptee','rejetee','planifiee','realisee')),
  reponse text,
  cree_le timestamptz not null default now(),
  check (statut <> 'rejetee' or length(coalesce(reponse,'')) >= 5)
);
create or replace function app.proposer(p_titre text, p_description text, p_categorie text, p_estimation numeric default null) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; m uuid := app.mon_membre();
begin
  if m is null then raise exception 'Seuls les membres actifs proposent.' using errcode='42501'; end if;
  insert into app.propositions (ref, member_id, titre, description, categorie, estimation) values (app.nouvelle_ref('IDE'), m, p_titre, p_description, p_categorie, p_estimation) returning id into v_id;
  return v_id;
end $$;
create or replace function app.traiter_proposition(p_id uuid, p_statut text, p_reponse text default null, p_priorite text default null) returns void
language plpgsql security definer set search_path = app, public as $$
declare pr app.propositions;
begin
  if not app.a_perm('proposition.traiter') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  update app.propositions set statut = p_statut, reponse = coalesce(p_reponse, reponse), priorite = coalesce(p_priorite, priorite) where id = p_id returning * into pr;
  if not found then raise exception 'Proposition inconnue.'; end if;
  insert into app.notifications (member_id, titre, corps) values (pr.member_id, 'Votre proposition « ' || pr.titre || ' » : ' || p_statut, p_reponse);
end $$;

-- ───────── Réclamations (traçables, avec réexamen) ─────────
create table app.complaints (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  member_id uuid not null references app.members(id),
  categorie text not null check (categorie in ('cotisation','depense','entretien','administratif','communication','conflit_usage','decision','autre')),
  objet text not null check (length(trim(objet)) >= 3),
  description text not null,
  confidentiel boolean not null default false,       -- médiation : réservé aux personnes expressément habilitées
  statut text not null default 'deposee' check (statut in ('deposee','affectee','en_analyse','repondue','reexamen','close')),
  affecte_a uuid references auth.users(id),
  reponse text,
  delai_cible date not null,
  cree_le timestamptz not null default now()
);
create table app.complaint_updates (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references app.complaints(id),
  auteur uuid not null default auth.uid(),
  statut text not null,
  message text,
  le timestamptz not null default now()
);
create trigger cu_no_mod before update or delete on app.complaint_updates for each row execute function app.bulletin_immuable();

create or replace function app.deposer_reclamation(p_categorie text, p_objet text, p_description text, p_confidentiel boolean default false) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; m uuid := app.mon_membre();
begin
  if m is null then raise exception 'Seuls les membres actifs déposent une réclamation.' using errcode='42501'; end if;
  insert into app.complaints (ref, member_id, categorie, objet, description, confidentiel, delai_cible)
  values (app.nouvelle_ref('REC'), m, p_categorie, p_objet, p_description, coalesce(p_confidentiel,false), current_date + 15) returning id into v_id;
  insert into app.complaint_updates (complaint_id, statut, message) values (v_id, 'deposee', 'Réclamation enregistrée (accusé de réception).');
  insert into app.notifications (member_id, titre, corps) values (m, 'Réclamation enregistrée', 'Réponse attendue avant le ' || to_char(current_date + 15, 'DD/MM/YYYY') || '.');
  return v_id;
end $$;
create or replace function app.traiter_reclamation(p_id uuid, p_statut text, p_message text, p_affecte_a uuid default null) returns void
language plpgsql security definer set search_path = app, public as $$
declare c app.complaints;
begin
  if not app.a_perm('reclamation.traiter') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if p_statut not in ('affectee','en_analyse','repondue','close') then raise exception 'Statut invalide.'; end if;
  if length(coalesce(trim(p_message),'')) < 5 then raise exception 'Message motivé obligatoire.'; end if;
  select * into c from app.complaints where id = p_id for update;
  if not found then raise exception 'Réclamation inconnue.'; end if;
  if c.confidentiel and not app.a_perm('mediation.lire') then raise exception 'Dossier de médiation réservé aux personnes habilitées.' using errcode='42501'; end if;
  if c.statut = 'close' then raise exception 'Réclamation close.'; end if;
  update app.complaints set statut = p_statut, affecte_a = coalesce(p_affecte_a, affecte_a), reponse = case when p_statut = 'repondue' then p_message else reponse end where id = p_id;
  insert into app.complaint_updates (complaint_id, statut, message) values (p_id, p_statut, p_message);
  insert into app.notifications (member_id, titre, corps) values (c.member_id, 'Réclamation ' || c.ref || ' : ' || p_statut, p_message);
end $$;
create or replace function app.demander_reexamen(p_id uuid, p_motif text) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if length(coalesce(trim(p_motif),'')) < 5 then raise exception 'Motif obligatoire.'; end if;
  update app.complaints set statut = 'reexamen', delai_cible = current_date + 15 where id = p_id and member_id = app.mon_membre() and statut = 'repondue';
  if not found then raise exception 'Réexamen impossible (réclamation inconnue, non répondue ou non la vôtre).'; end if;
  insert into app.complaint_updates (complaint_id, statut, message) values (p_id, 'reexamen', p_motif);
end $$;

-- ───────── Infrastructures et incidents ─────────
create table app.assets (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  type text not null check (type in ('lampadaire','voie','canalisation','evacuation','espace_vert','aire_jeux','local','portail','securite','autre')),
  nom text not null,
  localisation text,
  etat text not null default 'bon' check (etat in ('bon','a_surveiller','hors_service')),
  installe_le date
);
create table app.incidents (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  asset_id uuid references app.assets(id),
  categorie text not null check (categorie in ('eclairage','voirie','fuite','obstruction','depot_sauvage','degradation','securite','nuisance','autre')),
  description text not null check (length(trim(description)) >= 5),
  localisation text,
  priorite text not null default 'normale' check (priorite in ('basse','normale','haute','urgente')),
  statut text not null default 'nouveau' check (statut in ('nouveau','en_analyse','planifie','en_intervention','resolu','rejete')),
  declarant uuid not null references app.members(id),
  responsable text,
  delai_cible date,
  preuve text,
  motif_rejet text,
  signale_le timestamptz not null default now(),
  resolu_le timestamptz,
  check (statut <> 'resolu' or length(coalesce(preuve,'')) >= 3),
  check (statut <> 'rejete' or length(coalesce(motif_rejet,'')) >= 5)
);
create table app.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references app.incidents(id),
  auteur uuid not null default auth.uid(),
  statut text not null, message text, le timestamptz not null default now()
);
create trigger ie_no_mod before update or delete on app.incident_events for each row execute function app.bulletin_immuable();
-- Vue publique : la cité voit les incidents, jamais le déclarant.
create view app.v_incidents_publics as
  select id, ref, asset_id, categorie, description, localisation, priorite, statut, responsable, delai_cible, signale_le, resolu_le from app.incidents;

create or replace function app.signaler_incident(p_categorie text, p_description text, p_localisation text default null, p_asset uuid default null) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; m uuid := app.mon_membre();
begin
  if m is null then raise exception 'Seuls les membres actifs signalent un incident.' using errcode='42501'; end if;
  insert into app.incidents (ref, asset_id, categorie, description, localisation, declarant, priorite)
  values (app.nouvelle_ref('INC'), p_asset, p_categorie, p_description, p_localisation, m, case p_categorie when 'securite' then 'urgente' when 'fuite' then 'haute' else 'normale' end) returning id into v_id;
  insert into app.incident_events (incident_id, statut, message) values (v_id, 'nouveau', 'Incident signalé.');
  return v_id;
end $$;
create or replace function app.traiter_incident(p_id uuid, p_statut text, p_message text, p_priorite text default null, p_responsable text default null, p_delai date default null, p_preuve text default null) returns void
language plpgsql security definer set search_path = app, public as $$
declare i app.incidents;
begin
  if not app.a_perm('incident.traiter') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  select * into i from app.incidents where id = p_id for update;
  if not found then raise exception 'Incident inconnu.'; end if;
  if i.statut in ('resolu','rejete') then raise exception 'Incident clos.'; end if;
  if p_statut = 'resolu' and length(coalesce(trim(p_preuve),'')) < 3 then raise exception 'Preuve de résolution obligatoire.'; end if;
  if p_statut = 'rejete' and length(coalesce(trim(p_message),'')) < 5 then raise exception 'Motif de rejet obligatoire.'; end if;
  update app.incidents set statut = p_statut, priorite = coalesce(p_priorite, priorite), responsable = coalesce(p_responsable, responsable), delai_cible = coalesce(p_delai, delai_cible),
    preuve = case when p_statut = 'resolu' then p_preuve else preuve end, motif_rejet = case when p_statut = 'rejete' then p_message else motif_rejet end,
    resolu_le = case when p_statut = 'resolu' then now() else resolu_le end where id = p_id;
  insert into app.incident_events (incident_id, statut, message) values (p_id, p_statut, p_message);
  insert into app.notifications (member_id, titre, corps) values (i.declarant, 'Incident ' || i.ref || ' : ' || p_statut, p_message);
end $$;

do $$ declare t text; begin
  foreach t in array array['consultations','propositions','assets','incidents'] loop
    execute format('create trigger %I after insert or update or delete on app.%I for each row execute function app.audit_trigger()', 'aud_'||t, t);
  end loop; end $$;
