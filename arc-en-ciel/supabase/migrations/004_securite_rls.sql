-- Arc-en-Ciel Connect — V1 · 004 Sécurité : RLS, privilèges, attribution des rôles, stockage privé
-- Défaut : tout est refusé. Les écritures financières passent exclusivement par les fonctions métier.

-- ───────── Attribution des rôles (anti-escalade) ─────────
create or replace function app.attribuer_role(p_user uuid, p_role text, p_debut date default current_date)
returns uuid language plpgsql security definer set search_path = app, public as $$
declare v_id uuid;
begin
  if not app.a_perm('droits.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  -- Un rôle porteur de droits financiers ne s'attribue que par le président (l'admin technique n'a pas ces droits).
  if exists (select 1 from app.role_permissions where role_code = p_role and perm_code in ('depense.approuver','depense.payer','finance.encaisser','finance.annuler','regles.gerer','finance.publier'))
     and not app.a_role('president') then
    raise exception 'Seul le président attribue un rôle financier.' using errcode='42501';
  end if;
  if p_role = 'president' and not app.a_role('president') then raise exception 'Seul un président en exercice désigne son successeur.' using errcode='42501'; end if;
  insert into app.user_roles (user_id, role_code, date_debut, accorde_par) values (p_user, p_role, p_debut, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function app.terminer_mandat(p_user_role uuid, p_fin date default current_date)
returns void language plpgsql security definer set search_path = app, public as $$
begin
  if not app.a_perm('droits.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  update app.user_roles set date_fin = p_fin where id = p_user_role and date_fin is null;
  if not found then raise exception 'Mandat introuvable ou déjà terminé.'; end if;
end $$;

-- Autorisation d'un document (fichier du Storage)
create or replace function app.peut_lire_document(p_chemin text) returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from app.documents d where d.chemin = p_chemin and (
    d.visibilite = 'membres'
    or (d.visibilite = 'bureau' and (app.a_perm('reunion.gerer') or app.a_perm('document.gerer') or app.a_perm('finance.lire') or app.a_perm('depense.approuver')))
    or (d.visibilite = 'controle' and app.a_perm('audit.lire'))));
$$;

-- ───────── Privilèges ─────────
revoke all on schema app from public, anon;
grant usage on schema app to authenticated;
revoke all on all tables in schema app from public, anon, authenticated;
revoke all on all sequences in schema app from public, anon, authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function
  app.a_role(text,uuid), app.a_perm(text,uuid), app.mon_membre(), app.creer_appels(uuid,text,date),
  app.enregistrer_paiement(uuid,uuid,uuid,numeric,text,text,date), app.annuler_mouvement(uuid,text),
  app.soumettre_depense(text,numeric,text,uuid,text,text[],text), app.decider_depense(uuid,text,text,text),
  app.payer_depense(uuid,uuid,text), app.publier_etat_financier(text,date,date), app.publier_pv(uuid),
  app.verifier_chaine_audit(), app.attribuer_role(uuid,text,date), app.terminer_mandat(uuid,date),
  app.peut_lire_document(text)
to authenticated;

grant select on all tables in schema app to authenticated;           -- filtré par RLS
grant insert, update on app.members, app.lots, app.lot_ownerships to authenticated;
grant insert, update on app.contributions to authenticated;
grant insert on app.cash_accounts to authenticated;
grant insert, update on app.budgets, app.budget_lines to authenticated;
grant insert, update, delete on app.validation_rules to authenticated;
grant insert, update on app.meetings, app.meeting_attendees, app.minutes, app.resolutions to authenticated;
grant insert, update, delete on app.announcements to authenticated;
grant insert, update, delete on app.documents to authenticated;
grant update (lu_le) on app.notifications to authenticated;
grant insert on app.notifications to authenticated;
grant usage on sequence app.seq_ref to authenticated;                 -- nouvelle_ref (appelée dans les fonctions)

-- ───────── RLS ─────────
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t);
  end loop; end $$;

-- Référentiel
create policy sel_roles on app.roles for select to authenticated using (true);
create policy sel_perms on app.permissions for select to authenticated using (true);
create policy sel_rp on app.role_permissions for select to authenticated using (true);

create policy sel_members on app.members for select to authenticated
  using (user_id = auth.uid() or app.a_perm('membres.gerer') or app.a_perm('finance.lire'));
create policy ins_members on app.members for insert to authenticated with check (app.a_perm('membres.gerer'));
create policy upd_members on app.members for update to authenticated using (app.a_perm('membres.gerer')) with check (app.a_perm('membres.gerer'));

create policy sel_lots on app.lots for select to authenticated
  using (app.a_perm('membres.gerer') or app.a_perm('finance.lire')
         or exists (select 1 from app.lot_ownerships o where o.lot_id = lots.id and o.member_id = app.mon_membre()));
create policy ins_lots on app.lots for insert to authenticated with check (app.a_perm('membres.gerer'));
create policy upd_lots on app.lots for update to authenticated using (app.a_perm('membres.gerer')) with check (app.a_perm('membres.gerer'));

create policy sel_own on app.lot_ownerships for select to authenticated
  using (member_id = app.mon_membre() or app.a_perm('membres.gerer') or app.a_perm('finance.lire'));
create policy ins_own on app.lot_ownerships for insert to authenticated with check (app.a_perm('membres.gerer'));
create policy upd_own on app.lot_ownerships for update to authenticated using (app.a_perm('membres.gerer')) with check (app.a_perm('membres.gerer'));

create policy sel_ur on app.user_roles for select to authenticated
  using (user_id = auth.uid() or app.a_perm('droits.gerer') or app.a_perm('audit.lire'));

-- Finance
create policy sel_acc on app.cash_accounts for select to authenticated using (app.a_perm('finance.lire') or app.a_perm('finance.encaisser'));
create policy ins_acc on app.cash_accounts for insert to authenticated with check (app.a_perm('finance.publier'));
create policy sel_cm on app.cash_movements for select to authenticated using (app.a_perm('finance.lire') or app.a_perm('finance.encaisser'));
create policy sel_pay on app.payments for select to authenticated
  using (member_id = app.mon_membre() or app.a_perm('finance.lire') or app.a_perm('finance.encaisser'));
create policy sel_contrib on app.contributions for select to authenticated using (true);
create policy ins_contrib on app.contributions for insert to authenticated with check (app.a_perm('cotisations.gerer'));
create policy upd_contrib on app.contributions for update to authenticated using (app.a_perm('cotisations.gerer')) with check (app.a_perm('cotisations.gerer'));
create policy sel_calls on app.contribution_calls for select to authenticated
  using (member_id = app.mon_membre() or app.a_perm('finance.lire') or app.a_perm('finance.encaisser') or app.a_perm('cotisations.gerer'));

create policy sel_bud on app.budgets for select to authenticated using (statut = 'adopte' or app.a_perm('budget.gerer') or app.a_perm('finance.lire'));
create policy ins_bud on app.budgets for insert to authenticated with check (app.a_perm('budget.gerer'));
create policy upd_bud on app.budgets for update to authenticated using (app.a_perm('budget.gerer') and statut <> 'cloture') with check (app.a_perm('budget.gerer'));
create policy sel_bl on app.budget_lines for select to authenticated
  using (exists (select 1 from app.budgets b where b.id = budget_id and (b.statut = 'adopte' or app.a_perm('budget.gerer') or app.a_perm('finance.lire'))));
create policy ins_bl on app.budget_lines for insert to authenticated
  with check (app.a_perm('budget.gerer') and exists (select 1 from app.budgets b where b.id = budget_id and b.statut = 'brouillon'));
create policy upd_bl on app.budget_lines for update to authenticated
  using (app.a_perm('budget.gerer') and exists (select 1 from app.budgets b where b.id = budget_id and b.statut = 'brouillon'))
  with check (app.a_perm('budget.gerer'));

create policy sel_vr on app.validation_rules for select to authenticated using (true);
create policy w_vr_i on app.validation_rules for insert to authenticated with check (app.a_perm('regles.gerer'));
create policy w_vr_u on app.validation_rules for update to authenticated using (app.a_perm('regles.gerer')) with check (app.a_perm('regles.gerer'));
create policy w_vr_d on app.validation_rules for delete to authenticated using (app.a_perm('regles.gerer'));

create policy sel_exp on app.expense_requests for select to authenticated
  using (demandeur = auth.uid() or app.a_perm('finance.lire') or app.a_perm('depense.approuver') or app.a_perm('depense.payer'));
create policy sel_apr on app.expense_approvals for select to authenticated
  using (app.a_perm('finance.lire') or app.a_perm('depense.approuver') or app.a_perm('depense.payer')
         or exists (select 1 from app.expense_requests e where e.id = expense_id and e.demandeur = auth.uid()));

-- Gouvernance
create policy sel_mt on app.meetings for select to authenticated using (convoquee or app.a_perm('reunion.gerer'));
create policy ins_mt on app.meetings for insert to authenticated with check (app.a_perm('reunion.gerer'));
create policy upd_mt on app.meetings for update to authenticated using (app.a_perm('reunion.gerer')) with check (app.a_perm('reunion.gerer'));
create policy sel_att on app.meeting_attendees for select to authenticated using (member_id = app.mon_membre() or app.a_perm('reunion.gerer'));
create policy ins_att on app.meeting_attendees for insert to authenticated with check (app.a_perm('reunion.gerer'));
create policy upd_att on app.meeting_attendees for update to authenticated using (app.a_perm('reunion.gerer') or member_id = app.mon_membre()) with check (app.a_perm('reunion.gerer') or member_id = app.mon_membre());
create policy sel_min on app.minutes for select to authenticated using (statut = 'publie' or app.a_perm('reunion.gerer'));
create policy ins_min on app.minutes for insert to authenticated with check (app.a_perm('reunion.gerer') and statut = 'brouillon');
create policy upd_min on app.minutes for update to authenticated using (app.a_perm('reunion.gerer')) with check (app.a_perm('reunion.gerer') and statut <> 'publie');
create policy sel_res on app.resolutions for select to authenticated using (true);
create policy ins_res on app.resolutions for insert to authenticated with check (app.a_perm('reunion.gerer'));
create policy upd_res on app.resolutions for update to authenticated using (app.a_perm('reunion.gerer')) with check (app.a_perm('reunion.gerer'));
create policy sel_ann on app.announcements for select to authenticated using (expire_le is null or expire_le > now() or app.a_perm('annonce.publier'));
create policy ins_ann on app.announcements for insert to authenticated with check (app.a_perm('annonce.publier'));
create policy upd_ann on app.announcements for update to authenticated using (app.a_perm('annonce.publier')) with check (app.a_perm('annonce.publier'));
create policy del_ann on app.announcements for delete to authenticated using (app.a_perm('annonce.publier'));
create policy sel_nt on app.notifications for select to authenticated using (member_id = app.mon_membre());
create policy upd_nt on app.notifications for update to authenticated using (member_id = app.mon_membre()) with check (member_id = app.mon_membre());
create policy ins_nt on app.notifications for insert to authenticated with check (app.a_perm('annonce.publier'));
create policy sel_doc on app.documents for select to authenticated using (app.peut_lire_document(chemin) or app.a_perm('document.gerer'));
create policy ins_doc on app.documents for insert to authenticated with check (app.a_perm('document.gerer'));
create policy upd_doc on app.documents for update to authenticated using (app.a_perm('document.gerer')) with check (app.a_perm('document.gerer'));
create policy del_doc on app.documents for delete to authenticated using (app.a_perm('document.gerer'));
create policy sel_etat on app.etats_publies for select to authenticated using (true);
create policy sel_aud on app.audit_logs for select to authenticated using (app.a_perm('audit.lire'));

-- ───────── Stockage privé (Supabase) ─────────
do $$ begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('documents', 'documents', false, 10485760, array['application/pdf','image/png','image/jpeg'])
    on conflict (id) do update set public = false;
    execute 'create policy doc_lecture on storage.objects for select to authenticated using (bucket_id = ''documents'' and app.peut_lire_document(name))';
    execute 'create policy doc_depot on storage.objects for insert to authenticated with check (bucket_id = ''documents'' and app.a_perm(''document.gerer''))';
  end if;
end $$;
