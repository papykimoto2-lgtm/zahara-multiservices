-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — alertes d'échéances CÔTÉ SERVEUR (cahier §10.4, RM-11).
-- À exécuter sur le projet Supabase de Zahara ET sur celui de Menco, après foncier_connect.sql. Idempotent.
--
-- Avant : les échéances n'étaient analysées que lorsqu'un utilisateur ouvrait l'application.
-- Maintenant : fc_cycle_echeances() tourne chaque jour à 07:00 (pg_cron) et écrit les notifications dues dans
-- pi_notifications_foncieres, au MÊME format et avec la MÊME clé anti-doublon (dedup) que l'application :
-- un poste qui s'ouvre ensuite ne recrée rien, et le serveur ne recrée pas ce que l'application a déjà créé.
--
-- Mêmes règles que l'application (fcAnalyserEcheances / fcPlanAlerte / fcTexteAlerte) :
--   · étapes non terminées d'un dossier ouvert (type « administratif » si en attente d'administration/décision) ;
--   · missions actives (rappel aussi à l'intervenant par e-mail) ;
--   · réglages DATA.params.fc_relances et fc_canaux repris de pi_params ; défauts identiques ;
--   · RM-11 : un délai administratif dépassé n'est JAMAIS escaladé et garde un libellé neutre ;
--   · une seule alerte, la plus urgente, par seuil franchi et par date d'échéance.
-- Canaux : « interne » pour le personnel ; « e-mail » pour les cas urgents et pour l'intervenant. Les e-mails sont
-- mis en file (en_attente) : l'envoi EmailJS part depuis un poste connecté (aucune clé d'envoi n'est stockée
-- côté serveur). Tant qu'aucun poste ne s'ouvre, l'alerte interne existe déjà ; l'e-mail attend.
-- La fonction n'est appelable que par le planificateur (aucun droit pour anon/authenticated).
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.fc__plan_alerte(p_jours integer, p_cfg jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  v_seuil integer;
  v_esc   integer := coalesce((p_cfg ->> 'escalade_apres')::integer, 0);
begin
  if p_jours > 0 then
    v_seuil := (select min(s::integer) from jsonb_array_elements_text(coalesce(p_cfg -> 'avant', '[]'::jsonb)) s where p_jours <= s::integer);
    if v_seuil is null then return null; end if;
    return jsonb_build_object('niveau', 'avant', 'seuil', v_seuil);
  elsif p_jours = 0 then
    if coalesce((p_cfg ->> 'jour')::boolean, false) then return jsonb_build_object('niveau', 'jour', 'seuil', 0); end if;
    return null;
  end if;
  if v_esc > 0 and -p_jours >= v_esc then return jsonb_build_object('niveau', 'escalade', 'seuil', v_esc); end if;
  v_seuil := (select max(s::integer) from jsonb_array_elements_text(coalesce(p_cfg -> 'apres', '[]'::jsonb)) s where -p_jours >= s::integer);
  if v_seuil is null then return null; end if;
  return jsonb_build_object('niveau', 'apres', 'seuil', v_seuil);
end
$fn$;

create or replace function public.fc__alerte_texte(p_niveau text, p_type text, p_libelle text, p_jours integer, p_echeance text)
returns jsonb
language sql
immutable
set search_path = ''
as $fn$
  select case
    when p_niveau = 'avant' then jsonb_build_object('titre', 'Échéance proche', 'msg', p_libelle || ' : échéance dans ' || abs(p_jours) || ' jour' || case when abs(p_jours) > 1 then 's' else '' end || ' (' || p_echeance || ').')
    when p_niveau = 'jour' then jsonb_build_object('titre', 'Échéance aujourd''hui', 'msg', p_libelle || ' : échéance aujourd''hui (' || p_echeance || ').')
    when p_type = 'administratif' then jsonb_build_object('titre', 'Délai administratif dépassé', 'msg', p_libelle || ' : délai attendu dépassé de ' || abs(p_jours) || ' jour' || case when abs(p_jours) > 1 then 's' else '' end || '. Une relance auprès du service concerné est conseillée. Ce dépassement n''est ni un rejet ni une faute attribuée.')
    when p_niveau = 'escalade' then jsonb_build_object('titre', 'Échéance interne dépassée — escalade', 'msg', p_libelle || ' : échéance dépassée de ' || abs(p_jours) || ' jour' || case when abs(p_jours) > 1 then 's' else '' end || ' (' || p_echeance || '). Signalé à la hiérarchie.')
    else jsonb_build_object('titre', 'Échéance interne dépassée', 'msg', p_libelle || ' : échéance dépassée de ' || abs(p_jours) || ' jour' || case when abs(p_jours) > 1 then 's' else '' end || ' (' || p_echeance || ').')
  end
$fn$;

-- Écrit une notification (une par canal) si sa clé anti-doublon n'existe pas déjà. Renvoie le nombre créé.
create or replace function public.fc__notif_ecrire(
  p_dedup text, p_dest_type text, p_dest_id text, p_dest_nom text, p_email text, p_urgent boolean,
  p_titre text, p_msg text, p_template text, p_dossier text, p_mission text, p_niveau text, p_canaux jsonb)
returns integer
language plpgsql
set search_path = ''
as $fn$
declare
  v_n integer := 0; v_canal text; v_cle text; v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_liste text[] := '{}';
begin
  if p_dest_type = 'user' and coalesce((p_canaux ->> 'interne')::boolean, true) then v_liste := array_append(v_liste, 'interne'::text); end if;
  if coalesce(p_email, '') <> '' and coalesce((p_canaux ->> 'email')::boolean, true) and (p_dest_type <> 'user' or p_urgent) then v_liste := array_append(v_liste, 'email'::text); end if;
  foreach v_canal in array v_liste loop
    v_cle := p_dedup || '|' || coalesce(nullif(p_dest_id, ''), p_email) || '|' || v_canal;
    if exists (select 1 from public.pi_notifications_foncieres where data ->> 'dedup' = v_cle) then continue; end if;
    insert into public.pi_notifications_foncieres (id, data, updated_at)
    values ('srv_' || md5(v_cle),
      jsonb_build_object('id', 'srv_' || md5(v_cle), 'dedup', v_cle, 'canal', v_canal, 'destinataire_type', p_dest_type, 'destinataire_id', coalesce(p_dest_id, ''),
        'destinataire_nom', coalesce(p_dest_nom, ''), 'adresse', case when v_canal = 'email' then p_email else '' end, 'titre', p_titre, 'message', p_msg,
        'template_code', p_template, 'dossier_id', coalesce(p_dossier, ''), 'mission_id', coalesce(p_mission, ''), 'event_id', '', 'niveau', p_niveau,
        'delivery_status', case when v_canal = 'interne' then 'livree' else 'en_attente' end, 'attempt_count', 0, 'scheduled_at', v_now, 'sent_at', '',
        'delivered_at', case when v_canal = 'interne' then v_now else '' end, 'error_message', '', 'lu', false, 'created_at', v_now, 'origine', 'serveur'),
      now())
    on conflict (id) do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end
$fn$;

create or replace function public.fc_cycle_echeances(p_aujourdhui date default (now() at time zone 'utc')::date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_params  jsonb := coalesce((select data from public.pi_params where id = 'main'), '{}'::jsonb);
  v_def     jsonb := '{"interne":{"avant":[3,1],"jour":true,"apres":[1,7],"escalade_apres":14},
                       "administratif":{"avant":[],"jour":false,"apres":[7,30],"escalade_apres":0},
                       "mission":{"avant":[3,1],"jour":true,"apres":[1,7],"escalade_apres":14}}'::jsonb;
  v_usr     jsonb := coalesce(v_params -> 'fc_relances', '{}'::jsonb);
  v_canaux  jsonb := coalesce(v_params -> 'fc_canaux', '{}'::jsonb);
  v_esc_id  text := nullif(v_params ->> 'fc_escalade_user_id', '');
  v_cfg     jsonb; v_k text; r record; u record; v_plan jsonb; v_txt jsonb; v_jours integer; v_dedup text; v_type text;
  v_urgent boolean; v_resp text; v_alertes integer := 0; v_creees integer := 0; v_iv jsonb;
begin
  v_cfg := '{}'::jsonb;
  for v_k in select jsonb_object_keys(v_def) loop
    v_cfg := v_cfg || jsonb_build_object(v_k, (v_def -> v_k) || coalesce(v_usr -> v_k, '{}'::jsonb));
  end loop;

  -- ── Étapes des dossiers ouverts ──
  for r in
    select d.id as dossier_id, d.data ->> 'reference' as ref, d.data ->> 'responsable_id' as resp_d, e.val
    from public.pi_dossiers_fonciers d
    cross join lateral jsonb_array_elements(coalesce(d.data -> 'etapes', '[]'::jsonb)) as e(val)
    where coalesce(d.data ->> 'statut', '') not in ('cloture', 'annule') and coalesce(d.data ->> '_deleted', '') <> 'true'
      and coalesce(e.val ->> 'date_cible', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and coalesce(e.val ->> 'statut', '') not in ('termine', 'rejete', 'annule')
  loop
    v_type := case when (r.val ->> 'statut') in ('attente_administration', 'attente_decision') then 'administratif' else 'interne' end;
    v_jours := (r.val ->> 'date_cible')::date - p_aujourdhui;
    v_plan := public.fc__plan_alerte(v_jours, v_cfg -> v_type);
    if v_plan is null then continue; end if;
    v_alertes := v_alertes + 1;
    v_txt := public.fc__alerte_texte(v_plan ->> 'niveau', v_type, r.val ->> 'libelle', v_jours, r.val ->> 'date_cible');
    v_urgent := (v_plan ->> 'niveau') in ('apres', 'escalade', 'jour');
    v_dedup := 'ech:' || r.dossier_id || '/' || (r.val ->> 'code') || ':' || (r.val ->> 'date_cible') || ':' || (v_plan ->> 'niveau') || (v_plan ->> 'seuil');
    v_resp := coalesce(nullif(r.val ->> 'responsable_id', ''), r.resp_d);
    for u in select id, nom, email from public.pi_users where id = v_resp loop
      v_creees := v_creees + public.fc__notif_ecrire(v_dedup, 'user', u.id, u.nom, u.email, v_urgent, v_txt ->> 'titre', v_txt ->> 'msg',
        'echeance_' || (v_plan ->> 'niveau'), r.dossier_id, '', v_plan ->> 'niveau', v_canaux);
    end loop;
    if (v_plan ->> 'niveau') = 'escalade' and v_type <> 'administratif' then      -- RM-11 : jamais d'escalade d'un délai administratif
      for u in select id, nom, email from public.pi_users
               where (v_esc_id is not null and id = v_esc_id) or (v_esc_id is null and role = 'admin' and coalesce(statut, '') <> 'inactif') loop
        v_creees := v_creees + public.fc__notif_ecrire(v_dedup || ':esc', 'user', u.id, u.nom, u.email, v_urgent, v_txt ->> 'titre', v_txt ->> 'msg',
          'echeance_' || (v_plan ->> 'niveau'), r.dossier_id, '', v_plan ->> 'niveau', v_canaux);
      end loop;
    end if;
  end loop;

  -- ── Missions actives ──
  for r in
    select m.id as mission_id, m.data as m
    from public.pi_missions_foncieres m
    where coalesce(m.data ->> 'statut', '') in ('envoyee', 'acceptee', 'en_cours', 'attente_informations', 'livrable_soumis', 'en_verification', 'a_corriger')
      and coalesce(m.data ->> '_deleted', '') <> 'true' and coalesce(m.data ->> 'echeance', '') ~ '^\d{4}-\d{2}-\d{2}$'
  loop
    v_jours := (r.m ->> 'echeance')::date - p_aujourdhui;
    v_plan := public.fc__plan_alerte(v_jours, v_cfg -> 'mission');
    if v_plan is null then continue; end if;
    v_alertes := v_alertes + 1;
    v_txt := public.fc__alerte_texte(v_plan ->> 'niveau', 'mission', (r.m ->> 'reference') || ' — ' || (r.m ->> 'titre'), v_jours, r.m ->> 'echeance');
    v_urgent := (v_plan ->> 'niveau') in ('apres', 'escalade', 'jour');
    v_dedup := 'ech:' || r.mission_id || ':' || (r.m ->> 'echeance') || ':' || (v_plan ->> 'niveau') || (v_plan ->> 'seuil');
    for u in select id, nom, email from public.pi_users where id = (r.m ->> 'responsable_validation_id') loop
      v_creees := v_creees + public.fc__notif_ecrire(v_dedup, 'user', u.id, u.nom, u.email, v_urgent, v_txt ->> 'titre', v_txt ->> 'msg',
        'echeance_' || (v_plan ->> 'niveau'), r.m ->> 'dossier_id', r.mission_id, v_plan ->> 'niveau', v_canaux);
    end loop;
    if (v_plan ->> 'niveau') = 'escalade' then
      for u in select id, nom, email from public.pi_users
               where (v_esc_id is not null and id = v_esc_id) or (v_esc_id is null and role = 'admin' and coalesce(statut, '') <> 'inactif') loop
        v_creees := v_creees + public.fc__notif_ecrire(v_dedup || ':esc', 'user', u.id, u.nom, u.email, v_urgent, v_txt ->> 'titre', v_txt ->> 'msg',
          'echeance_' || (v_plan ->> 'niveau'), r.m ->> 'dossier_id', r.mission_id, v_plan ->> 'niveau', v_canaux);
      end loop;
    end if;
    v_iv := (select data from public.pi_intervenants_fonciers where id = (r.m ->> 'intervenant_id'));
    if v_iv is not null and coalesce(v_iv ->> 'email', '') <> '' then
      v_creees := v_creees + public.fc__notif_ecrire(v_dedup, 'externe', v_iv ->> 'id', v_iv ->> 'nom_organisation', v_iv ->> 'email', false,
        'Rappel d''échéance de mission',
        'Mission ' || (r.m ->> 'reference') || ' — ' || (r.m ->> 'titre') || ' : échéance '
          || case v_plan ->> 'niveau' when 'avant' then 'dans ' || abs(v_jours) || ' jour(s)' when 'jour' then 'aujourd''hui' else 'dépassée' end || ' (' || (r.m ->> 'echeance') || ').',
        'echeance_' || (v_plan ->> 'niveau'), r.m ->> 'dossier_id', r.mission_id, v_plan ->> 'niveau', v_canaux);
    end if;
  end loop;

  return jsonb_build_object('date', p_aujourdhui, 'alertes', v_alertes, 'creees', v_creees);
end
$fn$;

revoke all on function public.fc__plan_alerte(integer, jsonb) from public, anon, authenticated;
revoke all on function public.fc__alerte_texte(text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.fc__notif_ecrire(text, text, text, text, text, boolean, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.fc_cycle_echeances(date) from public, anon, authenticated;

-- Planification quotidienne à 07:00 (UTC = heure d'Abidjan). cron.schedule remplace une tâche de même nom.
select cron.schedule('fc-echeances-quotidien', '0 7 * * *', $$select public.fc_cycle_echeances()$$);
