-- Arc-en-Ciel Connect — V2 · 007 Sécurité : RLS, privilèges et fonctions exposées pour les modules V2

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t);
  end loop; end $$;

revoke execute on all functions in schema app from public, anon;
grant execute on function
  app.ouvrir_consultation(uuid), app.voter(uuid,int), app.a_vote(uuid), app.clore_consultation(uuid),
  app.proposer(text,text,text,numeric), app.traiter_proposition(uuid,text,text,text),
  app.deposer_reclamation(text,text,text,boolean), app.traiter_reclamation(uuid,text,text,uuid), app.demander_reexamen(uuid,text),
  app.signaler_incident(text,text,text,uuid), app.traiter_incident(uuid,text,text,text,text,date,text),
  app.lier_depense_projet(uuid,uuid), app.retenir_devis(uuid,text,text),
  app.demander_aide(text,text,numeric), app.instruire_aide(uuid,numeric,text), app.decider_aide(uuid,boolean,text), app.verser_aide(uuid,uuid), app.enregistrer_don(uuid,numeric,text),
  app.publier_bilan_trimestriel(text,date,date), app.alertes_controle()
to authenticated;
-- Fonctions internes : jamais appelables par les clients
revoke execute on function app.bilan_json(date,date), app.journaliser(text,text,text,jsonb,jsonb) from public, anon, authenticated;

grant select on app.consultations, app.propositions, app.complaints, app.complaint_updates, app.assets, app.incidents, app.incident_events, app.v_incidents_publics,
  app.projects, app.project_milestones, app.v_projets, app.suppliers, app.quotes, app.parametres, app.social_cases, app.v_aides_publiees, app.v_fonds_solidarite to authenticated;
grant insert, update on app.projects, app.project_milestones, app.suppliers, app.quotes, app.assets to authenticated;
-- Consultations : ni statut ni résultat ne s'écrivent directement (ouvrir_consultation / clore_consultation).
grant insert (ref, titre, description, type, options, eligibles, ouverture, cloture, quorum_pct, majorite, consultatif) on app.consultations to authenticated;
grant update (titre, description, options, eligibles, ouverture, cloture, quorum_pct, majorite, consultatif) on app.consultations to authenticated;
grant update on app.parametres to authenticated;
-- emargements et bulletins : AUCUN accès direct (secret du vote) ; les résultats passent par clore_consultation().

-- Consultations : visibles par tous dès qu'elles sont ouvertes ; brouillons réservés aux organisateurs
create policy sel_cons on app.consultations for select to authenticated using (statut <> 'brouillon' or app.a_perm('vote.gerer'));
create policy ins_cons on app.consultations for insert to authenticated with check (app.a_perm('vote.gerer') and statut = 'brouillon');
create policy upd_cons on app.consultations for update to authenticated using (app.a_perm('vote.gerer')) with check (app.a_perm('vote.gerer'));
-- Idées : chaque membre voit les siennes ; le bureau voit tout ; les idées traitées sont publiques
create policy sel_prop on app.propositions for select to authenticated using (member_id = app.mon_membre() or app.a_perm('proposition.traiter') or statut in ('acceptee','planifiee','realisee'));
-- Réclamations : le membre voit les siennes ; les personnes habilitées voient le reste ; la médiation reste confidentielle
create policy sel_rec on app.complaints for select to authenticated
  using (member_id = app.mon_membre() or (app.a_perm('reclamation.traiter') and (not confidentiel or app.a_perm('mediation.lire'))) or (confidentiel and app.a_perm('mediation.lire')));
create policy sel_recu on app.complaint_updates for select to authenticated
  using (exists (select 1 from app.complaints c where c.id = complaint_id));      -- hérite des règles ci-dessus
-- Incidents : la cité voit la vue publique ; déclarant et responsables voient le détail
create policy sel_inc on app.incidents for select to authenticated using (declarant = app.mon_membre() or app.a_perm('incident.traiter'));
create policy sel_ince on app.incident_events for select to authenticated using (exists (select 1 from app.incidents i where i.id = incident_id));
create policy sel_ast on app.assets for select to authenticated using (true);
create policy w_ast_i on app.assets for insert to authenticated with check (app.a_perm('incident.traiter'));
create policy w_ast_u on app.assets for update to authenticated using (app.a_perm('incident.traiter')) with check (app.a_perm('incident.traiter'));
-- Projets : transparence pour tous les membres ; gestion par les responsables
create policy sel_prj on app.projects for select to authenticated using (true);
create policy ins_prj on app.projects for insert to authenticated with check (app.a_perm('projet.gerer'));
create policy upd_prj on app.projects for update to authenticated using (app.a_perm('projet.gerer')) with check (app.a_perm('projet.gerer'));
create policy sel_ms on app.project_milestones for select to authenticated using (true);
create policy ins_ms on app.project_milestones for insert to authenticated with check (app.a_perm('projet.gerer'));
create policy upd_ms on app.project_milestones for update to authenticated using (app.a_perm('projet.gerer')) with check (app.a_perm('projet.gerer'));
-- Prestataires et devis : bureau et contrôle
create policy sel_sup on app.suppliers for select to authenticated using (app.a_perm('prestataire.gerer') or app.a_perm('finance.lire') or app.a_perm('audit.lire'));
create policy w_sup_i on app.suppliers for insert to authenticated with check (app.a_perm('prestataire.gerer'));
create policy w_sup_u on app.suppliers for update to authenticated using (app.a_perm('prestataire.gerer')) with check (app.a_perm('prestataire.gerer'));
create policy sel_quo on app.quotes for select to authenticated using (app.a_perm('prestataire.gerer') or app.a_perm('finance.lire') or app.a_perm('audit.lire'));
create policy w_quo_i on app.quotes for insert to authenticated with check (app.a_perm('prestataire.gerer') and not retenu);
create policy sel_par on app.parametres for select to authenticated using (true);
create policy upd_par on app.parametres for update to authenticated using (app.a_perm('regles.gerer')) with check (app.a_perm('regles.gerer'));
-- Social : dossier visible du bénéficiaire et de la commission ; la cité ne voit que les vues agrégées
create policy sel_soc on app.social_cases for select to authenticated using (member_id = app.mon_membre() or app.a_perm('social.instruire') or app.a_perm('social.valider'));
