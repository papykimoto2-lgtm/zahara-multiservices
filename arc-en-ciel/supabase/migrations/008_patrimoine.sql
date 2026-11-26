-- Arc-en-Ciel Connect — V3 · 008 Patrimoine : géolocalisation, assurances et sinistres, consommations, enquêtes de satisfaction, rapprochement bancaire

insert into app.permissions (code, libelle) values
 ('assurance.gerer','Gérer assurances et sinistres'),('charges.gerer','Saisir les consommations et charges'),('enquete.gerer','Organiser les enquêtes de satisfaction');
insert into app.role_permissions (role_code, perm_code) values
 ('president','assurance.gerer'),('tresorier','assurance.gerer'),('tresorier','charges.gerer'),('tresorier_adjoint','charges.gerer'),('president','enquete.gerer'),('secretaire','enquete.gerer');

-- ───────── Géolocalisation (carte sans fond externe : aucune donnée personnelle) ─────────
alter table app.assets add column lat numeric(9,6) check (lat between -90 and 90), add column lng numeric(9,6) check (lng between -180 and 180);
alter table app.incidents add column lat numeric(9,6) check (lat between -90 and 90), add column lng numeric(9,6) check (lng between -180 and 180);
create or replace function app.positionner_actif(p_id uuid, p_lat numeric, p_lng numeric) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if not app.a_perm('incident.traiter') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Coordonnées invalides.'; end if;
  update app.assets set lat = p_lat, lng = p_lng where id = p_id;
  if not found then raise exception 'Équipement inconnu.'; end if;
end $$;
create or replace function app.positionner_incident(p_id uuid, p_lat numeric, p_lng numeric) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Coordonnées invalides.'; end if;
  update app.incidents set lat = p_lat, lng = p_lng where id = p_id and (declarant = app.mon_membre() or app.a_perm('incident.traiter'));
  if not found then raise exception 'Incident inconnu ou non autorisé.'; end if;
end $$;
-- Couche publique de la carte : équipements et incidents ouverts, jamais le déclarant ni un lot habité.
create view app.v_carte as
  select 'equipement'::text as couche, a.id, a.ref, a.nom as libelle, a.type as sous_type, a.etat as statut, a.lat, a.lng from app.assets a where a.lat is not null
  union all
  select 'incident', i.id, i.ref, left(i.description, 80), i.categorie, i.statut, i.lat, i.lng from app.incidents i where i.lat is not null and i.statut not in ('resolu','rejete');

-- ───────── Assurances et sinistres ─────────
create table app.insurance_contracts (
  id uuid primary key default gen_random_uuid(),
  assureur text not null, police text not null unique, objet text not null,
  prime_annuelle numeric(14,0) not null check (prime_annuelle >= 0),
  debut date not null, fin date not null, couverture text, document_path text,
  check (fin > debut)
);
create table app.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  contract_id uuid not null references app.insurance_contracts(id),
  asset_id uuid references app.assets(id),
  date_sinistre date not null, description text not null check (length(trim(description)) >= 5),
  montant_estime numeric(14,0) check (montant_estime is null or montant_estime >= 0),
  montant_indemnise numeric(14,0) check (montant_indemnise is null or montant_indemnise >= 0),
  statut text not null default 'declare' check (statut in ('declare','instruction','indemnise','refuse','clos')),
  motif text, cree_le timestamptz not null default now(),
  check (statut <> 'indemnise' or montant_indemnise is not null),
  check (statut <> 'refuse' or length(coalesce(motif,'')) >= 5)
);
create or replace function app.declarer_sinistre(p_contrat uuid, p_date date, p_description text, p_estime numeric default null, p_asset uuid default null) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare c app.insurance_contracts; v_id uuid;
begin
  if not app.a_perm('assurance.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  select * into c from app.insurance_contracts where id = p_contrat;
  if not found then raise exception 'Contrat inconnu.'; end if;
  if p_date < c.debut or p_date > c.fin then raise exception 'Sinistre hors période de couverture du contrat (% au %).', c.debut, c.fin; end if;
  insert into app.insurance_claims (ref, contract_id, asset_id, date_sinistre, description, montant_estime) values (app.nouvelle_ref('SIN'), p_contrat, p_asset, p_date, p_description, p_estime) returning id into v_id;
  return v_id;
end $$;
create view app.v_assurances_echeances with (security_invoker = true) as
  select id, assureur, police, objet, fin, (fin - current_date) as jours_restants,
         case when fin < current_date then 'expire' when fin - current_date <= 60 then 'a_renouveler' else 'ok' end as etat
  from app.insurance_contracts;

-- ───────── Consommations communes et évolution des charges ─────────
create table app.utility_readings (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('eau','electricite','autre')),
  compteur text not null, periode text not null check (periode ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  consommation numeric(14,2) check (consommation is null or consommation >= 0),
  montant numeric(14,0) not null check (montant >= 0),
  saisi_par uuid default auth.uid(),
  unique (type, compteur, periode)
);
create view app.v_evolution_charges with (security_invoker = true) as
select type, compteur, periode, consommation, montant,
  lag(montant) over w as montant_prec,
  case when lag(montant) over w > 0 then round((montant - lag(montant) over w) * 100.0 / lag(montant) over w, 1) end as variation_pct,
  case when lag(montant, 12) over w > 0 then round((montant - lag(montant, 12) over w) * 100.0 / lag(montant, 12) over w, 1) end as variation_an_pct,
  coalesce((lag(montant) over w > 0) and (montant > lag(montant) over w * 1.3), false) as anomalie
from app.utility_readings window w as (partition by type, compteur order by periode);

-- ───────── Enquêtes de satisfaction : anonymes, résultats agrégés (au moins 5 réponses) ─────────
create table app.surveys (
  id uuid primary key default gen_random_uuid(),
  titre text not null, themes text[] not null check (cardinality(themes) between 1 and 10),
  ouverture timestamptz not null, cloture timestamptz not null,
  statut text not null default 'brouillon' check (statut in ('brouillon','ouverte','close')),
  check (cloture > ouverture)
);
create table app.survey_emargements (survey_id uuid not null references app.surveys(id), member_id uuid not null references app.members(id), le timestamptz not null default now(), primary key (survey_id, member_id));
create table app.survey_answers (id uuid primary key default gen_random_uuid(), survey_id uuid not null references app.surveys(id), theme int not null check (theme >= 0), note int not null check (note between 1 and 5));
create trigger sa_no_mod before update or delete on app.survey_answers for each row execute function app.bulletin_immuable();
create trigger se_no_mod before update or delete on app.survey_emargements for each row execute function app.bulletin_immuable();
create or replace function app.ouvrir_enquete(p_id uuid) returns void language plpgsql security definer set search_path = app, public as $$
begin
  if not app.a_perm('enquete.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  update app.surveys set statut = 'ouverte' where id = p_id and statut = 'brouillon';
  if not found then raise exception 'Seule une enquête en brouillon peut être ouverte.'; end if;
end $$;
create or replace function app.repondre_enquete(p_id uuid, p_notes int[]) returns void
language plpgsql security definer set search_path = app, public as $$
declare s app.surveys; m uuid := app.mon_membre(); i int;
begin
  if m is null then raise exception 'Seuls les membres actifs répondent.' using errcode='42501'; end if;
  select * into s from app.surveys where id = p_id;
  if not found or s.statut <> 'ouverte' or now() < s.ouverture or now() > s.cloture then raise exception 'Enquête non ouverte.'; end if;
  if p_notes is null or cardinality(p_notes) <> cardinality(s.themes) then raise exception 'Une note par thème est attendue.'; end if;
  insert into app.survey_emargements (survey_id, member_id) values (p_id, m);
  for i in 1 .. cardinality(p_notes) loop insert into app.survey_answers (survey_id, theme, note) values (p_id, i - 1, p_notes[i]); end loop;
exception when unique_violation then raise exception 'Vous avez déjà répondu.';
end $$;
create or replace function app.resultats_enquete(p_id uuid) returns table (theme text, moyenne numeric, reponses bigint)
language plpgsql stable security definer set search_path = app, public as $$
declare s app.surveys; n bigint;
begin
  select * into s from app.surveys where id = p_id;
  if not found then raise exception 'Enquête inconnue.'; end if;
  select count(*) into n from app.survey_emargements where survey_id = p_id;
  if n < 5 then raise exception 'Résultats masqués : au moins 5 réponses sont nécessaires pour préserver l''anonymat (% reçue(s)).', n; end if;
  return query select s.themes[a.theme + 1], round(avg(a.note), 2), count(*) from app.survey_answers a where a.survey_id = p_id group by a.theme order by a.theme;
end $$;

-- ───────── Rapprochement bancaire ─────────
create table app.bank_lines (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.cash_accounts(id),
  date_op date not null, libelle text not null, montant numeric(14,0) not null check (montant <> 0),   -- signé : + crédit, − débit
  ref_externe text, movement_id uuid unique references app.cash_movements(id),
  statut text not null default 'a_rapprocher' check (statut in ('a_rapprocher','rapproche','ecart')),
  importe_par uuid default auth.uid(), unique (account_id, date_op, libelle, montant, ref_externe)
);
create or replace function app.importer_releve(p_account uuid, p_lignes jsonb) returns int
language plpgsql security definer set search_path = app, public as $$
declare n int;
begin
  if not app.a_perm('finance.encaisser') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 or jsonb_array_length(p_lignes) > 2000 then raise exception 'Relevé invalide (1 à 2000 lignes).'; end if;
  insert into app.bank_lines (account_id, date_op, libelle, montant, ref_externe)
  select p_account, (x->>'date')::date, left(x->>'libelle', 200), (x->>'montant')::numeric, nullif(left(x->>'ref', 80), '') from jsonb_array_elements(p_lignes) x on conflict do nothing;
  get diagnostics n = row_count; return n;
end $$;
create or replace function app.rapprocher(p_ligne uuid, p_mouvement uuid) returns void
language plpgsql security definer set search_path = app, public as $$
declare l app.bank_lines; m app.cash_movements; v_signe numeric;
begin
  if not app.a_perm('finance.lire') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  select * into l from app.bank_lines where id = p_ligne for update; select * into m from app.cash_movements where id = p_mouvement;
  if l.id is null or m.id is null then raise exception 'Ligne ou écriture inconnue.'; end if;
  if l.statut = 'rapproche' then raise exception 'Ligne déjà rapprochée.'; end if;
  if l.account_id <> m.account_id then raise exception 'Les deux opérations ne concernent pas le même compte.'; end if;
  v_signe := case m.sens when 'entree' then m.montant else -m.montant end;      /* hors du IF : un CASE ... THEN dans la condition tromperait l'analyseur PL/pgSQL */
  if l.montant <> v_signe then raise exception 'Montants différents (relevé %, écriture %) : signaler un écart.', l.montant, m.montant; end if;
  update app.bank_lines set movement_id = p_mouvement, statut = 'rapproche' where id = p_ligne;
  perform app.journaliser('RAPPROCHEMENT', 'bank_lines', p_ligne::text, null, jsonb_build_object('mouvement', p_mouvement));
end $$;
create or replace function app.signaler_ecart(p_ligne uuid, p_motif text) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if not app.a_perm('finance.lire') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if length(coalesce(trim(p_motif),'')) < 5 then raise exception 'Motif obligatoire.'; end if;
  update app.bank_lines set statut = 'ecart' where id = p_ligne and statut = 'a_rapprocher';
  if not found then raise exception 'Ligne inconnue ou déjà traitée.'; end if;
  perform app.journaliser('ECART_BANCAIRE', 'bank_lines', p_ligne::text, null, jsonb_build_object('motif', p_motif));
end $$;
-- Écritures du grand livre sans ligne de relevé (à rapprocher)
create view app.v_a_rapprocher with (security_invoker = true) as
  select m.id, m.ref, m.account_id, m.date_op, m.sens, m.montant from app.cash_movements m join app.cash_accounts a on a.id = m.account_id
  where a.type in ('banque','mobile_money') and not exists (select 1 from app.bank_lines b where b.movement_id = m.id) and m.contre_ecriture_de is null
    and not exists (select 1 from app.cash_movements x where x.contre_ecriture_de = m.id);

do $$ declare t text; begin
  foreach t in array array['insurance_contracts','insurance_claims','utility_readings','surveys','bank_lines'] loop
    execute format('create trigger %I after insert or update or delete on app.%I for each row execute function app.audit_trigger()', 'aud_'||t, t);
  end loop; end $$;
