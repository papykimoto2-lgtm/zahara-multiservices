-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — portail intervenants (P1) : fonction fc_vue_intervenant()
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
-- NB Dashboard Supabase : « select … into variable » y est pris pour une
-- création de table. La fonction utilise donc des affectations
-- « v := (select …) ». Coller le fichier ENTIER (jusqu'à « grant execute »).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.fc_vue_intervenant()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_id       text := auth.jwt() ->> 'intervenant_id';
  v_i        jsonb;
  v_exp      timestamptz;
  v_missions jsonb;
begin
  if coalesce(auth.jwt() ->> 'kind', '') <> 'intervenant' or coalesce(v_id, '') = '' then
    return jsonb_build_object('intervenant_id', v_id, 'missions', '[]'::jsonb);
  end if;

  v_i := (select data from public.pi_intervenants_fonciers where id = v_id);

  begin
    v_exp := (v_i ->> 'code_expiration')::timestamptz;
  exception when others then
    v_exp := null;   -- date illisible : même comportement que portal-login (jamais « expiré »)
  end;

  -- Accès toujours valable ? relation active, fiche non supprimée, code présent et non expiré.
  if v_i is null
     or coalesce(v_i ->> 'statut_relation', '') <> 'actif'
     or coalesce(v_i ->> '_deleted', '') = 'true'
     or coalesce(v_i ->> 'code_acces_hash', '') = ''
     or (v_exp is not null and v_exp < now())
     or exists (select 1 from public.pi_suppressions s where s.id = 'ts::intervenants_fonciers::' || v_id)
  then
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

-- Réservée aux utilisateurs connectés ; sans jeton « intervenant » le résultat est vide.
revoke all on function public.fc_vue_intervenant() from public, anon;
grant execute on function public.fc_vue_intervenant() to authenticated;
