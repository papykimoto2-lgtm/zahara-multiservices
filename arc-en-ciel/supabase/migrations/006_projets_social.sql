-- Arc-en-Ciel Connect — V2 · 006 Projets, prestataires et devis, solidarité, bilan trimestriel, alertes de contrôle

-- ───────── Projets ─────────
create table app.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  intitule text not null check (length(trim(intitule)) >= 3),
  probleme text, objectifs text, beneficiaires text,
  horizon text not null check (horizon in ('court','moyen','long')),
  priorite text not null default 'normale' check (priorite in ('basse','normale','haute')),
  cout_estime numeric(14,0) not null check (cout_estime >= 0),
  financement text,
  responsable text,
  debut date, fin_prevue date,
  statut text not null default 'idee' check (statut in ('idee','etude','autorise','en_cours','termine','suspendu','abandonne')),
  decision_ref text,
  avancement int not null default 0 check (avancement between 0 and 100),
  bilan text,
  cree_le timestamptz not null default now(),
  check (fin_prevue is null or debut is null or fin_prevue >= debut)
);
create table app.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app.projects(id),
  libelle text not null, echeance date, fait boolean not null default false, preuve text
);
alter table app.expense_requests add column project_id uuid references app.projects(id);
create or replace function app.garde_projet() returns trigger language plpgsql as $$
begin
  if new.statut in ('autorise','en_cours','termine') and length(coalesce(trim(new.decision_ref),'')) < 3 then
    raise exception 'Décision autorisant le projet obligatoire (référence).' using errcode='23514'; end if;
  if new.statut = 'termine' and (new.avancement < 100 or length(coalesce(trim(new.bilan),'')) < 5) then
    raise exception 'Un projet terminé exige 100 %% d''avancement et un bilan.' using errcode='23514'; end if;
  return new;
end $$;
create trigger projet_garde before insert or update on app.projects for each row execute function app.garde_projet();

create or replace function app.lier_depense_projet(p_depense uuid, p_projet uuid) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if not app.a_perm('projet.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  update app.expense_requests set project_id = p_projet where id = p_depense and project_id is null;
  if not found then raise exception 'Dépense inconnue ou déjà rattachée à un projet.'; end if;
  perform app.journaliser('DEPENSE_PROJET', 'expense_requests', p_depense::text, null, jsonb_build_object('projet', p_projet));
end $$;

create view app.v_projets with (security_invoker = true) as
select p.*,
  coalesce(sum(e.montant) filter (where e.statut in ('soumise','approuvee')), 0) as engage,
  coalesce(sum(e.montant) filter (where e.statut = 'payee'), 0) as paye,
  coalesce(sum(e.montant) filter (where e.statut in ('soumise','approuvee','payee')), 0) > p.cout_estime as depassement,
  (p.fin_prevue is not null and p.fin_prevue < current_date and p.statut not in ('termine','abandonne')) as en_retard
from app.projects p left join app.expense_requests e on e.project_id = p.id
group by p.id;

-- ───────── Prestataires et devis ─────────
create table app.suppliers (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique, activite text, contact text, actif boolean not null default true
);
create table app.parametres (cle text primary key, valeur numeric not null);
insert into app.parametres values ('devis_seuil', 100000), ('devis_min', 3);   -- illustratif : à adopter par le comité
create table app.quotes (
  id uuid primary key default gen_random_uuid(),
  dossier text not null,                       -- objet de la consultation (ex. « Éclairage voie principale »)
  supplier_id uuid not null references app.suppliers(id),
  montant numeric(14,0) not null check (montant > 0),
  delai_jours int, garantie text, conditions text,
  retenu boolean not null default false, justification text, decision_ref text,
  cree_le timestamptz not null default now(),
  unique (dossier, supplier_id)
);
create or replace function app.retenir_devis(p_devis uuid, p_justification text, p_decision_ref text default null) returns void
language plpgsql security definer set search_path = app, public as $$
declare q app.quotes; n int; seuil numeric; mini int;
begin
  if not app.a_perm('prestataire.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if length(coalesce(trim(p_justification),'')) < 5 then raise exception 'Justification du choix obligatoire.'; end if;
  select * into q from app.quotes where id = p_devis for update;
  if not found then raise exception 'Devis inconnu.'; end if;
  if exists (select 1 from app.quotes where dossier = q.dossier and retenu) then raise exception 'Un devis est déjà retenu pour ce dossier.'; end if;
  select valeur into seuil from app.parametres where cle = 'devis_seuil'; select valeur::int into mini from app.parametres where cle = 'devis_min';
  select count(*) into n from app.quotes where dossier = q.dossier;
  if q.montant > seuil and n < mini then raise exception 'Au-delà de % F, % devis comparables sont exigés (% reçu(s)).', seuil, mini, n; end if;
  update app.quotes set retenu = true, justification = p_justification, decision_ref = p_decision_ref where id = p_devis;
  perform app.journaliser('DEVIS_RETENU', 'quotes', p_devis::text, null, jsonb_build_object('dossier', q.dossier, 'montant', q.montant, 'justification', p_justification));
end $$;

-- ───────── Solidarité ─────────
alter table app.cash_movements drop constraint cash_movements_source_type_check;
alter table app.cash_movements add constraint cash_movements_source_type_check check (source_type in ('paiement','depense','contrepassation','ajustement','don','aide'));
create table app.social_cases (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  member_id uuid not null references app.members(id),
  type text not null check (type in ('maladie','hospitalisation','deces','accident','difficulte','sinistre','urgence')),
  description text not null,                   -- CONFIDENTIEL : jamais publié
  montant_demande numeric(12,0) check (montant_demande is null or montant_demande > 0),
  statut text not null default 'deposee' check (statut in ('deposee','verifiee','proposee','validee','refusee','versee','close')),
  instruit_par uuid, montant_propose numeric(12,0) check (montant_propose is null or montant_propose > 0),
  valide_par uuid, motif text, mouvement_id uuid unique references app.cash_movements(id),
  cree_le timestamptz not null default now()
);
create or replace function app.demander_aide(p_type text, p_description text, p_montant numeric default null) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; m uuid := app.mon_membre();
begin
  if m is null then raise exception 'Seuls les membres actifs demandent une aide.' using errcode='42501'; end if;
  insert into app.social_cases (ref, member_id, type, description, montant_demande) values (app.nouvelle_ref('SOC'), m, p_type, p_description, p_montant) returning id into v_id;
  insert into app.notifications (member_id, titre, corps) values (m, 'Demande d''aide enregistrée', 'La commission sociale l''examinera en toute confidentialité.');
  return v_id;
end $$;
create or replace function app.instruire_aide(p_id uuid, p_montant_propose numeric, p_avis text) returns void
language plpgsql security definer set search_path = app, public as $$
declare c app.social_cases;
begin
  if not app.a_perm('social.instruire') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if p_montant_propose is null or p_montant_propose <= 0 then raise exception 'Montant proposé invalide.'; end if;
  select * into c from app.social_cases where id = p_id for update;
  if not found then raise exception 'Dossier inconnu.'; end if;
  if c.statut not in ('deposee','verifiee') then raise exception 'Dossier déjà instruit (statut %).', c.statut; end if;
  if c.member_id = app.mon_membre() then raise exception 'Séparation des tâches : pas d''instruction de son propre dossier.' using errcode='42501'; end if;
  update app.social_cases set statut = 'proposee', instruit_par = auth.uid(), montant_propose = p_montant_propose, motif = p_avis where id = p_id;
end $$;
-- Journal : événements sans donnée personnelle (pas de trigger générique sur social_cases).
create or replace function app.decider_aide(p_id uuid, p_accord boolean, p_motif text default null) returns void
language plpgsql security definer set search_path = app, public as $$
declare c app.social_cases;
begin
  if not app.a_perm('social.valider') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  select * into c from app.social_cases where id = p_id for update;
  if not found then raise exception 'Dossier inconnu.'; end if;
  if c.statut <> 'proposee' then raise exception 'Aucune proposition à valider (statut %).', c.statut; end if;
  if c.instruit_par = auth.uid() then raise exception 'Séparation des tâches : l''instructeur ne valide pas.' using errcode='42501'; end if;
  if c.member_id = app.mon_membre() then raise exception 'Séparation des tâches : pas de validation de son propre dossier.' using errcode='42501'; end if;
  if not p_accord and length(coalesce(trim(p_motif),'')) < 5 then raise exception 'Motif de refus obligatoire.'; end if;
  update app.social_cases set statut = case when p_accord then 'validee' else 'refusee' end, valide_par = auth.uid(), motif = coalesce(p_motif, motif) where id = p_id;
  insert into app.notifications (member_id, titre, corps) values (c.member_id, 'Demande d''aide ' || c.ref, case when p_accord then 'Votre demande a été acceptée.' else 'Votre demande n''a pas pu être acceptée.' end);
end $$;
create or replace function app.verser_aide(p_id uuid, p_account uuid) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare c app.social_cases; a app.cash_accounts; v_solde numeric; mv uuid;
begin
  if not app.a_perm('depense.payer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  select * into c from app.social_cases where id = p_id for update;
  if not found then raise exception 'Dossier inconnu.'; end if;
  if c.statut <> 'validee' then raise exception 'Aide non validée (statut %).', c.statut; end if;
  if c.valide_par = auth.uid() then raise exception 'Séparation des tâches : le validateur ne verse pas.' using errcode='42501'; end if;
  select * into a from app.cash_accounts where id = p_account;
  if not found or a.type <> 'fonds_solidarite' then raise exception 'Une aide se verse depuis le fonds de solidarité.'; end if;
  select s.solde into v_solde from app.v_soldes_comptes s where s.id = p_account;
  if v_solde < c.montant_propose then raise exception 'Fonds de solidarité insuffisant (%).', v_solde; end if;
  insert into app.cash_movements (ref, account_id, sens, montant, categorie, source_type, source_id) values (app.nouvelle_ref('AID'), p_account, 'sortie', c.montant_propose, 'aide_sociale', 'aide', c.id) returning id into mv;
  update app.social_cases set statut = 'versee', mouvement_id = mv where id = p_id;
  perform app.journaliser('AIDE_VERSEE', 'social_cases', p_id::text, null, jsonb_build_object('montant', c.montant_propose));   -- sans identité ni motif
  return mv;
end $$;
create or replace function app.enregistrer_don(p_account uuid, p_montant numeric, p_donateur text default null) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare a app.cash_accounts; mv uuid;
begin
  if not app.a_perm('finance.encaisser') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant invalide.'; end if;
  select * into a from app.cash_accounts where id = p_account;
  if not found or a.type <> 'fonds_solidarite' then raise exception 'Un don se verse sur le fonds de solidarité.'; end if;
  insert into app.cash_movements (ref, account_id, sens, montant, categorie, source_type, motif) values (app.nouvelle_ref('DON'), p_account, 'entree', p_montant, 'don_solidarite', 'don', nullif(p_donateur,'')) returning id into mv;
  return mv;
end $$;
-- Publication sans révéler la situation personnelle : montant et date seulement.
create view app.v_aides_publiees as
  select s.ref, m.montant, m.date_op as date_versement from app.social_cases s join app.cash_movements m on m.id = s.mouvement_id where s.statut = 'versee';
create view app.v_fonds_solidarite as
  select (select coalesce(sum(solde_ouverture),0) from app.cash_accounts where type = 'fonds_solidarite')
           + coalesce(sum(case m.sens when 'entree' then m.montant else -m.montant end),0) as solde,
         coalesce(sum(m.montant) filter (where m.source_type = 'don'),0) as dons,
         coalesce(sum(m.montant) filter (where m.source_type = 'aide'),0) as aides
  from app.cash_movements m join app.cash_accounts a on a.id = m.account_id and a.type = 'fonds_solidarite';

-- ───────── Bilan trimestriel (« contrat de confiance numérique ») et alertes de contrôle ─────────
create or replace function app.bilan_json(p_debut date, p_fin date) returns jsonb
language sql stable security definer set search_path = app, public as $$
  select jsonb_build_object(
    'du', p_debut, 'au', p_fin,
    'recettes', coalesce((select sum(montant) from app.cash_movements m where sens='entree' and source_type='paiement' and date_op between p_debut and p_fin and not exists (select 1 from app.cash_movements x where x.contre_ecriture_de = m.id)), 0),
    'depenses', coalesce((select sum(montant) from app.cash_movements m where sens='sortie' and source_type='depense' and date_op between p_debut and p_fin and not exists (select 1 from app.cash_movements x where x.contre_ecriture_de = m.id)), 0),
    'taux_recouvrement_pct', coalesce((select round(sum(montant_paye) * 100.0 / nullif(sum(montant_appele),0), 1) from app.v_appels where echeance between p_debut and p_fin), 0),
    'projets', coalesce((select jsonb_object_agg(statut, n) from (select statut, count(*) n from app.projects group by statut) t), '{}'),
    'projets_en_retard', (select count(*) from app.v_projets where en_retard),
    'incidents_signales', (select count(*) from app.incidents where signale_le::date between p_debut and p_fin),
    'incidents_resolus', (select count(*) from app.incidents where resolu_le::date between p_debut and p_fin),
    'reclamations_deposees', (select count(*) from app.complaints where cree_le::date between p_debut and p_fin),
    'reclamations_closes', (select count(*) from app.complaints where statut = 'close' and cree_le::date between p_debut and p_fin),
    'aides_versees', coalesce((select sum(m.montant) from app.social_cases s join app.cash_movements m on m.id = s.mouvement_id where m.date_op between p_debut and p_fin), 0),
    'decisions', (select jsonb_build_object('total', count(*), 'executees', count(*) filter (where statut='execute'), 'en_retard', count(*) filter (where statut not in ('execute','annule') and echeance < current_date)) from app.resolutions)
  );
$$;
create or replace function app.publier_bilan_trimestriel(p_periode text, p_debut date, p_fin date) returns uuid
language plpgsql security definer set search_path = app, public as $$
declare v_id uuid; c jsonb;
begin
  if not app.a_perm('finance.publier') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  c := app.bilan_json(p_debut, p_fin) || jsonb_build_object('periode', p_periode);
  insert into app.etats_publies (periode, titre, contenu) values (p_periode, 'Bilan trimestriel', c) on conflict (periode, titre) do nothing returning id into v_id;
  if v_id is null then raise exception 'Bilan déjà publié pour cette période (non modifiable).'; end if;
  perform app.journaliser('BILAN_PUBLIE', 'etats_publies', v_id::text, null, c);
  return v_id;
end $$;

create or replace function app.alertes_controle() returns table (type text, ref text, detail text, le timestamptz)
language plpgsql stable security definer set search_path = app, public as $$
begin
  if not app.a_perm('audit.lire') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  return query
  select 'depense_similaire'::text, a.ref, 'Dépense semblable à ' || b.ref || ' (' || a.fournisseur || ', ' || a.montant || ' F) à moins de 7 jours'::text, a.cree_le
    from app.expense_requests a join app.expense_requests b on b.id <> a.id and b.fournisseur = a.fournisseur and b.montant = a.montant and b.cree_le < a.cree_le and a.cree_le - b.cree_le < interval '7 days'
    where a.statut <> 'annulee' and b.statut <> 'annulee'
  union all
  select 'annulation_apres_validation', c.ref, 'Écriture contrepassée : ' || coalesce(c.motif, ''), c.cree_le from app.cash_movements c where c.contre_ecriture_de is not null
  union all
  select 'depassement_budget', 'B' || v.exercice || '-' || v.categorie, 'Disponible négatif : ' || v.disponible || ' F', now() from app.v_budget_execution v where v.disponible < 0
  union all
  select 'projet_hors_budget', p.code, 'Dépenses ' || (p.engage + p.paye) || ' F pour ' || p.cout_estime || ' F estimés', now() from app.v_projets p where p.depassement
  union all
  select 'projet_en_retard', p.code, 'Échéance dépassée : ' || p.fin_prevue, now() from app.v_projets p where p.en_retard
  union all
  select 'droits_modifies', l.ligne_id, l.action || ' sur user_roles', l.le from app.audit_logs l where l.table_nom = 'user_roles' and l.le > now() - interval '30 days' and l.acteur is not null
  order by 4 desc;
end $$;

do $$ declare t text; begin
  foreach t in array array['projects','project_milestones','suppliers','quotes','parametres'] loop
    execute format('create trigger %I after insert or update or delete on app.%I for each row execute function app.audit_trigger()', 'aud_'||t, t);
  end loop; end $$;
