-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — DOSSIER DE TRANSMISSION AU NOTAIRE.
-- À exécuter sur le projet Supabase de Zahara ET sur celui de Menco, après
-- foncier_connect_portail_intervenants.sql (fc__intervenant_courant) et foncier_notaire_attestations.sql. Idempotent.
--
-- Un notaire (intervenant de type « notaire ») ne reçoit AUCUN accès aux tables ni au stockage. Il ne voit QUE ce que le
-- promoteur a explicitement transmis, pour les souscripteurs dont la fiche le désigne (notaire_intervenant_id = jeton) :
--   · identité   — si client.transmission_notaire.identite   (nom, naissance, nationalité, pièce d'identité) ;
--   · bien       — si client.transmission_notaire.bien       (lots, parcelle, références TF / ACD / IDUFCI / GUF) ;
--   · avancement — si client.transmission_notaire.avancement (étapes PUBLIABLES du dossier foncier, jamais les étapes internes) ;
--   · attestations de solde validées et transmises (transmis_notaire) ;
--   · pièces cochées une à une (transmis_notaire_clients ∋ client), hors documents « restreints » ou retirés.
-- Jamais : montants hors attestations, versements, contacts, observations, journal, autres dossiers ; un souscripteur dont rien
-- n'a été transmis n'apparaît pas.
-- Identité lue UNIQUEMENT dans le jeton ; accès revérifié à chaque appel ; changer ou retirer le notaire coupe tout aussitôt.
--
-- Les FICHIERS ne sont pas servis par la base : fc_notaire_piece_chemin() contrôle le droit, JOURNALISE la consultation
-- (événement « piece_consultee_notaire » dans le journal du dossier, ajout seul) et renvoie le chemin ; l'Edge Function
-- fc-notaire-piece signe alors une URL de 60 secondes.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.fc__client_parcelles(p_client jsonb)
returns text[]
language sql
stable
set search_path = ''
as $fn$
  select coalesce(array_agg(distinct l.data ->> 'parcelle_id') filter (where coalesce(l.data ->> 'parcelle_id', '') <> ''), '{}')
  from jsonb_array_elements_text(
         case when jsonb_typeof(p_client -> 'lot_ids') = 'array' and jsonb_array_length(p_client -> 'lot_ids') > 0 then p_client -> 'lot_ids'
              when coalesce(p_client ->> 'lot_id', '') <> '' then jsonb_build_array(p_client ->> 'lot_id')
              else '[]'::jsonb end) as li(id)
  join public.pi_lots l on l.id = li.id
$fn$;

create or replace function public.fc_vue_notaire_dossiers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_id  text := auth.jwt() ->> 'intervenant_id';
  v_res jsonb;
begin
  if public.fc__intervenant_courant() is null
     or coalesce((select data ->> 'type' from public.pi_intervenants_fonciers where id = v_id), '') <> 'notaire' then
    return jsonb_build_object('dossiers', '[]'::jsonb);
  end if;

  v_res := (
    select coalesce(jsonb_agg(x.o order by x.nom), '[]'::jsonb)
    from (
      select btrim(coalesce(c.data ->> 'prenoms', '') || ' ' || coalesce(c.data ->> 'nom', '')) as nom,
        jsonb_build_object(
          'client_id', c.id,
          'souscripteur', btrim(coalesce(c.data ->> 'prenoms', '') || ' ' || coalesce(c.data ->> 'nom', '')),
          'dossier', c.data ->> 'dossier',
          'identite', case when coalesce(c.data -> 'transmission_notaire' ->> 'identite', '') = 'true' then
              jsonb_strip_nulls(jsonb_build_object('nom', c.data ->> 'nom', 'prenoms', c.data ->> 'prenoms', 'naissance', c.data ->> 'ddn',
                'nationalite', c.data ->> 'nationalite', 'piece_type', c.data ->> 'piece_type', 'piece_num', c.data ->> 'piece_num'))
            else null end,
          'bien', case when coalesce(c.data -> 'transmission_notaire' ->> 'bien', '') = 'true' then
              jsonb_build_object(
                'lots', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                           'lot', l.data ->> 'numero', 'ilot', l.data ->> 'ilot', 'surface', l.data ->> 'surface', 'type', l.data ->> 'type',
                           'parcelle', p.data ->> 'ref', 'localisation', p.data ->> 'localisation',
                           'numero_tf', p.data ->> 'numero_tf', 'numero_acd', p.data ->> 'numero_acd'))), '[]'::jsonb)
                         from jsonb_array_elements_text(
                                case when jsonb_typeof(c.data -> 'lot_ids') = 'array' and jsonb_array_length(c.data -> 'lot_ids') > 0 then c.data -> 'lot_ids'
                                     when coalesce(c.data ->> 'lot_id', '') <> '' then jsonb_build_array(c.data ->> 'lot_id')
                                     else '[]'::jsonb end) as li(id)
                         join public.pi_lots l on l.id = li.id
                         left join public.pi_parcelles p on p.id = l.data ->> 'parcelle_id'),
                'references', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                           'dossier', d.data ->> 'reference', 'idufci', nullif(d.data ->> 'idufci', ''), 'numero_dossier_guf', nullif(d.data ->> 'numero_dossier_guf', '')))), '[]'::jsonb)
                         from public.pi_dossiers_fonciers d
                         where (d.data ->> 'parcelle_id') = any (public.fc__client_parcelles(c.data))
                           and coalesce(d.data ->> 'niveau', 'global') <> 'individuel' and coalesce(d.data ->> 'statut', '') <> 'annule'
                           and (coalesce(d.data ->> 'idufci', '') <> '' or coalesce(d.data ->> 'numero_dossier_guf', '') <> '')))
            else null end,
          'avancement', case when coalesce(c.data -> 'transmission_notaire' ->> 'avancement', '') = 'true' then
              (select coalesce(jsonb_agg(jsonb_build_object(
                        'reference', d.data ->> 'reference',
                        'niveau', case when d.data ->> 'niveau' = 'individuel' then 'individuel' else 'global' end,
                        'statut', d.data ->> 'statut',
                        'etapes', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('libelle', e.val ->> 'libelle', 'statut', e.val ->> 'statut', 'date_cible', nullif(e.val ->> 'date_cible', ''))) order by e.ord), '[]'::jsonb)
                                   from jsonb_array_elements(coalesce(d.data -> 'etapes', '[]'::jsonb)) with ordinality as e(val, ord)
                                   where e.val ->> 'visibilite' = 'souscripteur'))), '[]'::jsonb)
               from public.pi_dossiers_fonciers d
               where (d.data ->> 'parcelle_id') = any (public.fc__client_parcelles(c.data)) and coalesce(d.data ->> 'statut', '') <> 'annule'
                 and (coalesce(d.data ->> 'niveau', 'global') <> 'individuel'
                      or (d.data -> 'client_ids') ? c.id or (d.data ->> 'client_id') = c.id))
            else null end,
          'attestations', (select coalesce(jsonb_agg(jsonb_build_object(
                    'kind', case when a.cle = 'attestation_solde_finale' then 'finale' else 'initial' end,
                    'numero', a.val ->> 'numero', 'date', a.val ->> 'valide_le',
                    'html', coalesce(nullif(a.val ->> 'html_notaire', ''), a.val ->> 'html'))), '[]'::jsonb)
                  from (values ('attestation_solde', c.data -> 'attestation_solde'), ('attestation_solde_finale', c.data -> 'attestation_solde_finale')) as a(cle, val)
                  where jsonb_typeof(a.val) = 'object' and a.val ->> 'statut' = 'valide' and coalesce(a.val ->> 'transmis_notaire', '') = 'true'
                    and coalesce(a.val ->> 'html', '') <> ''),
          'pieces', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', pc.id, 'nom', pc.data ->> 'nom', 'type', pc.data ->> 'type', 'taille', pc.data -> 'taille', 'categorie', pc.data ->> 'categorie',
                    'date', left(coalesce(pc.data ->> 'depose_le', ''), 10), 'version', pc.data -> 'version', 'dossier', d.data ->> 'reference')
                    order by pc.data ->> 'depose_le' desc), '[]'::jsonb)
                  from public.pi_pieces_foncieres pc
                  left join public.pi_dossiers_fonciers d on d.id = pc.data ->> 'dossier_id'
                  where (pc.data -> 'transmis_notaire_clients') ? c.id
                    and coalesce(pc.data ->> 'retire', '') <> 'true' and coalesce(pc.data ->> 'remplacee_par', '') = ''
                    and coalesce(pc.data ->> 'confidentialite', 'normale') <> 'restreinte' and coalesce(pc.data ->> 'chemin', '') <> '')
        ) as o
      from public.pi_clients c
      where c.data ->> 'notaire_intervenant_id' = v_id and coalesce(c.data ->> '_deleted', '') <> 'true'
    ) x
    -- Minimisation : un souscripteur dont RIEN n'a été transmis n'apparaît pas (pas même son nom).
    where (x.o ->> 'identite') is not null or (x.o ->> 'bien') is not null or (x.o ->> 'avancement') is not null
       or jsonb_array_length(x.o -> 'attestations') > 0 or jsonb_array_length(x.o -> 'pieces') > 0
  );
  return jsonb_build_object('dossiers', v_res);
end
$fn$;

-- Contrôle d'accès à UN fichier : renvoie le chemin et journalise la consultation. Sans paramètre d'identité (jeton).
create or replace function public.fc_notaire_piece_chemin(p_piece text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_id   text := auth.jwt() ->> 'intervenant_id';
  v_c    jsonb;
  v_p    jsonb;
  v_eid  text := replace(gen_random_uuid()::text, '-', '');
  v_iso  text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_refus constant jsonb := jsonb_build_object('ok', false, 'erreur', 'Document indisponible.');
begin
  v_c := public.fc__intervenant_courant();
  if v_c is null or coalesce((select data ->> 'type' from public.pi_intervenants_fonciers where id = v_id), '') <> 'notaire' then
    return v_refus;
  end if;
  v_p := (select data from public.pi_pieces_foncieres where id = p_piece);
  if v_p is null
     or coalesce(v_p ->> 'retire', '') = 'true' or coalesce(v_p ->> 'remplacee_par', '') <> ''
     or coalesce(v_p ->> 'confidentialite', 'normale') = 'restreinte' or coalesce(v_p ->> 'chemin', '') = ''
     or not exists (select 1 from public.pi_clients c
                    where c.data ->> 'notaire_intervenant_id' = v_id and coalesce(c.data ->> '_deleted', '') <> 'true'
                      and (v_p -> 'transmis_notaire_clients') ? c.id) then
    return v_refus;
  end if;

  insert into public.pi_evenements_fonciers(id, data, updated_at)
  values (v_eid,
    jsonb_build_object('id', v_eid, 'dossier_id', v_p ->> 'dossier_id', 'etape_code', coalesce(v_p ->> 'etape_code', ''),
      'type', 'piece_consultee_notaire',
      'description', 'Consultation de « ' || (v_p ->> 'nom') || ' » (v' || coalesce(v_p ->> 'version', '1') || ') par le notaire ' || (v_c ->> 'nom'),
      'ancien', '', 'nouveau', '', 'source', 'notaire', 'source_ref', p_piece, 'motif', '',
      'acteur', v_c ->> 'nom', 'acteur_id', v_c ->> 'id', 'acteur_role', 'notaire', 'date', v_iso),
    now());
  return jsonb_build_object('ok', true, 'bucket', coalesce(nullif(v_p ->> 'bucket', ''), 'pieces-foncieres'), 'chemin', v_p ->> 'chemin', 'nom', v_p ->> 'nom', 'type', v_p ->> 'type');
end
$fn$;

revoke all on function public.fc__client_parcelles(jsonb) from public, anon, authenticated;
revoke all on function public.fc_vue_notaire_dossiers() from public, anon;
grant execute on function public.fc_vue_notaire_dossiers() to authenticated;
revoke all on function public.fc_notaire_piece_chemin(text) from public, anon;
grant execute on function public.fc_notaire_piece_chemin(text) to authenticated;
