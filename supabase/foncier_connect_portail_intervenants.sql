-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — portail intervenants (P1-P4) : fc_vue_intervenant(),
-- accepter, démarrer, déposer un livrable, soumettre, demander des informations, reprendre, messagerie
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
-- Actions (P2-P3) : l'intervenant accepte, démarre, dépose ses livrables (référence
-- et note : pas de fichier), les soumet à vérification, demande des informations
-- ou reprend. Validation, refus et clôture restent côté ERP. Chaque action :
--   · vérifie que la mission lui appartient (sinon « Mission introuvable ») ;
--   · applique la table de transitions de l'ERP (envoyée → acceptée → en cours) ;
--   · modifie la ligne par fusion de champs précis (statut, acceptation,
--     _modifie), JAMAIS un remplacement complet, et par comparaison atomique
--     du statut attendu : un double clic ou une modification simultanée par
--     le personnel ne passe pas deux fois ;
--   · écrit l'événement au journal (source « prestataire »), au format de
--     l'ERP : le responsable est notifié comme pour une action saisie dans l'ERP ;
--   · ne peut jamais effacer l'historique : un dépôt AJOUTE une version, et un
--     garde-fou (trigger) rétablit toute version qu'un poste ERP périmé aurait
--     omise en réécrivant la mission.
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
                     select coalesce(jsonb_agg(
                              jsonb_strip_nulls(jsonb_build_object(
                                'numero', ver.val -> 'numero',
                                'statut', ver.val ->> 'statut',
                                'date',   ver.val ->> 'date',
                                'reference', ver.val ->> 'reference',
                                'note',   ver.val ->> 'note'))
                              || jsonb_build_object('refus', case when jsonb_typeof(ver.val -> 'refus') = 'object'
                                             then jsonb_strip_nulls(jsonb_build_object(
                                                    'motif', ver.val -> 'refus' ->> 'motif',
                                                    'elements', ver.val -> 'refus' ->> 'elements',
                                                    'delai', ver.val -> 'refus' ->> 'delai'))
                                             else 'null'::jsonb end) order by ver.ord), '[]'::jsonb)
                     from jsonb_array_elements(coalesce(l.val -> 'versions', '[]'::jsonb)) with ordinality as ver(val, ord))
                 ) order by l.ord), '[]'::jsonb)
          from jsonb_array_elements(coalesce(m.data -> 'livrables', '[]'::jsonb)) with ordinality as l(val, ord)),
        -- Messagerie de la mission : texte seul ; le personnel est toujours présenté comme « Promoteur ».
        'messages', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'id', x.val ->> 'id', 'date', x.val ->> 'date', 'de', x.val ->> 'de',
                   'auteur', case when x.val ->> 'de' = 'intervenant' then coalesce(x.val ->> 'auteur', '') else 'Promoteur' end,
                   'texte', x.val ->> 'texte', 'lu', (x.val ->> 'lu_le') is not null)
                 order by x.val ->> 'date', x.val ->> 'id'), '[]'::jsonb)
          from jsonb_array_elements(case when jsonb_typeof(m.data -> 'messages') = 'array' then m.data -> 'messages' else '[]'::jsonb end) as x(val))
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

-- ── Actions sur la mission ─────────────────────────────────────────────────
-- Cœur commun. p_de = statuts d'origine autorisés, p_vers = nouveau statut, p_motif = note éventuelle.
-- (L'ancienne signature à 3 arguments est retirée : elle n'acceptait qu'un seul statut d'origine.)
drop function if exists public.fc__intervenant_changer_statut(text, text, text);

create or replace function public.fc__intervenant_changer_statut(p_mission text, p_de text[], p_vers text, p_motif text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_c     jsonb := public.fc__intervenant_courant();
  v_m     jsonb;
  v_ancien text;
  v_n     int;
  v_now   timestamptz := now();
  v_iso   text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_lib   jsonb := '{"envoyee":"Envoyée","acceptee":"Acceptée","en_cours":"En cours","attente_informations":"En attente d''informations","livrable_soumis":"Livrable soumis","en_verification":"En vérification","a_corriger":"À corriger","validee":"Validée","cloturee":"Clôturée"}';
  v_set   jsonb;
  v_eid   text := replace(gen_random_uuid()::text, '-', '');
  v_motif text := btrim(coalesce(p_motif, ''));
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

  v_ancien := v_m ->> 'statut';
  if not (v_ancien = any (p_de)) then
    return jsonb_build_object('ok', false, 'erreur',
      'Passage impossible : ' || coalesce(v_lib ->> v_ancien, v_ancien) || ' → ' || (v_lib ->> p_vers) || '.');
  end if;

  -- Soumettre : au moins un livrable dont la dernière version attend la vérification (règle de l'ERP).
  if p_vers = 'livrable_soumis' and not exists (
       select 1 from jsonb_array_elements(coalesce(v_m -> 'livrables', '[]'::jsonb)) l
       where ((l -> 'versions') -> (-1)) ->> 'statut' = 'soumis') then
    return jsonb_build_object('ok', false, 'erreur', 'Aucun livrable soumis : déposez une version avant.');
  end if;
  -- Demander des informations : dire lesquelles.
  if p_vers = 'attente_informations' then
    if v_motif = '' then
      return jsonb_build_object('ok', false, 'erreur', 'Indiquez les informations dont vous avez besoin.');
    end if;
    if length(v_motif) > 1000 then
      return jsonb_build_object('ok', false, 'erreur', 'Texte trop long (1000 caractères au plus).');
    end if;
  end if;

  v_set := jsonb_build_object('statut', p_vers, '_modifie', v_iso);
  if p_vers = 'acceptee' then
    v_set := v_set || jsonb_build_object('acceptation', jsonb_build_object(
      'reference', 'Portail intervenants',
      'date', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD'),
      'enregistre_par', v_c ->> 'nom'));
  end if;

  -- Comparaison atomique du statut lu : une seule des deux requêtes simultanées aboutit.
  update public.pi_missions_foncieres
     set data = data || v_set, updated_at = v_now
   where id = p_mission
     and data ->> 'intervenant_id' = v_c ->> 'id'
     and data ->> 'statut' = v_ancien;
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
      'description', (v_m ->> 'reference') || ' : ' || (v_lib ->> v_ancien) || ' → ' || (v_lib ->> p_vers),
      'ancien', v_ancien, 'nouveau', p_vers, 'source', 'prestataire',
      'source_ref', case when p_vers = 'acceptee' then 'Portail intervenants' else '' end,
      'motif', v_motif, 'acteur', v_c ->> 'nom', 'acteur_id', v_c ->> 'id', 'acteur_role', 'intervenant',
      'date', v_iso, 'mission_id', p_mission),
    v_now);
  return jsonb_build_object('ok', true, 'statut', p_vers);
end
$fn$;

create or replace function public.fc_intervenant_accepter(p_mission text)
returns jsonb language sql security definer set search_path = ''
as $fn$ select public.fc__intervenant_changer_statut(p_mission, array['envoyee'], 'acceptee') $fn$;

create or replace function public.fc_intervenant_demarrer(p_mission text)
returns jsonb language sql security definer set search_path = ''
as $fn$ select public.fc__intervenant_changer_statut(p_mission, array['acceptee'], 'en_cours') $fn$;

create or replace function public.fc_intervenant_soumettre(p_mission text)
returns jsonb language sql security definer set search_path = ''
as $fn$ select public.fc__intervenant_changer_statut(p_mission, array['en_cours', 'a_corriger'], 'livrable_soumis') $fn$;

create or replace function public.fc_intervenant_demander_info(p_mission text, p_note text)
returns jsonb language sql security definer set search_path = ''
as $fn$ select public.fc__intervenant_changer_statut(p_mission, array['en_cours', 'a_corriger'], 'attente_informations', p_note) $fn$;

create or replace function public.fc_intervenant_reprendre(p_mission text)
returns jsonb language sql security definer set search_path = ''
as $fn$ select public.fc__intervenant_changer_statut(p_mission, array['attente_informations'], 'en_cours') $fn$;

-- ── Dépôt d'un livrable : une NOUVELLE version, l'ancienne n'est jamais effacée ──
-- Même règles que fcSoumettreLivrable() : mission « en cours » ou « à corriger », une référence ou une
-- description, pas de dépôt tant qu'une version attend la vérification. Ajout par chemin précis, avec
-- comparaison du statut ET du nombre de versions : un double clic ne crée pas deux versions.
create or replace function public.fc_intervenant_deposer(p_mission text, p_livrable text, p_reference text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_c     jsonb := public.fc__intervenant_courant();
  v_m     jsonb;
  v_l     jsonb;
  v_idx   int;
  v_nb    int;
  v_ref   text := btrim(coalesce(p_reference, ''));
  v_note  text := btrim(coalesce(p_note, ''));
  v_ver   jsonb;
  v_n     int;
  v_now   timestamptz := now();
  v_iso   text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_lib   jsonb := '{"envoyee":"Envoyée","acceptee":"Acceptée","en_cours":"En cours","attente_informations":"En attente d''informations","livrable_soumis":"Livrable soumis","en_verification":"En vérification","a_corriger":"À corriger","validee":"Validée","cloturee":"Clôturée"}';
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

  if (v_m ->> 'statut') not in ('en_cours', 'a_corriger') then
    return jsonb_build_object('ok', false, 'erreur',
      'Dépôt impossible : la mission est « ' || coalesce(v_lib ->> (v_m ->> 'statut'), v_m ->> 'statut') || ' ».');
  end if;

  if p_livrable is null or length(p_livrable) > 64 then
    return jsonb_build_object('ok', false, 'erreur', 'Livrable introuvable.');
  end if;
  v_idx := (select t.ord::int from jsonb_array_elements(coalesce(v_m -> 'livrables', '[]'::jsonb)) with ordinality as t(val, ord)
            where t.val ->> 'id' = p_livrable);
  if v_idx is null then
    return jsonb_build_object('ok', false, 'erreur', 'Livrable introuvable.');
  end if;
  v_l := (v_m -> 'livrables') -> (v_idx - 1);

  if v_ref = '' and v_note = '' then
    return jsonb_build_object('ok', false, 'erreur', 'Indiquez une référence de fichier ou une description.');
  end if;
  if length(v_ref) > 300 or length(v_note) > 2000 then
    return jsonb_build_object('ok', false, 'erreur', 'Texte trop long (référence : 300 caractères, description : 2000).');
  end if;

  v_nb := jsonb_array_length(coalesce(v_l -> 'versions', '[]'::jsonb));
  if v_nb > 0 and (((v_l -> 'versions') -> (v_nb - 1)) ->> 'statut') = 'soumis' then
    return jsonb_build_object('ok', false, 'erreur', 'Une version est déjà en attente de vérification.');
  end if;

  v_ver := jsonb_build_object('numero', v_nb + 1, 'reference', v_ref, 'note', v_note,
                              'date', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD'),
                              'depose_par', v_c ->> 'nom', 'statut', 'soumis', 'refus', 'null'::jsonb);

  update public.pi_missions_foncieres
     set data = jsonb_set(
                  jsonb_set(data, array['livrables', (v_idx - 1)::text, 'versions'],
                            coalesce(data -> 'livrables' -> (v_idx - 1) -> 'versions', '[]'::jsonb) || jsonb_build_array(v_ver)),
                  '{_modifie}', to_jsonb(v_iso)),
         updated_at = v_now
   where id = p_mission
     and data ->> 'intervenant_id' = v_c ->> 'id'
     and data ->> 'statut' = v_m ->> 'statut'
     and data -> 'livrables' -> (v_idx - 1) ->> 'id' = p_livrable
     and jsonb_array_length(coalesce(data -> 'livrables' -> (v_idx - 1) -> 'versions', '[]'::jsonb)) = v_nb;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'erreur', 'La mission vient d''être modifiée : actualisez la page.');
  end if;

  insert into public.pi_evenements_fonciers(id, data, updated_at)
  values (
    v_eid,
    jsonb_build_object(
      'id', v_eid, 'dossier_id', v_m ->> 'dossier_id', 'etape_code', coalesce(v_m ->> 'etape_code', ''),
      'type', 'livrable_depose',
      'description', (v_m ->> 'reference') || ' — « ' || (v_l ->> 'libelle') || ' » : version ' || (v_nb + 1) || ' déposée',
      'ancien', '', 'nouveau', '', 'source', 'prestataire', 'source_ref', v_ref,
      'motif', '', 'acteur', v_c ->> 'nom', 'acteur_id', v_c ->> 'id', 'acteur_role', 'intervenant',
      'date', v_iso, 'mission_id', p_mission),
    v_now);
  return jsonb_build_object('ok', true, 'version', v_nb + 1);
end
$fn$;

-- ── Messagerie : un fil par mission, texte seul ────────────────────────────
-- Écriture par ajout à un chemin précis, avec comparaison du nombre de messages : un double clic ne
-- crée pas deux messages. Mission clôturée : lecture seule. 500 messages au plus par mission,
-- 10 messages par minute au plus par intervenant.
create or replace function public.fc_intervenant_envoyer_message(p_mission text, p_texte text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_c     jsonb := public.fc__intervenant_courant();
  v_m     jsonb;
  v_txt   text := btrim(coalesce(p_texte, ''));
  v_msgs  jsonb;
  v_nb    int;
  v_n     int;
  v_now   timestamptz := now();
  v_iso   text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_mid   text := replace(gen_random_uuid()::text, '-', '');
  v_eid   text := replace(gen_random_uuid()::text, '-', '');
  v_recent int;
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
  if (v_m ->> 'statut') = 'cloturee' then
    return jsonb_build_object('ok', false, 'erreur', 'Mission clôturée : la messagerie est en lecture seule.');
  end if;
  if v_txt = '' then
    return jsonb_build_object('ok', false, 'erreur', 'Écrivez un message.');
  end if;
  if length(v_txt) > 2000 then
    return jsonb_build_object('ok', false, 'erreur', 'Message trop long (2000 caractères au plus).');
  end if;

  v_msgs := case when jsonb_typeof(v_m -> 'messages') = 'array' then v_m -> 'messages' else '[]'::jsonb end;
  v_nb := jsonb_array_length(v_msgs);
  if v_nb >= 500 then
    return jsonb_build_object('ok', false, 'erreur', 'Limite de messages atteinte pour cette mission.');
  end if;

  -- Antispam : 10 messages par minute et par intervenant, toutes missions confondues.
  v_recent := (select count(*) from public.pi_missions_foncieres mm,
                      jsonb_array_elements(case when jsonb_typeof(mm.data -> 'messages') = 'array' then mm.data -> 'messages' else '[]'::jsonb end) x
               where mm.data ->> 'intervenant_id' = v_c ->> 'id'
                 and x ->> 'de' = 'intervenant'
                 and (x ->> 'date') > to_char((v_now - interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  if v_recent >= 10 then
    return jsonb_build_object('ok', false, 'erreur', 'Trop de messages : patientez une minute.');
  end if;

  update public.pi_missions_foncieres
     set data = jsonb_set(
                  jsonb_set(data, '{messages}',
                            case when jsonb_typeof(data -> 'messages') = 'array' then data -> 'messages' else '[]'::jsonb end
                            || jsonb_build_array(jsonb_build_object('id', v_mid, 'date', v_iso, 'de', 'intervenant',
                                                                    'auteur', v_c ->> 'nom', 'texte', v_txt))),
                  '{_modifie}', to_jsonb(v_iso)),
         updated_at = v_now
   where id = p_mission
     and data ->> 'intervenant_id' = v_c ->> 'id'
     and data ->> 'statut' = v_m ->> 'statut'
     and jsonb_array_length(case when jsonb_typeof(data -> 'messages') = 'array' then data -> 'messages' else '[]'::jsonb end) = v_nb;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'erreur', 'La mission vient d''être modifiée : réessayez.');
  end if;

  insert into public.pi_evenements_fonciers(id, data, updated_at)
  values (
    v_eid,
    jsonb_build_object(
      'id', v_eid, 'dossier_id', v_m ->> 'dossier_id', 'etape_code', coalesce(v_m ->> 'etape_code', ''),
      'type', 'message_intervenant',
      'description', (v_m ->> 'reference') || ' : message de ' || (v_c ->> 'nom'),
      'ancien', '', 'nouveau', '', 'source', 'prestataire', 'source_ref', v_mid,
      'motif', left(v_txt, 200), 'acteur', v_c ->> 'nom', 'acteur_id', v_c ->> 'id', 'acteur_role', 'intervenant',
      'date', v_iso, 'mission_id', p_mission),
    v_now);
  return jsonb_build_object('ok', true, 'id', v_mid);
end
$fn$;

-- L'intervenant marque lus les messages du promoteur (sans toucher à _modifie : pas de faux conflit côté ERP).
create or replace function public.fc_intervenant_marquer_lu(p_mission text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_c   jsonb := public.fc__intervenant_courant();
  v_iso text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_n   int;
begin
  if v_c is null then
    return jsonb_build_object('ok', false, 'erreur', 'Accès au portail non valide : reconnectez-vous.');
  end if;
  if p_mission is null or length(p_mission) > 64 then
    return jsonb_build_object('ok', false, 'erreur', 'Mission introuvable.');
  end if;
  update public.pi_missions_foncieres
     set data = jsonb_set(data, '{messages}', (
           select jsonb_agg(case when x.val ->> 'de' = 'promoteur' and x.val ->> 'lu_le' is null
                                 then x.val || jsonb_build_object('lu_le', v_iso) else x.val end order by x.ord)
           from jsonb_array_elements(data -> 'messages') with ordinality as x(val, ord)))
   where id = p_mission
     and data ->> 'intervenant_id' = v_c ->> 'id'
     and coalesce(data ->> 'statut', '') not in ('brouillon', 'annulee')
     and jsonb_typeof(data -> 'messages') = 'array'
     and exists (select 1 from jsonb_array_elements(data -> 'messages') y
                 where y ->> 'de' = 'promoteur' and y ->> 'lu_le' is null);
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'marques', v_n);
end
$fn$;

-- ── Garde-fou : une écriture de l'ERP ne peut pas faire disparaître une version ──
-- Une mission est une seule ligne, réécrite en entier par l'ERP à chaque modification. Un poste resté
-- hors ligne peut donc renvoyer une copie qui ignore un dépôt fait entre-temps depuis le portail.
-- Ce trigger réintègre, livrable par livrable, toute version (par son numéro) présente dans l'ancienne
-- ligne et absente de la nouvelle ; en cas de doublon, la version de la nouvelle ligne prévaut
-- (validation ou refus faits par le personnel). Il ne bloque jamais l'écriture : au moindre doute il
-- laisse passer la ligne telle quelle.
create or replace function public.fc__missions_garde_versions()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  begin
    if jsonb_typeof(old.data -> 'livrables') = 'array' and jsonb_typeof(new.data -> 'livrables') = 'array' then
      new.data := jsonb_set(new.data, '{livrables}', (
        select coalesce(jsonb_agg(m.val order by m.ord), '[]'::jsonb)
        from (
          select nl.ord,
                 case when ol.val is null then nl.val
                      else jsonb_set(nl.val, '{versions}', coalesce((
                             select jsonb_agg(x.v order by (x.v ->> 'numero')::numeric)
                             from (select distinct on (u.v ->> 'numero') u.v
                                   from (select e.v, 1 as pr from jsonb_array_elements(coalesce(nl.val -> 'versions', '[]'::jsonb)) as e(v)
                                         union all
                                         select e.v, 2 as pr from jsonb_array_elements(coalesce(ol.val -> 'versions', '[]'::jsonb)) as e(v)) u
                                   order by u.v ->> 'numero', u.pr) x), '[]'::jsonb)) end as val
          from jsonb_array_elements(new.data -> 'livrables') with ordinality as nl(val, ord)
          left join jsonb_array_elements(old.data -> 'livrables') as ol(val) on ol.val ->> 'id' = nl.val ->> 'id'
          union all
          select 1000000 + o2.ord, o2.val
          from jsonb_array_elements(old.data -> 'livrables') with ordinality as o2(val, ord)
          where not exists (select 1 from jsonb_array_elements(new.data -> 'livrables') as n2(val) where n2.val ->> 'id' = o2.val ->> 'id')
        ) m));
    end if;
  exception when others then
    null;   -- jamais bloquant
  end;
  -- Messagerie : même principe, par identifiant de message (la ligne nouvelle prévaut en cas de doublon).
  begin
    if jsonb_typeof(old.data -> 'messages') = 'array' and jsonb_array_length(old.data -> 'messages') > 0 then
      new.data := jsonb_set(new.data, '{messages}', (
        select coalesce(jsonb_agg(x.v order by x.v ->> 'date', x.v ->> 'id'), '[]'::jsonb)
        from (select distinct on (u.v ->> 'id') u.v
              from (select e.v, 1 as pr from jsonb_array_elements(case when jsonb_typeof(new.data -> 'messages') = 'array' then new.data -> 'messages' else '[]'::jsonb end) as e(v)
                    union all
                    select e.v, 2 as pr from jsonb_array_elements(old.data -> 'messages') as e(v)) u
              order by u.v ->> 'id', u.pr) x));
    end if;
  exception when others then
    null;
  end;
  return new;
end
$fn$;

drop trigger if exists fc_missions_garde_versions on public.pi_missions_foncieres;
create trigger fc_missions_garde_versions
  before update on public.pi_missions_foncieres
  for each row when (old.data is distinct from new.data)
  execute function public.fc__missions_garde_versions();

revoke all on function public.fc__intervenant_changer_statut(text, text[], text, text) from public, anon, authenticated;
revoke all on function public.fc__missions_garde_versions() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['fc_intervenant_accepter(text)', 'fc_intervenant_demarrer(text)', 'fc_intervenant_soumettre(text)',
                           'fc_intervenant_demander_info(text, text)', 'fc_intervenant_reprendre(text)',
                           'fc_intervenant_deposer(text, text, text, text)',
                           'fc_intervenant_envoyer_message(text, text)', 'fc_intervenant_marquer_lu(text)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end$$;

-- Réservée aux utilisateurs connectés ; sans jeton « intervenant » le résultat est vide.
revoke all on function public.fc_vue_intervenant() from public, anon;
grant execute on function public.fc_vue_intervenant() to authenticated;
