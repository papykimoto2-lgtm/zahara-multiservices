-- ═══════════════════════════════════════════════════════════════════════════
-- Espace notaire : lecture des attestations de solde TRANSMISES par le promoteur.
-- À exécuter sur le projet Supabase de Zahara ET sur celui de Menco, après
-- foncier_connect_portail_intervenants.sql (fc__intervenant_courant). Idempotent.
--
-- Un notaire (intervenant de type « notaire ») ne reçoit AUCUN accès aux tables.
-- fc_vue_notaire_attestations() (SECURITY DEFINER, sans paramètre) renvoie UNIQUEMENT :
--   · les clients dont la fiche désigne CE notaire (notaire_intervenant_id = jeton) ;
--   · leurs attestations de solde au statut « valide » ET explicitement transmises
--     au notaire (transmis_notaire = true) : numéro, date de validation, texte figé.
-- Jamais : montants hors attestation, versements, contact du souscripteur, autres dossiers.
-- Identité lue UNIQUEMENT dans le jeton ; l'accès est revérifié à chaque appel
-- (relation archivée, code retiré ou expiré => résultat vide). Changer le notaire
-- sur la fiche, ou retirer la transmission, coupe l'accès aussitôt.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.fc_vue_notaire_attestations()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_id  text := auth.jwt() ->> 'intervenant_id';
  v_ok  jsonb;
  v_res jsonb;
begin
  v_ok := public.fc__intervenant_courant();
  if v_ok is null or coalesce((select data ->> 'type' from public.pi_intervenants_fonciers where id = v_id), '') <> 'notaire' then
    return jsonb_build_object('attestations', '[]'::jsonb);
  end if;

  v_res := (
    select coalesce(jsonb_agg(x.o order by x.d desc), '[]'::jsonb)
    from (
      select a.val ->> 'valide_le' as d,
             jsonb_build_object(
               'client_id', c.id,
               'souscripteur', btrim(coalesce(c.data ->> 'prenoms', '') || ' ' || coalesce(c.data ->> 'nom', '')),
               'dossier', c.data ->> 'dossier',
               'kind', case when a.cle = 'attestation_solde_finale' then 'finale' else 'initial' end,
               'numero', a.val ->> 'numero',
               'date', a.val ->> 'valide_le',
               'html', coalesce(nullif(a.val ->> 'html_notaire', ''), a.val ->> 'html')) as o
      from public.pi_clients c
      cross join lateral (values ('attestation_solde', c.data -> 'attestation_solde'),
                                 ('attestation_solde_finale', c.data -> 'attestation_solde_finale')) as a(cle, val)
      where c.data ->> 'notaire_intervenant_id' = v_id
        and coalesce(c.data ->> '_deleted', '') <> 'true'
        and jsonb_typeof(a.val) = 'object'
        and a.val ->> 'statut' = 'valide'
        and coalesce(a.val ->> 'transmis_notaire', '') = 'true'
        and coalesce(a.val ->> 'html', '') <> ''
    ) x
  );
  return jsonb_build_object('attestations', v_res);
end
$fn$;

revoke all on function public.fc_vue_notaire_attestations() from public, anon;
grant execute on function public.fc_vue_notaire_attestations() to authenticated;
