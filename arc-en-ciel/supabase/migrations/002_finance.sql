-- Arc-en-Ciel Connect — V1 · 002 Finance : comptes, cotisations, grand livre de trésorerie, budgets, dépenses
-- Principes : un seul grand livre (cash_movements) ; écritures en ajout seul ; contrepassation motivée ;
-- toutes les écritures passent par des fonctions (security definer) — aucune écriture directe côté client.

create table app.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  nom text not null,
  type text not null check (type in ('caisse','banque','mobile_money','fonds_solidarite')),
  solde_ouverture numeric(14,0) not null default 0,
  actif boolean not null default true
);

-- Grand livre : immuable. Une erreur se corrige par une écriture inverse (contre_ecriture_de).
create table app.cash_movements (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  account_id uuid not null references app.cash_accounts(id),
  sens text not null check (sens in ('entree','sortie')),
  montant numeric(14,0) not null check (montant > 0),
  categorie text not null,
  date_op date not null default current_date,
  source_type text not null check (source_type in ('paiement','depense','contrepassation','ajustement')),
  source_id uuid,
  contre_ecriture_de uuid unique references app.cash_movements(id),
  motif text,
  cree_par uuid not null default auth.uid(),
  cree_le timestamptz not null default now(),
  check (contre_ecriture_de is null or length(coalesce(motif,'')) >= 5)
);
create index on app.cash_movements (account_id, date_op);

create or replace function app.ledger_immuable() returns trigger language plpgsql as $$
begin raise exception 'Écriture comptable immuable : utiliser une contrepassation (%).', tg_op using errcode = '42501'; end $$;
create trigger cm_no_mod before update or delete on app.cash_movements for each row execute function app.ledger_immuable();
create trigger cm_no_trunc before truncate on app.cash_movements for each statement execute function app.ledger_immuable();

-- ───────── Cotisations ─────────
create table app.contributions (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  type text not null default 'ordinaire' check (type in ('ordinaire','exceptionnelle','travaux','autre')),
  montant numeric(12,0) not null check (montant > 0),
  periodicite text not null default 'mensuelle' check (periodicite in ('unique','mensuelle','trimestrielle','annuelle')),
  debut date not null, fin date,
  paiement_partiel boolean not null default true,
  cree_par uuid default auth.uid(),
  check (fin is null or fin >= debut)
);

create table app.contribution_calls (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references app.contributions(id),
  member_id uuid not null references app.members(id),
  lot_id uuid references app.lots(id),
  periode text not null,                         -- ex. 2026-11
  montant_appele numeric(12,0) not null check (montant_appele > 0),
  echeance date not null,
  conteste boolean not null default false,
  unique (contribution_id, member_id, lot_id, periode)
);
create index on app.contribution_calls (member_id);

create table app.payments (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  call_id uuid references app.contribution_calls(id),
  member_id uuid not null references app.members(id),
  movement_id uuid not null unique references app.cash_movements(id),
  montant numeric(12,0) not null check (montant > 0),
  mode text not null check (mode in ('especes','virement','cheque','mobile_money')),
  reference_externe text,
  date_paiement date not null default current_date,
  annule boolean not null default false,
  saisi_par uuid not null default auth.uid()
);
create index on app.payments (call_id);
create index on app.payments (member_id);
-- seul champ modifiable : annule (via annuler_mouvement)
create or replace function app.payments_garde() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Paiement non supprimable.' using errcode='42501'; end if;
  if (to_jsonb(new) - 'annule') is distinct from (to_jsonb(old) - 'annule') then raise exception 'Paiement non modifiable.' using errcode='42501'; end if;
  return new;
end $$;
create trigger pay_garde before update or delete on app.payments for each row execute function app.payments_garde();

-- Situation de chaque appel : appelé / encaissé / reste / statut (sommes appelées ≠ sommes encaissées)
create view app.v_appels with (security_invoker = true) as
select c.id, c.contribution_id, c.member_id, c.lot_id, c.periode, c.montant_appele, c.echeance, c.conteste,
       coalesce(sum(p.montant) filter (where not p.annule), 0) as montant_paye,
       c.montant_appele - coalesce(sum(p.montant) filter (where not p.annule), 0) as reste,
       case when c.conteste then 'conteste'
            when coalesce(sum(p.montant) filter (where not p.annule), 0) >= c.montant_appele then 'paye'
            when c.echeance < current_date then 'en_retard'
            when coalesce(sum(p.montant) filter (where not p.annule), 0) > 0 then 'partiel'
            else 'appele' end as statut
from app.contribution_calls c left join app.payments p on p.call_id = c.id
group by c.id;

create view app.v_soldes_comptes with (security_invoker = true) as
select a.id, a.code, a.nom, a.type, a.solde_ouverture,
       a.solde_ouverture + coalesce(sum(case m.sens when 'entree' then m.montant else -m.montant end), 0) as solde
from app.cash_accounts a left join app.cash_movements m on m.account_id = a.id
group by a.id;

-- ───────── Budgets et dépenses ─────────
create table app.budgets (
  id uuid primary key default gen_random_uuid(),
  exercice int not null unique check (exercice between 2020 and 2100),
  statut text not null default 'brouillon' check (statut in ('brouillon','adopte','cloture'))
);
create table app.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references app.budgets(id),
  categorie text not null,
  montant_prevu numeric(14,0) not null check (montant_prevu >= 0),
  unique (budget_id, categorie)
);

-- Seuils configurables sans développeur (illustratifs, à adopter par les organes de la cité)
create table app.validation_rules (
  id uuid primary key default gen_random_uuid(),
  montant_min numeric(14,0) not null check (montant_min >= 0),
  montant_max numeric(14,0),
  roles_requis text[] not null check (cardinality(roles_requis) >= 1),
  decision_requise boolean not null default false,
  check (montant_max is null or montant_max >= montant_min)
);
-- pas de chevauchement de tranches
alter table app.validation_rules add constraint vr_no_overlap
  exclude using gist (numrange(montant_min, coalesce(montant_max, 1e15), '[]') with &&);

create table app.expense_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  objet text not null check (length(trim(objet)) >= 3),
  montant numeric(14,0) not null check (montant > 0),
  categorie text not null,
  budget_line_id uuid references app.budget_lines(id),
  fournisseur text not null,
  statut text not null default 'soumise' check (statut in ('soumise','approuvee','payee','rejetee','annulee')),
  demandeur uuid not null default auth.uid(),
  decision_ref text,
  justificatifs text[] not null default '{}',
  mouvement_id uuid unique references app.cash_movements(id),
  cree_le timestamptz not null default now()
);
create index on app.expense_requests (statut);

create table app.expense_approvals (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references app.expense_requests(id),
  approbateur uuid not null default auth.uid(),
  role_code text not null references app.roles(code),
  decision text not null check (decision in ('approuve','rejete')),
  motif text,
  le timestamptz not null default now(),
  unique (expense_id, approbateur),
  check (decision = 'approuve' or length(coalesce(motif,'')) >= 5)
);

create view app.v_budget_execution with (security_invoker = true) as
select l.id as line_id, b.exercice, l.categorie, l.montant_prevu,
       coalesce(sum(e.montant) filter (where e.statut = 'soumise' or e.statut = 'approuvee'), 0) as engage,
       coalesce(sum(e.montant) filter (where e.statut = 'payee'), 0) as paye,
       l.montant_prevu - coalesce(sum(e.montant) filter (where e.statut in ('soumise','approuvee','payee')), 0) as disponible
from app.budget_lines l join app.budgets b on b.id = l.budget_id
left join app.expense_requests e on e.budget_line_id = l.id
group by l.id, b.exercice;

-- ───────── Séquences de référence ─────────
create sequence app.seq_ref;
create or replace function app.nouvelle_ref(prefixe text) returns text language sql as $$
  select prefixe || '-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('app.seq_ref')::text, 6, '0');
$$;

-- ───────── Fonctions métier ─────────
create or replace function app.creer_appels(p_contribution uuid, p_periode text, p_echeance date)
returns int language plpgsql security definer set search_path = app, public as $$
declare c app.contributions; n int;
begin
  if not app.a_perm('cotisations.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  select * into c from app.contributions where id = p_contribution;
  if not found then raise exception 'Cotisation inconnue.'; end if;
  insert into app.contribution_calls (contribution_id, member_id, lot_id, periode, montant_appele, echeance)
  select c.id, o.member_id, o.lot_id, p_periode, round(c.montant * o.quote_part), p_echeance
  from app.lot_ownerships o join app.members m on m.id = o.member_id
  where o.lien in ('proprietaire','indivisaire') and m.actif
    and o.date_debut <= p_echeance and (o.date_fin is null or o.date_fin >= current_date)
  on conflict do nothing;
  get diagnostics n = row_count; return n;
end $$;

create or replace function app.enregistrer_paiement(p_call uuid, p_member uuid, p_account uuid, p_montant numeric, p_mode text, p_ref_ext text default null, p_date date default current_date)
returns uuid language plpgsql security definer set search_path = app, public as $$
declare cl app.v_appels; ctr app.contributions; mv uuid; pid uuid; r text; mem uuid := p_member;
begin
  if not app.a_perm('finance.encaisser') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant invalide.'; end if;
  if p_call is not null then
    perform 1 from app.contribution_calls where id = p_call for update;   -- sérialise les paiements d'un même appel
    select * into cl from app.v_appels where id = p_call;
    if not found then raise exception 'Appel inconnu.'; end if;
    mem := cl.member_id;
    select * into ctr from app.contributions where id = cl.contribution_id;
    if p_montant > cl.reste then raise exception 'Le paiement dépasse le reste dû (%).', cl.reste; end if;
    if p_montant < cl.reste and not ctr.paiement_partiel then raise exception 'Paiement partiel non autorisé pour cette cotisation.'; end if;
  end if;
  if mem is null then raise exception 'Membre obligatoire.'; end if;
  r := app.nouvelle_ref('ENC');
  insert into app.cash_movements (ref, account_id, sens, montant, categorie, date_op, source_type, motif)
  values (r, p_account, 'entree', p_montant, 'cotisation', p_date, 'paiement', null) returning id into mv;
  insert into app.payments (ref, call_id, member_id, movement_id, montant, mode, reference_externe, date_paiement)
  values (r, p_call, mem, mv, p_montant, p_mode, p_ref_ext, p_date) returning id into pid;
  return pid;
end $$;

create or replace function app.journaliser(p_action text, p_table text, p_id text, p_avant jsonb, p_apres jsonb)
returns void language plpgsql security definer set search_path = app, public as $$
declare prec text; h text;
begin
  perform pg_advisory_xact_lock(7001);
  select empreinte into prec from app.audit_logs order by id desc limit 1;
  h := encode(sha256(convert_to(coalesce(prec,'') || p_action || p_table || coalesce(p_id,'') || coalesce(p_avant::text,'') || coalesce(p_apres::text,'') || clock_timestamp()::text, 'UTF8')), 'hex');
  insert into app.audit_logs (acteur, action, table_nom, ligne_id, avant, apres, empreinte_prec, empreinte)
  values (auth.uid(), p_action, p_table, p_id, p_avant, p_apres, prec, h);
end $$;
revoke all on function app.journaliser(text,text,text,jsonb,jsonb) from public, anon, authenticated;

create or replace function app.annuler_mouvement(p_mouvement uuid, p_motif text)
returns uuid language plpgsql security definer set search_path = app, public as $$
declare m app.cash_movements; nv uuid; nr text;
begin
  if not app.a_perm('finance.annuler') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if length(coalesce(trim(p_motif),'')) < 5 then raise exception 'Motif obligatoire (5 caractères min.).'; end if;
  select * into m from app.cash_movements where id = p_mouvement for update;
  if not found then raise exception 'Écriture inconnue.'; end if;
  if m.contre_ecriture_de is not null or m.source_type = 'contrepassation' then raise exception 'Une contrepassation ne se contrepasse pas.'; end if;
  if exists (select 1 from app.cash_movements where contre_ecriture_de = m.id) then raise exception 'Écriture déjà annulée.'; end if;
  nr := app.nouvelle_ref('CTR');
  insert into app.cash_movements (ref, account_id, sens, montant, categorie, date_op, source_type, contre_ecriture_de, motif)
  values (nr, m.account_id, case m.sens when 'entree' then 'sortie' else 'entree' end, m.montant, m.categorie, current_date, 'contrepassation', m.id, p_motif)
  returning id into nv;
  update app.payments set annule = true where movement_id = m.id;
  update app.expense_requests set statut = 'annulee' where mouvement_id = m.id;
  perform app.journaliser('CONTREPASSATION', 'cash_movements', m.id::text, to_jsonb(m), jsonb_build_object('contre_ecriture', nv, 'motif', p_motif));
  return nv;
end $$;

-- Tranche de validation applicable à un montant
create or replace function app.regle_pour(p_montant numeric) returns app.validation_rules
language sql stable security definer set search_path = app, public as $$
  select r from app.validation_rules r
  where p_montant >= r.montant_min and (r.montant_max is null or p_montant <= r.montant_max) limit 1;
$$;

create or replace function app.soumettre_depense(p_objet text, p_montant numeric, p_categorie text, p_ligne uuid, p_fournisseur text, p_justificatifs text[] default '{}', p_decision_ref text default null)
returns uuid language plpgsql security definer set search_path = app, public as $$
declare v_dispo numeric; v_id uuid; r app.validation_rules;
begin
  if not app.a_perm('depense.creer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  r := app.regle_pour(p_montant);
  if r.id is null then raise exception 'Aucune règle de validation pour ce montant : configurer les seuils.'; end if;
  if r.decision_requise and coalesce(trim(p_decision_ref),'') = '' then raise exception 'Décision ou vote de l''organe compétent obligatoire (référence).'; end if;
  if p_ligne is not null then
    select disponible into v_dispo from app.v_budget_execution where line_id = p_ligne;
    if v_dispo is null then raise exception 'Ligne budgétaire inconnue.'; end if;
    if p_montant > v_dispo then raise exception 'Budget insuffisant : disponible %.', v_dispo; end if;
  end if;
  insert into app.expense_requests (ref, objet, montant, categorie, budget_line_id, fournisseur, justificatifs, decision_ref)
  values (app.nouvelle_ref('DEP'), p_objet, p_montant, p_categorie, p_ligne, p_fournisseur, coalesce(p_justificatifs,'{}'), p_decision_ref)
  returning id into v_id;
  perform app.journaliser('DEPENSE_SOUMISE', 'expense_requests', v_id::text, null, jsonb_build_object('montant', p_montant, 'objet', p_objet));
  return v_id;
end $$;

create or replace function app.decider_depense(p_depense uuid, p_role text, p_decision text, p_motif text default null)
returns text language plpgsql security definer set search_path = app, public as $$
declare e app.expense_requests; r app.validation_rules; manque text[]; ok text[];
begin
  if not app.a_perm('depense.approuver') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if not app.a_role(p_role) then raise exception 'Vous n''exercez pas le rôle %.', p_role using errcode='42501'; end if;
  select * into e from app.expense_requests where id = p_depense for update;
  if not found then raise exception 'Dépense inconnue.'; end if;
  if e.statut <> 'soumise' then raise exception 'Dépense non soumise à validation (statut %).', e.statut; end if;
  if e.demandeur = auth.uid() then raise exception 'Séparation des tâches : le demandeur ne valide pas sa propre dépense.' using errcode='42501'; end if;
  r := app.regle_pour(e.montant);
  if not (p_role = any (r.roles_requis)) then raise exception 'Le rôle % n''est pas requis pour ce montant.', p_role; end if;
  insert into app.expense_approvals (expense_id, role_code, decision, motif) values (e.id, p_role, p_decision, p_motif);
  perform app.journaliser('DEPENSE_' || upper(p_decision), 'expense_requests', e.id::text, null, jsonb_build_object('role', p_role));
  if p_decision = 'rejete' then
    update app.expense_requests set statut = 'rejetee' where id = e.id; return 'rejetee';
  end if;
  select array_agg(x) into manque from unnest(r.roles_requis) x
   where not exists (select 1 from app.expense_approvals a where a.expense_id = e.id and a.role_code = x and a.decision = 'approuve');
  if manque is null then
    update app.expense_requests set statut = 'approuvee' where id = e.id; return 'approuvee';
  end if;
  return 'en_attente:' || array_to_string(manque, ',');
end $$;

create or replace function app.payer_depense(p_depense uuid, p_account uuid, p_justificatif text)
returns uuid language plpgsql security definer set search_path = app, public as $$
declare e app.expense_requests; mv uuid; v_solde numeric;
begin
  if not app.a_perm('depense.payer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if coalesce(trim(p_justificatif),'') = '' then raise exception 'Justificatif de règlement obligatoire.'; end if;
  select * into e from app.expense_requests where id = p_depense for update;
  if not found then raise exception 'Dépense inconnue.'; end if;
  if e.statut <> 'approuvee' then raise exception 'Paiement refusé : dépense non approuvée (statut %).', e.statut; end if;
  if e.demandeur = auth.uid() then raise exception 'Séparation des tâches : le demandeur ne peut pas payer sa dépense.' using errcode='42501'; end if;
  if cardinality(e.justificatifs) = 0 then raise exception 'Pièce justificative de la dépense manquante.'; end if;
  select s.solde into v_solde from app.v_soldes_comptes s where s.id = p_account;
  if v_solde is null then raise exception 'Compte inconnu.'; end if;
  if v_solde < e.montant then raise exception 'Solde insuffisant (%).', v_solde; end if;
  insert into app.cash_movements (ref, account_id, sens, montant, categorie, source_type, source_id, motif)
  values (app.nouvelle_ref('PAY'), p_account, 'sortie', e.montant, e.categorie, 'depense', e.id, null) returning id into mv;
  update app.expense_requests set statut = 'payee', mouvement_id = mv, justificatifs = justificatifs || p_justificatif where id = e.id;
  perform app.journaliser('DEPENSE_PAYEE', 'expense_requests', e.id::text, null, jsonb_build_object('mouvement', mv, 'justificatif', p_justificatif));
  return mv;
end $$;

-- Seuils illustratifs (FCFA) — à faire adopter par les organes de la cité
insert into app.validation_rules (montant_min, montant_max, roles_requis, decision_requise) values
 (1, 25000, '{responsable_commission,tresorier}', false),
 (25001, 100000, '{president,tresorier}', false),
 (100001, 500000, '{president,tresorier,second_approbateur}', false),
 (500001, null, '{president,tresorier,second_approbateur}', true);

do $$ declare t text; begin
  foreach t in array array['cash_accounts','contributions','contribution_calls','payments','budgets','budget_lines','validation_rules','expense_requests','expense_approvals'] loop
    execute format('create trigger %I after insert or update or delete on app.%I for each row execute function app.audit_trigger()', 'aud_'||t, t);
  end loop; end $$;
