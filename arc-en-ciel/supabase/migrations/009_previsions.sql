-- Arc-en-Ciel Connect — V3 · 009 Prévisions, plan pluriannuel, indicateurs de performance, rappels automatiques
-- Les projections sont des PROJECTIONS : elles ne sont jamais comptées comme montants encaissés ou dépensés.

create or replace function app.simuler_scenarios(p_horizon_mois int, p_projet numeric default 0, p_lots int default null) returns jsonb
language plpgsql stable security definer set search_path = app, public as $$
declare rec numeric; dep numeric; sol numeric; nb_lots int; sc jsonb := '[]'::jsonb; x record; r numeric; d numeric; fin numeric; mois numeric; add_lot numeric;
begin
  if not app.a_perm('finance.lire') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  if p_horizon_mois is null or p_horizon_mois not between 1 and 120 then raise exception 'Horizon : 1 à 120 mois.'; end if;
  select coalesce(sum(montant), 0) / 6.0 into rec from app.cash_movements m where sens = 'entree' and source_type = 'paiement' and date_op >= current_date - 182
    and not exists (select 1 from app.cash_movements c where c.contre_ecriture_de = m.id);
  select coalesce(sum(montant), 0) / 6.0 into dep from app.cash_movements m where sens = 'sortie' and source_type = 'depense' and date_op >= current_date - 182
    and not exists (select 1 from app.cash_movements c where c.contre_ecriture_de = m.id);
  select coalesce(sum(solde), 0) into sol from app.v_soldes_comptes where type <> 'fonds_solidarite';
  select coalesce(p_lots, (select count(distinct lot_id) from app.lot_ownerships where date_fin is null), 1) into nb_lots;
  for x in select * from (values ('prudent', 0.80, 1.05), ('realiste', 1.00, 1.00), ('ambitieux', 1.15, 0.95)) v(nom, kr, kd) loop
    r := round(rec * x.kr); d := round(dep * x.kd); fin := sol + (r - d) * p_horizon_mois;
    mois := case when p_projet <= 0 then null when r - d <= 0 then null else ceil(greatest(p_projet - greatest(sol, 0), 0) / (r - d)) end;
    add_lot := case when p_projet <= 0 then 0 else greatest(ceil((p_projet - greatest(sol, 0) - (r - d) * p_horizon_mois) / (p_horizon_mois * nb_lots::numeric)), 0) end;
    sc := sc || jsonb_build_object('scenario', x.nom, 'recettes_mensuelles', r, 'depenses_mensuelles', d, 'solde_final', fin,
      'mois_pour_financer', mois, 'cotisation_supplementaire_par_lot_et_par_mois', add_lot);
  end loop;
  return jsonb_build_object('projection', true, 'base', jsonb_build_object('solde_actuel', sol, 'recettes_moy_6m', round(rec), 'depenses_moy_6m', round(dep), 'lots', nb_lots), 'horizon_mois', p_horizon_mois, 'projet', p_projet, 'scenarios', sc);
end $$;

create view app.v_plan_pluriannuel with (security_invoker = true) as
select extract(year from coalesce(fin_prevue, debut, current_date))::int as annee, horizon, count(*) as projets, sum(cout_estime) as cout_estime, string_agg(code, ', ' order by code) as codes
from app.projects where statut not in ('termine','abandonne') group by 1, 2;

create or replace function app.indicateurs_performance(p_debut date, p_fin date) returns jsonb
language sql stable security definer set search_path = app, public as $$
  select jsonb_build_object(
    'periode', jsonb_build_array(p_debut, p_fin),
    'membres_actifs', (select count(*) from app.members where actif),
    'taux_membres_connectes_pct', (select round(count(*) filter (where user_id is not null) * 100.0 / nullif(count(*),0), 1) from app.members where actif),
    'taux_recouvrement_pct', (select round(sum(montant_paye) * 100.0 / nullif(sum(montant_appele),0), 1) from app.v_appels where echeance between p_debut and p_fin),
    'delai_moyen_validation_depense_h', (select round(avg(extract(epoch from (a.dernier - e.cree_le)) / 3600)::numeric, 1)
        from app.expense_requests e join (select expense_id, max(le) dernier from app.expense_approvals where decision = 'approuve' group by expense_id) a on a.expense_id = e.id where e.cree_le::date between p_debut and p_fin),
    'depenses_avec_justificatif_pct', (select round(count(*) filter (where cardinality(justificatifs) > 0) * 100.0 / nullif(count(*),0), 1) from app.expense_requests where cree_le::date between p_debut and p_fin),
    'execution_budget_pct', (select round(sum(paye) * 100.0 / nullif(sum(montant_prevu),0), 1) from app.v_budget_execution),
    'projets_termines_pct', (select round(count(*) filter (where statut = 'termine') * 100.0 / nullif(count(*) filter (where statut <> 'idee'),0), 1) from app.projects),
    'incidents_resolus_pct', (select round(count(*) filter (where statut = 'resolu') * 100.0 / nullif(count(*),0), 1) from app.incidents where signale_le::date between p_debut and p_fin),
    'delai_moyen_reclamation_j', (select round(avg(extract(epoch from (u.dernier - c.cree_le)) / 86400)::numeric, 1) from app.complaints c join (select complaint_id, max(le) dernier from app.complaint_updates where statut in ('repondue','close') group by complaint_id) u on u.complaint_id = c.id where c.cree_le::date between p_debut and p_fin),
    'participation_moyenne_pct', (select round(avg((resultat->>'participation_pct')::numeric), 1) from app.consultations where statut = 'close' and cloture::date between p_debut and p_fin),
    'aides_versees', (select count(*) from app.social_cases where statut = 'versee'),
    'decisions_executees_pct', (select round(count(*) filter (where statut = 'execute') * 100.0 / nullif(count(*) filter (where statut <> 'annule'),0), 1) from app.resolutions)
  );
$$;

-- Rappels automatiques (appelable par un planificateur pg_cron ou par un responsable) : idempotents grâce à la clé.
alter table app.notifications add column cle text;
create unique index notifications_cle_uq on app.notifications (member_id, cle) where cle is not null;
create or replace function app.generer_rappels() returns int
language plpgsql security definer set search_path = app, public as $$
declare n1 int; n2 int;
begin
  if auth.uid() is not null and not app.a_perm('annonce.publier') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  insert into app.notifications (member_id, titre, corps, cle)
  select a.member_id, 'Cotisation à échéance le ' || to_char(a.echeance, 'DD/MM/YYYY'), 'Reste à payer : ' || a.reste || ' F.', 'rappel-' || a.id
  from app.v_appels a where a.statut in ('appele','partiel') and a.echeance between current_date and current_date + 3 on conflict do nothing;
  get diagnostics n1 = row_count;
  insert into app.notifications (member_id, titre, corps, cle)
  select a.member_id, 'Cotisation en retard (' || a.periode || ')', 'Reste à payer : ' || a.reste || ' F.', 'retard-' || a.id || '-' || to_char(current_date, 'IYYY-IW')
  from app.v_appels a where a.statut = 'en_retard' on conflict do nothing;
  get diagnostics n2 = row_count;
  return n1 + n2;
end $$;
