-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — portail intervenants (P1-P2) : fc_vue_intervenant(),
-- fc_intervenant_accepter(), fc_intervenant_demarrer()
-- À exécuter sur le projet Supabase de Zahara ET sur celui de Menco, après
-- foncier_connect.sql. Idempotent.
--
-- Un intervenant externe (géomètre, notaire, prestataire) ne reçoit AUCUN accès
-- aux tables. Cette fonction (SECURITY DEFINER) lui renvoie UNIQUEMENT la vue
-- définie par fcVueIntervenant() (cahier §8.5) :
--   · ses missions envoyées (ni brouillon, ni annulée) ;
--   · le dossier (référence, parcelle), les étapes de son périmètre ;
--   · ses livrables et leurs versions, avec le motif de refus à corriger.
-- Jamais : observations, responsable de validation, contrat, montants,
-- identité des souscripteurs, autres missions, autres dossiers.
--
-- Identité : lue UNIQUEMENT dans le jeton (kind='intervenant', claim
-- intervenant_id, émis par portal-login). Aucun paramètre : impossible de
-- demander les missions d'un autre (IDOR).
--
-- Le jeton dure 2 h, mais l'accès est revérifié À CHAQUE APPEL : relation
-- archivée, fiche supprimée, code retiré ou expiré => résultat vide aussitôt.
--
-- Actions (P2) : l'intervenant accepte puis démarre SA mission. Chaque action :
--   · vérifie que la mission lui appartient (sinon « Mission introuvable ») ;
--   · applique la table de transitions de l'ERP (envoyée → acceptée → en cours) ;
--   · modifie la ligne par fusion de champs précis (statut, acceptation,
--     _modifie), JAMAIS un remplacement complet, et par comparaison atomique
--     du statut attendu : un double clic ou une modification simultanée par
--     le personnel ne passe pas deux fois ;
--   · écrit l'événement au journal (source « prestataire »), au format de
--     l'ERP : le responsable est notifié comme pour une action saisie dans l'ERP.
--
-- NB Dashboard Supabase : « select … into variable » y est pris pour une
-- création de table. La fonction utilise donc des affectations
-- « v := (select …) ». Coller le fichier ENTIER (jusqu'à « grant execute »).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Contrôle d'accès commun ────────────────────────────────────────────────
-- Renvoie {id, nom} si le jeton est celui d'un intervenant dont l'accès est
-- toujours valable ; NULL sinon. Interne : non appelable par les utilisateurs.
create or replace function public.fc__intervenant_courant()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_id  text := auth.jwt() ->> 'intervenant_id';
  v_i   jsonb;
  v_exp timestamptz;
begin
  if coalesce(auth.jwt() ->> 'kind', '') <> 'intervenant' or coalesce(v_id, '') = '' then
    return null;
  end if;

  v_i := (select data from public.pi_intervenants_fonciers where id = v_id);

  begin
    v_exp := (v_i ->> 'code_expiration')::timestamptz;
  exception when others then
    v_exp := null;   -- date illisible : même comportement que portal-login (jamais « expiré »)
  end;

  -- Relation active, fiche non supprimée, code présent et non expiré.
  if v_i is null
     or coalesce(v_i ->> 'statut_relation', '') <> 'actif'
     or coalesce(v_i ->> '_deleted', '') = 'true'
     or coalesce(v_i ->> 'code_acces_hash', '') = ''
     or (v_exp is not null and v_exp < now())
     or exists (select 1 from public.pi_suppressions s where s.id = 'ts::intervenants_fonciers::' || v_id)
  then
    return null;
  end if;

  return jsonb_build_object('id', v_id, 'nom', coalesce(v_i ->> 'nom_organisation', v_id));
end
$fn$;

revoke all on function public.fc__intervenant_courant() from public, anon, authenticated;

-- ── Lecture : ses missions ─────────────────────────────────────────────────
create or replace function public.fc_vue_intervenant()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_id       text := auth.jwt() ->> 'intervenant_id';
  v_missions jsonb;
begin
  if public.fc__intervenant_courant() is null then
    return jsonb_build_object('intervenant_id', v_id, 'missions', '[]'::jsonb);
  end if;

  v_missions := (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id',          m.id,
        'reference',   m.data ->> 'reference',
        'titre',       m.data ->> 'titre',
        'description', m.data ->> 'description',
        'statut',      m.data ->> 'statut',
        'echeance',    m.data ->> 'echeance',
        'dossier', jsonb_build_object(
          'reference', d.data ->> 'reference',
          'parcelle',  case when p.id is null then coalesce(d.data ->> 'parcelle_id', '—')
                            else coalesce(nullif(p.data ->> 'ref', ''), p.id)
                                 || case when coalesce(p.data ->> 'localisation', '') <> ''
                                         then ' — ' || (p.data ->> 'localisation') else '' end end),
        -- Étapes du périmètre de la mission, dans l'ordre du dossier.
        'etapes', (
          select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                   'code', e.val ->> 'code', 'libelle', e.val ->> 'libelle',
                   'statut', e.val ->> 'statut', 'date_cible', e.val -> 'date_cible')) order by e.ord), '[]'::jsonb)
          from jsonb_array_elements(coalesce(d.data -> 'etapes', '[]'::jsonb)) with ordinality as e(val, ord)
          where (e.val ->> 'code') in (select jsonb_array_elements_text(coalesce(m.data -> 'perimetre' -> 'etapes', '[]'::jsonb)))),
        -- Livrables et versions : l'historique complet, jamais effacé.
        'livrables', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'id', l.val ->> 'id',
                   'libelle', l.val ->> 'libelle',
                   'versions', (
                     select coalesce(jsonb_agg(jsonb_build_object(
                              'numero', ver.val -> 'numero',
                              'statut', ver.val ->> 'statut',
                              'date',   ver.val ->> 'date',
                              'refus',  case when jsonb_typeof(ver.val -> 'refus') = 'object'
                                             then jsonb_strip_nulls(jsonb_build_object(
                                                    'motif', ver.val -> 'refus' ->> 'motif',
                                                    'elements', ver.val -> 'refus' ->> 'elements',
                                                    'delai', ver.val -> 'refus' ->> 'delai'))
                                             else 'null'::jsonb end) order by ver.ord), '[]'::jsonb)
                     from jsonb_array_elements(coalesce(l.val -> 'versions', '[]'::jsonb)) with ordinality as ver(val, ord))
                 ) order by l.ord), '[]'::jsonb)
          from jsonb_array_elements(coalesce(m.data -> 'livrables', '[]'::jsonb)) with ordinality as l(val, ord))
      ) order by m.data ->> 'echeance', m.data ->> 'reference'), '[]'::jsonb)
    from public.pi_missions_foncieres m
    join public.pi_dossiers_fonciers d on d.id = m.data ->> 'dossier_id'
    left join public.pi_parcelles p on p.id = d.data ->> 'parcelle_id'
    where m.data ->> 'intervenant_id' = v_id
      and coalesce(m.data ->> 'statut', '') not in ('brouillon', 'annulee')
  );

  return jsonb_build_object('intervenant_id', v_id, 'missions', v_missions);
end
$fn$;

-- ── Actions : accepter, démarrer ───────────────────────────────────────────
-- Cœur commun. p_de = statut attendu, p_vers = nouveau statut.
create or replace function public.fc__intervenant_changer_statut(p_mission text, p_de text, p_vers text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_c     jsonb := public.fc__intervenant_courant();
  v_m     jsonb;
  v_n     int;
  v_now   timestamptz := now();
  v_iso   text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_lib   jsonb := '{"envoyee":"Envoyée","acceptee":"Acceptée","en_cours":"En cours","attente_informations":"En attente d''informations","livrable_soumis":"Livrable soumis","en_verification":"En vérification","a_corriger":"À corriger","validee":"Validée","cloturee":"Clôturée"}';
  v_set   jsonb;
  v_eid   text := replace(gen_random_uuid()::text, '-', '');
begin
  if v_c is null then
    return jsonb_build_object('ok', false, 'erreur', 'Accès au portail non valide : reconnectez-vous.');
  end if;
  if p_mission is null or length(p_mission) > 64 then
    return jsonb_build_object('ok', false, 'erreur', 'Mission introuvable.');
  end if;

  v_m := (select data from public.pi_missions_foncieres
          where id = p_mission and data ->> 'intervenant_id' = v_c ->> 'id');
  if v_m is null
     or coalesce(v_m ->> 'statut', '') in ('brouillon', 'annulee')
     or not exists (select 1 from public.pi_dossiers_fonciers d where d.id = v_m ->> 'dossier_id')
  then
    return jsonb_build_object('ok', false, 'erreur', 'Mission introuvable.');
  end if;

  if v_m ->> 'statut' <> p_de then
    return jsonb_build_object('ok', false, 'erreur',
      'Passage impossible : ' || coalesce(v_lib ->> (v_m ->> 'statut'), v_m ->> 'statut') || ' → ' || (v_lib ->> p_vers) || '.');
  end if;

  v_set := jsonb_build_object('statut', p_vers, '_modifie', v_iso);
  if p_vers = 'acceptee' then
    v_set := v_set || jsonb_build_object('acceptation', jsonb_build_object(
      'reference', 'Portail intervenants',
      'date', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD'),
      'enregistre_par', v_c ->> 'nom'));
  end if;

  -- Comparaison atomique du statut attendu : une seule des deux requêtes simultanées aboutit.
  update public.pi_missions_foncieres
     set data = data || v_set, updated_at = v_now
   where id = p_mission
     and data ->> 'intervenant_id' = v_c ->> 'id'
     and data ->> 'statut' = p_de;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'erreur', 'La mission vient d''être modifiée : actualisez la page.');
  end if;

  -- Journal (ajout seul), même format que fcEvenement() de l'ERP.
  insert into public.pi_evenements_fonciers(id, data, updated_at)
  values (
    v_eid,
    jsonb_build_object(
      'id', v_eid, 'dossier_id', v_m ->> 'dossier_id', 'etape_code', coalesce(v_m ->> 'etape_code', ''),
      'type', 'mission_statut',
      'description', (v_m ->> 'reference') || ' : ' || (v_lib ->> p_de) || ' → ' || (v_lib ->> p_vers),
      'ancien', p_de, 'nouveau', p_vers, 'source', 'prestataire',
      'source_ref', case when p_vers = 'acceptee' then 'Portail intervenants' else '' end,
      'motif', '', 'acteur', v_c ->> 'nom', 'acteur_id', v_c ->> 'id', 'acteur_role', 'intervenant',
      'date', v_iso, 'mission_id', p_mission),
    v_now);
  return jsonb_build_object('ok', true, 'statut', p_vers);
end
$fn$;

create or replace function public.fc_intervenant_accepter(p_mission text)
returns jsonb language sql security definer set search_path = ''
as $fn$ select public.fc__intervenant_changer_statut(p_mission, 'envoyee', 'acceptee') $fn$;

create or replace function public.fc_intervenant_demarrer(p_mission text)
returns jsonb language sql security definer set search_path = ''
as $fn$ select public.fc__intervenant_changer_statut(p_mission, 'acceptee', 'en_cours') $fn$;

revoke all on function public.fc__intervenant_changer_statut(text, text, text) from public, anon, authenticated;
revoke all on function public.fc_intervenant_accepter(text) from public, anon;
revoke all on function public.fc_intervenant_demarrer(text) from public, anon;
grant execute on function public.fc_intervenant_accepter(text) to authenticated;
grant execute on function public.fc_intervenant_demarrer(text) to authenticated;

-- Réservée aux utilisateurs connectés ; sans jeton « intervenant » le résultat est vide.
revoke all on function public.fc_vue_intervenant() from public, anon;
grant execute on function public.fc_vue_intervenant() to authenticated;
