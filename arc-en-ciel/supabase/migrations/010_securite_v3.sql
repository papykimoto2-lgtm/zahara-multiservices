-- Arc-en-Ciel Connect — V3 · 010 Sécurité : RLS, privilèges et fonctions exposées pour les modules V3

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t);
  end loop; end $$;

revoke execute on all functions in schema app from public, anon;
grant execute on function
  app.positionner_actif(uuid,numeric,numeric), app.positionner_incident(uuid,numeric,numeric), app.declarer_sinistre(uuid,date,text,numeric,uuid),
  app.ouvrir_enquete(uuid), app.repondre_enquete(uuid,int[]), app.resultats_enquete(uuid),
  app.importer_releve(uuid,jsonb), app.rapprocher(uuid,uuid), app.signaler_ecart(uuid,text),
  app.simuler_scenarios(int,numeric,int), app.indicateurs_performance(date,date), app.generer_rappels()
to authenticated;

grant select on app.v_carte, app.insurance_contracts, app.insurance_claims, app.v_assurances_echeances, app.utility_readings, app.v_evolution_charges,
  app.surveys, app.bank_lines, app.v_a_rapprocher, app.v_plan_pluriannuel to authenticated;
grant insert, update on app.insurance_contracts, app.utility_readings to authenticated;
grant update (statut, montant_indemnise, motif) on app.insurance_claims to authenticated;
grant insert (titre, themes, ouverture, cloture) on app.surveys to authenticated;
-- survey_emargements et survey_answers : aucun accès direct (anonymat des réponses).

create policy sel_ic on app.insurance_contracts for select to authenticated using (app.a_perm('assurance.gerer') or app.a_perm('finance.lire') or app.a_perm('audit.lire'));
create policy ins_ic on app.insurance_contracts for insert to authenticated with check (app.a_perm('assurance.gerer'));
create policy upd_ic on app.insurance_contracts for update to authenticated using (app.a_perm('assurance.gerer')) with check (app.a_perm('assurance.gerer'));
create policy sel_cl on app.insurance_claims for select to authenticated using (app.a_perm('assurance.gerer') or app.a_perm('finance.lire') or app.a_perm('audit.lire'));
create policy upd_cl on app.insurance_claims for update to authenticated using (app.a_perm('assurance.gerer')) with check (app.a_perm('assurance.gerer'));
create policy sel_ur on app.utility_readings for select to authenticated using (app.a_perm('charges.gerer') or app.a_perm('finance.lire') or app.a_perm('audit.lire'));
create policy ins_ur on app.utility_readings for insert to authenticated with check (app.a_perm('charges.gerer'));
create policy upd_ur on app.utility_readings for update to authenticated using (app.a_perm('charges.gerer')) with check (app.a_perm('charges.gerer'));
create policy sel_sv on app.surveys for select to authenticated using (statut <> 'brouillon' or app.a_perm('enquete.gerer'));
create policy ins_sv on app.surveys for insert to authenticated with check (app.a_perm('enquete.gerer'));
create policy sel_bl on app.bank_lines for select to authenticated using (app.a_perm('finance.lire') or app.a_perm('finance.encaisser') or app.a_perm('audit.lire'));
