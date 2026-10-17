-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — portail souscripteur : fonction fc_vue_souscripteur()
-- À exécuter sur le projet Supabase de Zahara ET sur celui de Menco, après
-- foncier_connect.sql. Idempotent.
--
-- Pourquoi une fonction : le lien dossier → souscripteur n'existe pas en base
-- (il passe par client → lots → parcelle). Donner au souscripteur un SELECT
-- sur pi_dossiers_fonciers exposerait les observations internes, les motifs
-- et les justificatifs. Cette fonction (SECURITY DEFINER) renvoie UNIQUEMENT
-- la vue publique — reproduction exacte de fcVueSouscripteur() (RM-05) :
--   · étapes de visibilité « souscripteur » seulement ;
--   · publications non retirées (texte public rédigé à part) ;
--   · progression pondérée, prochaine étape, statut synthétique ;
--   · ses demandes d'information.
-- Jamais : observations, motifs, responsables, montants, justificatifs,
-- pièces jointes (leur contenu viendra avec une fonction dédiée).
--
-- NB Dashboard Supabase : « select … into variable » y est pris pour une création
-- de table (il ajoute des ALTER TABLE … ENABLE ROW LEVEL SECURITY et échoue).
-- La fonction utilise donc des affectations « v := (select …) ». Coller le
-- fichier ENTIER (jusqu'à la dernière ligne « grant execute »).
--
-- Identité : lue UNIQUEMENT dans le jeton (claim client_id, kind='souscripteur'
-- émis par portal-login). Aucun paramètre : impossible de demander le dossier
-- d'un autre (IDOR). Sans jeton souscripteur : résultat vide.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.fc_vue_souscripteur()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_client_id text := auth.jwt() ->> 'client_id';
  v_client    jsonb;
  v_params    jsonb;
  v_poids     jsonb;
  v_lot_ids   text[];
  v_parcelles text[];
  v_out       jsonb;
  v_dossiers  jsonb := '[]'::jsonb;
  v_demandes  jsonb := '[]'::jsonb;
  d           record;
  v_visibles  jsonb;
  v_pubs      jsonb;
  v_prochaine jsonb;
  v_prog      jsonb;
  v_statut    text;
  v_client_ids text[];
  v_lots_dossier text[];
  v_lib_niveau text;
  v_parc      jsonb;
begin
  if coalesce(auth.jwt() ->> 'kind', '') <> 'souscripteur' or coalesce(v_client_id, '') = '' then
    return jsonb_build_object('client_id', v_client_id, 'dossiers', '[]'::jsonb, 'demandes', '[]'::jsonb,
                              'contact', '{}'::jsonb);
  end if;

  v_client := (select data from public.pi_clients where id = v_client_id);
  v_params := (select data from public.pi_params where id = 'main');
  v_params := coalesce(v_params, '{}'::jsonb);
  v_poids  := '{"C":2,"D":2,"E":1}'::jsonb || coalesce(v_params -> 'fc_poids_phases', '{}'::jsonb);

  v_out := jsonb_build_object(
    'client_id', v_client_id,
    'dossiers', '[]'::jsonb,
    'demandes', '[]'::jsonb,
    'contact', jsonb_build_object(
      'societe',   coalesce(v_params ->> 'societe', ''),
      'telephone', coalesce(v_params ->> 'tel', v_params ->> 'telephone', ''),
      'email',     coalesce(v_params ->> 'email', '')));

  if v_client is null then
    return v_out;
  end if;

  -- Lots du souscripteur (lot_ids prioritaire, sinon lot_id), puis leurs parcelles.
  if jsonb_typeof(v_client -> 'lot_ids') = 'array' and jsonb_array_length(v_client -> 'lot_ids') > 0 then
    v_lot_ids := (select array_agg(x) from jsonb_array_elements_text(v_client -> 'lot_ids') x);
  elsif coalesce(v_client ->> 'lot_id', '') <> '' then
    v_lot_ids := array[v_client ->> 'lot_id'];
  else
    v_lot_ids := '{}';
  end if;

  v_parcelles := (select coalesce(array_agg(distinct l.data ->> 'parcelle_id'), '{}')
                  from public.pi_lots l
                  where l.id = any (v_lot_ids) and coalesce(l.data ->> 'parcelle_id', '') <> '');

  for d in
    select df.id, df.data as j
    from public.pi_dossiers_fonciers df
    where (df.data ->> 'parcelle_id') = any (v_parcelles)
      and coalesce(df.data ->> 'statut', '') <> 'annule'
    order by df.updated_at, df.id
  loop
    -- Titre individuel : seulement si ce souscripteur en fait partie.
    if d.j ->> 'niveau' = 'individuel' then
      if jsonb_typeof(d.j -> 'client_ids') = 'array' then
        v_client_ids := (select array_agg(x) from jsonb_array_elements_text(d.j -> 'client_ids') x);
      else
        v_client_ids := array[d.j ->> 'client_id'];
      end if;
      continue when not (v_client_id = any (coalesce(v_client_ids, '{}')));
    end if;

    v_visibles := (select coalesce(jsonb_agg(e order by (e ->> 'ordre')::numeric), '[]'::jsonb)
                   from jsonb_array_elements(coalesce(d.j -> 'etapes', '[]'::jsonb)) e
                   where e ->> 'visibilite' = 'souscripteur');

    v_pubs := (select coalesce(jsonb_agg(jsonb_build_object(
             'date', left(p.data ->> 'publie_le', 10),
             'titre', p.data ->> 'libelle_public',
             'description', p.data ->> 'description_publique',
             'source', case p.data ->> 'source'
               when 'promoteur' then 'Information enregistrée par le promoteur'
               when 'prestataire' then 'Document reçu du prestataire'
               when 'administration_declaree' then 'Information obtenue auprès d''une administration (non confirmée par un document)'
               when 'administration_confirmee' then 'Décision officielle enregistrée (document reçu et contrôlé)'
             end,
             'reference_source', p.data ->> 'source_ref')
           order by p.data ->> 'publie_le' desc), '[]'::jsonb)
      from public.pi_publications_foncieres p
      where p.data ->> 'dossier_id' = d.id and not coalesce((p.data ->> 'retire')::boolean, false));

    -- Prochaine étape : première étape visible non finale, par ordre.
    v_prochaine := (select jsonb_build_object('libelle', e ->> 'libelle', 'date_indicative', coalesce(e ->> 'date_cible', ''))
                    from jsonb_array_elements(v_visibles) e
                    where e ->> 'statut' not in ('termine', 'rejete', 'annule')
                    order by (e ->> 'ordre')::numeric
                    limit 1);

    -- Statut synthétique (mêmes règles que fcStatutSynthetique).
    v_statut := case
      when d.j ->> 'statut' = 'cloture' then 'Dossier clôturé'
      when exists (select 1 from jsonb_array_elements(v_visibles) e where e ->> 'statut' in ('attente_administration', 'attente_decision'))
        then 'En attente d''une réponse de l''administration'
      when exists (select 1 from jsonb_array_elements(v_visibles) e where e ->> 'statut' in ('en_cours', 'termine'))
        then 'Démarches en cours'
      else 'Démarches à venir' end;

    -- Progression pondérée (mêmes règles que fcProgressionSouscripteur).
    v_prog := (with suivies as (
      select e ->> 'phase' as phase,
             coalesce((v_poids ->> (e ->> 'phase'))::numeric, 1) as w,
             (e ->> 'statut') = 'termine' as fait
      from jsonb_array_elements(v_visibles) e
      where e ->> 'statut' <> 'annule'
    ), par_phase as (
      select phase, count(*) as etapes, count(*) filter (where fait) as terminees
      from suivies group by phase
    )
    select jsonb_build_object(
      'pourcentage', coalesce(round(100 * (select sum(w) filter (where fait) from suivies)
                                        / nullif((select sum(w) from suivies), 0)), 0),
      'par_phase', coalesce((select jsonb_object_agg(phase, jsonb_build_object(
                     'libelle', case phase when 'A' then 'Ouverture et diagnostic' when 'B' then 'Préparation technique'
                                when 'C' then 'Dépôt et instruction' when 'D' then 'Formalités foncières'
                                when 'E' then 'Contrôle et clôture' end,
                     'etapes', etapes, 'terminees', terminees)) from par_phase), '{}'::jsonb),
      'explication', 'Avancement des démarches suivies pour vous (étapes terminées sur étapes suivies, pondérées par phase). Ce pourcentage mesure l''avancement des démarches : ce n''est ni une probabilité d''obtention d''un document, ni une garantie juridique.'));

    -- Libellés : lot(s) pour un titre individuel, programme, parcelle.
    if d.j ->> 'niveau' = 'individuel' then
      if jsonb_typeof(d.j -> 'lots_ids') = 'array' then
        v_lots_dossier := (select array_agg(x) from jsonb_array_elements_text(d.j -> 'lots_ids') x);
      else
        v_lots_dossier := array[d.j ->> 'lot_id'];
      end if;
      v_lib_niveau := (select 'Votre titre individuel — lot ' || coalesce(string_agg(
               coalesce(nullif(l.data ->> 'numero', ''), nullif(l.data ->> 'ref', ''), nullif(l.data ->> 'reference', ''),
                        nullif(l.data ->> 'nom', ''), l.id), ', '), '—')
               from unnest(v_lots_dossier) with ordinality t(lid, ord)
               join public.pi_lots l on l.id = t.lid);
      v_lib_niveau := coalesce(v_lib_niveau, 'Votre titre individuel — lot —');
    else
      v_lib_niveau := 'Titre de l''opération (parcelle mère)';
    end if;

    v_parc := (select data from public.pi_parcelles where id = d.j ->> 'parcelle_id');

    v_dossiers := v_dossiers || jsonb_build_object(
      'id', d.id,
      'reference', d.j ->> 'reference',
      'niveau', case when d.j ->> 'niveau' = 'individuel' then 'individuel' else 'global' end,
      'libelle_niveau', v_lib_niveau,
      'programme', coalesce((select pg.data ->> 'nom' from public.pi_programmes pg where pg.id = d.j ->> 'programme_id'), ''),
      'parcelle', case when v_parc is null then coalesce(d.j ->> 'parcelle_id', '—')
                  else coalesce(nullif(v_parc ->> 'ref', ''), d.j ->> 'parcelle_id')
                       || case when coalesce(v_parc ->> 'localisation', '') <> '' then ' — ' || (v_parc ->> 'localisation') else '' end end,
      'statut', v_statut,
      'progression', v_prog,
      'derniere_mise_a_jour', coalesce(v_pubs -> 0 ->> 'date', ''),
      'prochaine_etape', v_prochaine,
      'etapes', (select coalesce(jsonb_agg(jsonb_build_object('libelle', e ->> 'libelle', 'phase', e ->> 'phase',
                   'statut', e ->> 'statut', 'date_cible', coalesce(e ->> 'date_cible', '')) order by (e ->> 'ordre')::numeric), '[]'::jsonb)
                 from jsonb_array_elements(v_visibles) e where e ->> 'statut' <> 'annule'),
      'historique', v_pubs);
  end loop;

  v_demandes := (select coalesce(jsonb_agg(jsonb_build_object(
           'reference', x.data ->> 'reference',
           'date', x.data ->> 'date',
           'sujet', x.data ->> 'sujet',
           'statut', case x.data ->> 'statut' when 'nouvelle' then 'Nouvelle' when 'en_cours' then 'En cours'
                     when 'attente_souscripteur' then 'En attente du souscripteur' when 'repondue' then 'Répondue'
                     when 'cloturee' then 'Clôturée' end,
           'messages', (select coalesce(jsonb_agg(jsonb_build_object('date', m ->> 'date', 'de', m ->> 'de', 'texte', m ->> 'texte')), '[]'::jsonb)
                        from jsonb_array_elements(coalesce(x.data -> 'messages', '[]'::jsonb)) m))
         order by x.updated_at), '[]'::jsonb)
    from public.pi_demandes_fonciers x
    where x.data ->> 'client_id' = v_client_id);

  return v_out || jsonb_build_object('dossiers', v_dossiers, 'demandes', v_demandes);
end
$fn$;

-- Seul un utilisateur connecté (jeton souscripteur ou personnel) peut l'appeler ;
-- sans jeton souscripteur le résultat est vide.
revoke all on function public.fc_vue_souscripteur() from public, anon;
grant execute on function public.fc_vue_souscripteur() to authenticated;
