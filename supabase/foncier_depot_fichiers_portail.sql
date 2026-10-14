-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — DÉPÔT DE FICHIERS depuis le portail (souscripteur : pièce demandée ; intervenant : livrable).
-- À exécuter sur le projet Supabase de Zahara ET sur celui de Menco, après foncier_connect_portail_intervenants.sql et
-- foncier_transmission_notaire.sql (fc__client_parcelles), avec le bucket de foncier_pieces_stockage.sql. Idempotent.
--
-- Principe : ni le souscripteur ni l'intervenant n'ont aucun droit direct sur le stockage ni sur les tables. L'Edge Function
-- fc-portail-fichier (clé de service) envoie le fichier ; ces fonctions décident, avec le JETON du déposant :
--   1. fc_depot_preparer  : contrôle des droits AVANT l'envoi (dossier du souscripteur, étape publiée avec dépôt ouvert, 10 pièces au plus ;
--                           mission de l'intervenant en cours / à corriger, livrable existant, aucune version en attente) → identifiant et chemin de la pièce ;
--   2. fc_depot_valider   : après l'envoi, REvérifie tout puis enregistre la pièce (statut « à vérifier » pour un souscripteur) et le journal.
--                           Livrable : passe par fc_intervenant_deposer (même règles que le dépôt par référence) puis relie la version au fichier ;
--   3. fc_vue_souscripteur_pieces / fc_portail_piece_chemin : ce que le souscripteur voit de ses pièces et des documents publiés pour lui.
-- Identité lue UNIQUEMENT dans le jeton. Pièces « restreintes » jamais visibles. Rien n'est supprimé.
-- ═══════════════════════════════════════════════════════════════════════════
-- Le dossier appartient-il au souscripteur ? (parcelle d'un de ses lots ; dossier individuel : il doit en être titulaire).
-- Jamais NULL : une donnée absente = refus (une comparaison NULL ne doit pas laisser passer).
create or replace function public.fc__dossier_du_client(p_d jsonb, p_cid text, p_c jsonb)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select coalesce((p_d ->> 'parcelle_id') = any (public.fc__client_parcelles(p_c)), false)
     and (coalesce(p_d ->> 'niveau', 'global') <> 'individuel'
          or coalesce((p_d -> 'client_ids') ? p_cid, false) or coalesce((p_d ->> 'client_id') = p_cid, false))
$fn$;

create or replace function public.fc__depot_controle(p_cible jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_kind  text := coalesce(p_cible ->> 'kind', '');
  v_refus constant jsonb := jsonb_build_object('ok', false, 'erreur', 'Dépôt non autorisé.');
  v_cid   text;
  v_c     jsonb;
  v_d     jsonb;
  v_e     jsonb;
  v_dos   text;
  v_n     int;
  v_i     jsonb;
  v_m     jsonb;
  v_l     jsonb;
  v_nbv   int;
begin
  if v_kind = 'souscripteur' then
    if coalesce(auth.jwt() ->> 'kind', '') <> 'souscripteur' then return v_refus; end if;
    v_cid := auth.jwt() ->> 'client_id';
    if coalesce(v_cid, '') = '' then return v_refus; end if;
    v_c := (select data from public.pi_clients where id = v_cid and coalesce(data ->> '_deleted', '') <> 'true');
    if v_c is null then return v_refus; end if;
    v_dos := p_cible ->> 'dossier_id';
    if coalesce(v_dos, '') = '' or length(v_dos) > 64 then return v_refus; end if;
    v_d := (select data from public.pi_dossiers_fonciers where id = v_dos);
    if v_d is null or not public.fc__dossier_du_client(v_d, v_cid, v_c) then return v_refus; end if;
    if coalesce(v_d ->> 'statut', '') in ('cloture', 'annule') then
      return jsonb_build_object('ok', false, 'erreur', 'Ce dossier est clos : dépôt impossible.');
    end if;
    v_e := (select e.val from jsonb_array_elements(coalesce(v_d -> 'etapes', '[]'::jsonb)) as e(val) where e.val ->> 'code' = p_cible ->> 'etape_code' limit 1);
    if v_e is null or v_e ->> 'visibilite' <> 'souscripteur' or coalesce(v_e -> 'depot_souscripteur' ->> 'ouvert', '') <> 'true' then
      return jsonb_build_object('ok', false, 'erreur', 'Aucune pièce n''est demandée sur cette étape.');
    end if;
    v_n := (select count(*) from public.pi_pieces_foncieres p
            where p.data ->> 'dossier_id' = v_dos and p.data ->> 'etape_code' = v_e ->> 'code' and p.data ->> 'client_id' = v_cid
              and coalesce(p.data ->> 'retire', '') <> 'true' and coalesce(p.data ->> 'remplacee_par', '') = '');
    if v_n >= 10 then
      return jsonb_build_object('ok', false, 'erreur', 'Nombre maximal de pièces atteint pour cette étape.');
    end if;
    return jsonb_build_object('ok', true, 'kind', 'souscripteur', 'dossier_id', v_dos, 'etape_code', v_e ->> 'code', 'etape_lib', v_e ->> 'libelle',
      'dossier_ref', v_d ->> 'reference', 'client_id', v_cid, 'nom', coalesce(v_c ->> 'nom', ''),
      'categorie', coalesce(nullif(v_e -> 'depot_souscripteur' ->> 'categorie', ''), 'autre'));

  elsif v_kind = 'livrable' then
    v_i := public.fc__intervenant_courant();
    if v_i is null then return v_refus; end if;
    v_m := (select data from public.pi_missions_foncieres where id = p_cible ->> 'mission_id' and data ->> 'intervenant_id' = v_i ->> 'id');
    if v_m is null or coalesce(v_m ->> 'statut', '') in ('brouillon', 'annulee')
       or not exists (select 1 from public.pi_dossiers_fonciers d where d.id = v_m ->> 'dossier_id') then
      return jsonb_build_object('ok', false, 'erreur', 'Mission introuvable.');
    end if;
    if (v_m ->> 'statut') not in ('en_cours', 'a_corriger') then
      return jsonb_build_object('ok', false, 'erreur', 'Dépôt impossible : la mission n''est pas en cours.');
    end if;
    v_l := (select l.val from jsonb_array_elements(coalesce(v_m -> 'livrables', '[]'::jsonb)) as l(val) where l.val ->> 'id' = p_cible ->> 'livrable_id' limit 1);
    if v_l is null then return jsonb_build_object('ok', false, 'erreur', 'Livrable introuvable.'); end if;
    v_nbv := jsonb_array_length(coalesce(v_l -> 'versions', '[]'::jsonb));
    if v_nbv > 0 and (((v_l -> 'versions') -> (v_nbv - 1)) ->> 'statut') = 'soumis' then
      return jsonb_build_object('ok', false, 'erreur', 'Une version est déjà en attente de vérification.');
    end if;
    return jsonb_build_object('ok', true, 'kind', 'livrable', 'dossier_id', v_m ->> 'dossier_id', 'etape_code', coalesce(v_m ->> 'etape_code', ''),
      'mission_id', p_cible ->> 'mission_id', 'livrable_id', p_cible ->> 'livrable_id', 'livrable_lib', v_l ->> 'libelle',
      'mission_ref', v_m ->> 'reference', 'intervenant_id', v_i ->> 'id', 'nom', v_i ->> 'nom');
  end if;
  return v_refus;
end
$fn$;

create or replace function public.fc_depot_preparer(p_cible jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_ctl jsonb := public.fc__depot_controle(p_cible);
  v_pid text := 'pf' || replace(gen_random_uuid()::text, '-', '');
begin
  if not coalesce((v_ctl ->> 'ok')::boolean, false) then return v_ctl; end if;
  return jsonb_build_object('ok', true, 'piece_id', v_pid, 'chemin', (v_ctl ->> 'dossier_id') || '/' || v_pid, 'bucket', 'pieces-foncieres');
end
$fn$;

create or replace function public.fc_depot_valider(p_cible jsonb, p_piece_id text, p_nom text, p_type text, p_taille bigint, p_empreinte text, p_note text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_ctl  jsonb := public.fc__depot_controle(p_cible);
  v_nom  text := left(btrim(regexp_replace(coalesce(p_nom, ''), '[\r\n\t<>]', ' ', 'g')), 160);
  v_note text := left(btrim(coalesce(p_note, '')), 500);
  v_iso  text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_eid  text := replace(gen_random_uuid()::text, '-', '');
  v_chemin text;
  v_rep  jsonb;
  v_idx  int;
  v_nbv  int;
  v_piece jsonb;
begin
  if not coalesce((v_ctl ->> 'ok')::boolean, false) then return v_ctl; end if;
  if p_piece_id is null or p_piece_id !~ '^pf[0-9a-f]{32}$' or v_nom = ''
     or p_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
     or p_taille is null or p_taille < 1 or p_taille > 5242880
     or p_empreinte is null or p_empreinte !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'erreur', 'Fichier invalide (PDF, JPG, PNG ou WebP ; 5 Mo au plus).');
  end if;
  if exists (select 1 from public.pi_pieces_foncieres where id = p_piece_id) then
    return jsonb_build_object('ok', false, 'erreur', 'Dépôt déjà enregistré.');
  end if;
  v_chemin := (v_ctl ->> 'dossier_id') || '/' || p_piece_id;

  if v_ctl ->> 'kind' = 'souscripteur' then
    v_piece := jsonb_build_object('id', p_piece_id, 'dossier_id', v_ctl ->> 'dossier_id', 'etape_code', v_ctl ->> 'etape_code', 'nom', v_nom, 'type', p_type, 'taille', p_taille,
      'chemin', v_chemin, 'bucket', 'pieces-foncieres', 'note', v_note, 'depose_par', jsonb_build_object('role', 'souscripteur', 'id', v_ctl ->> 'client_id', 'nom', v_ctl ->> 'nom'),
      'client_id', v_ctl ->> 'client_id', 'visibilite', 'souscripteur', 'source', '', 'statut', 'a_verifier', 'depose_le', v_iso, 'retire', false, 'retire_motif', '', 'decision_motif', '',
      'categorie', v_ctl ->> 'categorie', 'confidentialite', 'normale', 'expire_le', '', 'organisation', v_ctl ->> 'nom', 'version', 1, 'document_id', p_piece_id, 'remplacee_par', '',
      'empreinte', p_empreinte, 'integrite', '', 'origine', 'portail', '_modifie', v_iso);
    insert into public.pi_pieces_foncieres(id, data, updated_at) values (p_piece_id, v_piece, now());
    insert into public.pi_evenements_fonciers(id, data, updated_at)
    values (v_eid, jsonb_build_object('id', v_eid, 'dossier_id', v_ctl ->> 'dossier_id', 'etape_code', v_ctl ->> 'etape_code', 'type', 'piece_souscripteur',
      'description', 'Pièce déposée par ' || coalesce(nullif(v_ctl ->> 'nom', ''), 'le souscripteur') || ' sur « ' || (v_ctl ->> 'etape_lib') || ' » : ' || v_nom,
      'ancien', '', 'nouveau', '', 'source', 'souscripteur', 'source_ref', p_piece_id, 'motif', '', 'acteur', coalesce(nullif(v_ctl ->> 'nom', ''), 'Souscripteur'), 'acteur_id', '',
      'acteur_role', 'souscripteur', 'date', v_iso), now());
    return jsonb_build_object('ok', true, 'piece_id', p_piece_id);
  end if;

  -- Livrable d'intervenant : mêmes contrôles et même écriture que le dépôt par référence, puis lien version ↔ fichier.
  v_rep := public.fc_intervenant_deposer(p_cible ->> 'mission_id', p_cible ->> 'livrable_id', 'Fichier : ' || v_nom, v_note);
  if not coalesce((v_rep ->> 'ok')::boolean, false) then return v_rep; end if;
  v_idx := (select t.ord::int from public.pi_missions_foncieres m, jsonb_array_elements(coalesce(m.data -> 'livrables', '[]'::jsonb)) with ordinality as t(val, ord)
            where m.id = p_cible ->> 'mission_id' and t.val ->> 'id' = p_cible ->> 'livrable_id');
  v_nbv := (select jsonb_array_length(coalesce(m.data -> 'livrables' -> (v_idx - 1) -> 'versions', '[]'::jsonb)) from public.pi_missions_foncieres m where m.id = p_cible ->> 'mission_id');
  update public.pi_missions_foncieres
     set data = jsonb_set(data, array['livrables', (v_idx - 1)::text, 'versions', (v_nbv - 1)::text],
                          (data -> 'livrables' -> (v_idx - 1) -> 'versions' -> (v_nbv - 1)) || jsonb_build_object('piece_id', p_piece_id, 'empreinte', p_empreinte, 'taille', p_taille)),
         updated_at = now()
   where id = p_cible ->> 'mission_id';
  v_piece := jsonb_build_object('id', p_piece_id, 'dossier_id', v_ctl ->> 'dossier_id', 'etape_code', v_ctl ->> 'etape_code', 'nom', v_nom, 'type', p_type, 'taille', p_taille,
    'chemin', v_chemin, 'bucket', 'pieces-foncieres', 'note', v_note, 'depose_par', jsonb_build_object('role', 'intervenant', 'id', v_ctl ->> 'intervenant_id', 'nom', v_ctl ->> 'nom'),
    'client_id', '', 'visibilite', 'interne', 'source', 'prestataire', 'statut', 'jointe', 'depose_le', v_iso, 'retire', false, 'retire_motif', '',
    'categorie', 'rapport_prestataire', 'confidentialite', 'normale', 'expire_le', '', 'organisation', v_ctl ->> 'nom', 'version', 1, 'document_id', p_piece_id, 'remplacee_par', '',
    'empreinte', p_empreinte, 'integrite', '', 'origine', 'portail', 'mission_id', p_cible ->> 'mission_id', 'livrable_id', p_cible ->> 'livrable_id', '_modifie', v_iso);
  insert into public.pi_pieces_foncieres(id, data, updated_at) values (p_piece_id, v_piece, now());
  return jsonb_build_object('ok', true, 'piece_id', p_piece_id, 'version', v_rep -> 'version');
end
$fn$;

-- Ce que le souscripteur voit : pièces demandées (dépôt ouvert), ses pièces (statut, motif de refus) et les documents publiés pour lui.
create or replace function public.fc_vue_souscripteur_pieces()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_cid text := auth.jwt() ->> 'client_id';
  v_c   jsonb;
begin
  if coalesce(auth.jwt() ->> 'kind', '') <> 'souscripteur' or coalesce(v_cid, '') = '' then
    return jsonb_build_object('demandes', '[]'::jsonb, 'pieces', '[]'::jsonb);
  end if;
  v_c := (select data from public.pi_clients where id = v_cid and coalesce(data ->> '_deleted', '') <> 'true');
  if v_c is null then return jsonb_build_object('demandes', '[]'::jsonb, 'pieces', '[]'::jsonb); end if;

  return jsonb_build_object(
    'demandes', (select coalesce(jsonb_agg(jsonb_build_object('dossier_id', d.id, 'dossier', d.data ->> 'reference', 'etape_code', e.val ->> 'code', 'etape', e.val ->> 'libelle',
                    'demande', e.val -> 'depot_souscripteur' ->> 'libelle') order by d.data ->> 'reference', e.ord), '[]'::jsonb)
                 from public.pi_dossiers_fonciers d
                 cross join lateral jsonb_array_elements(coalesce(d.data -> 'etapes', '[]'::jsonb)) with ordinality as e(val, ord)
                 where (d.data ->> 'parcelle_id') = any (public.fc__client_parcelles(v_c)) and coalesce(d.data ->> 'statut', '') not in ('cloture', 'annule')
                   and (coalesce(d.data ->> 'niveau', 'global') <> 'individuel' or (d.data -> 'client_ids') ? v_cid or (d.data ->> 'client_id') = v_cid)
                   and e.val ->> 'visibilite' = 'souscripteur' and coalesce(e.val -> 'depot_souscripteur' ->> 'ouvert', '') = 'true'),
    'pieces', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nom', p.data ->> 'nom', 'type', p.data ->> 'type', 'taille', p.data -> 'taille',
                    'date', left(coalesce(p.data ->> 'depose_le', ''), 10), 'etape', e.val ->> 'libelle', 'dossier', d.data ->> 'reference',
                    'de', case when coalesce(p.data ->> 'client_id', '') <> '' then 'vous' else 'promoteur' end,
                    'statut', case when coalesce(p.data ->> 'client_id', '') <> '' then p.data ->> 'statut' else '' end,
                    'motif_refus', case when p.data ->> 'statut' = 'refusee' then p.data ->> 'decision_motif' else '' end,
                    'disponible', coalesce(p.data ->> 'chemin', '') <> '') order by p.data ->> 'depose_le' desc), '[]'::jsonb)
               from public.pi_pieces_foncieres p
               join public.pi_dossiers_fonciers d on d.id = p.data ->> 'dossier_id'
               cross join lateral (select x.val from jsonb_array_elements(coalesce(d.data -> 'etapes', '[]'::jsonb)) as x(val) where x.val ->> 'code' = p.data ->> 'etape_code' limit 1) e
               where (d.data ->> 'parcelle_id') = any (public.fc__client_parcelles(v_c)) and coalesce(d.data ->> 'statut', '') <> 'annule'
                 and (coalesce(d.data ->> 'niveau', 'global') <> 'individuel' or (d.data -> 'client_ids') ? v_cid or (d.data ->> 'client_id') = v_cid)
                 and e.val ->> 'visibilite' = 'souscripteur'
                 and coalesce(p.data ->> 'retire', '') <> 'true' and coalesce(p.data ->> 'remplacee_par', '') = ''
                 and coalesce(p.data ->> 'confidentialite', 'normale') <> 'restreinte'
                 and ((p.data ->> 'client_id') = v_cid or (coalesce(p.data ->> 'client_id', '') = '' and p.data ->> 'visibilite' = 'souscripteur'))));
end
$fn$;

create or replace function public.fc_portail_piece_chemin(p_piece text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_cid text := auth.jwt() ->> 'client_id';
  v_c   jsonb;
  v_p   jsonb;
  v_d   jsonb;
  v_refus constant jsonb := jsonb_build_object('ok', false, 'erreur', 'Document indisponible.');
begin
  if coalesce(auth.jwt() ->> 'kind', '') <> 'souscripteur' or coalesce(v_cid, '') = '' or p_piece is null or length(p_piece) > 80 then return v_refus; end if;
  v_c := (select data from public.pi_clients where id = v_cid and coalesce(data ->> '_deleted', '') <> 'true');
  v_p := (select data from public.pi_pieces_foncieres where id = p_piece);
  if v_c is null or v_p is null or coalesce(v_p ->> 'chemin', '') = '' or coalesce(v_p ->> 'retire', '') = 'true' or coalesce(v_p ->> 'remplacee_par', '') <> ''
     or coalesce(v_p ->> 'confidentialite', 'normale') = 'restreinte' then return v_refus; end if;
  if not ((v_p ->> 'client_id') = v_cid or (coalesce(v_p ->> 'client_id', '') = '' and v_p ->> 'visibilite' = 'souscripteur')) then return v_refus; end if;
  v_d := (select data from public.pi_dossiers_fonciers where id = v_p ->> 'dossier_id');
  if v_d is null or coalesce(v_d ->> 'statut', '') = 'annule' or not public.fc__dossier_du_client(v_d, v_cid, v_c) then return v_refus; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(v_d -> 'etapes', '[]'::jsonb)) as x(val) where x.val ->> 'code' = v_p ->> 'etape_code' and x.val ->> 'visibilite' = 'souscripteur') then return v_refus; end if;
  return jsonb_build_object('ok', true, 'bucket', coalesce(nullif(v_p ->> 'bucket', ''), 'pieces-foncieres'), 'chemin', v_p ->> 'chemin', 'nom', v_p ->> 'nom', 'type', v_p ->> 'type');
end
$fn$;

revoke all on function public.fc__dossier_du_client(jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.fc__depot_controle(jsonb) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['fc_depot_preparer(jsonb)', 'fc_depot_valider(jsonb, text, text, text, bigint, text, text)', 'fc_vue_souscripteur_pieces()', 'fc_portail_piece_chemin(text)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end
$$;
