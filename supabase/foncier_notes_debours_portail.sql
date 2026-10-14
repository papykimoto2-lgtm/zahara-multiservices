-- RF1 — Refacturation des frais de titre au souscripteur : lecture portail des notes de débours publiées.
-- Prérequis : foncier_depot_fichiers_portail.sql (fc__dossier_du_client), foncier_transmission_notaire.sql (fc__client_parcelles). Idempotent.
-- Identité exclusivement issue du JWT. Ne renvoie que les notes publiées, émises ou encaissées, adressées à ce client.
create or replace function public.fc_vue_souscripteur_debours()
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
    return jsonb_build_object('notes', '[]'::jsonb);
  end if;
  v_c := (select data from public.pi_clients where id = v_cid and coalesce(data ->> '_deleted', '') <> 'true');
  if v_c is null then return jsonb_build_object('notes', '[]'::jsonb); end if;

  return jsonb_build_object('notes', (
    select coalesce(jsonb_agg(jsonb_build_object('id', n.val ->> 'id', 'numero', n.val ->> 'numero', 'date', n.val ->> 'date', 'echeance', n.val ->> 'echeance',
             'montant', n.val -> 'montant', 'statut', n.val ->> 'statut', 'encaisse_le', n.val ->> 'encaisse_le',
             'dossier', d.data ->> 'reference', 'html', n.val ->> 'html') order by n.val ->> 'date' desc, n.val ->> 'numero' desc), '[]'::jsonb)
    from public.pi_dossiers_fonciers d
    cross join lateral jsonb_array_elements(coalesce(d.data -> 'notes_debours', '[]'::jsonb)) as n(val)
    where coalesce(d.data ->> 'statut', '') <> 'annule'
      and public.fc__dossier_du_client(d.data, v_cid, v_c)
      and n.val ->> 'client_id' = v_cid
      and coalesce(n.val ->> 'publie_portail', '') = 'true'
      and coalesce(n.val ->> 'statut', '') in ('emise', 'encaissee')));
end
$fn$;

revoke all on function public.fc_vue_souscripteur_debours() from public, anon;
grant execute on function public.fc_vue_souscripteur_debours() to authenticated;
