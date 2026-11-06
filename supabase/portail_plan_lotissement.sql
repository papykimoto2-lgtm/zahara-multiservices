-- Portail souscripteur : plan 3D du lotissement.
-- Fonction serveur fc_vue_plan_lotissement() (SECURITY DEFINER) : le souscripteur est identifié par son jeton,
-- il ne peut pas demander le plan d'un autre. Elle ne renvoie QUE :
--   · pour chaque lot de sa parcelle (ou, à défaut, de son programme) : numéro, îlot, surface, contour ;
--   · un statut réduit à trois valeurs : 'mon_lot', 'libre', 'attribue' (réservé et vendu ne sont pas distingués).
-- Jamais de nom de client, de prix, de montant, de coordonnées de contact ni d'état de paiement d'un autre lot.
-- Au plus 700 lots sont renvoyés (les siens d'abord, puis les plus proches quand les coordonnées existent).
-- Idempotent. Mêmes droits que fc_vue_souscripteur : authenticated et service_role, pas anon.

create or replace function public.fc_vue_plan_lotissement() returns jsonb
language plpgsql stable security definer set search_path to '' as $f$
declare
  v_client_id text := auth.jwt() ->> 'client_id';
  v_client    jsonb;
  v_lot_ids   text[];
  v_cle       record;
  v_lat0      numeric;
  v_lng0      numeric;
  v_plans     jsonb := '[]'::jsonb;
  v_total     int;
  v_max       constant int := 700;
begin
  if coalesce(auth.jwt() ->> 'kind', '') <> 'souscripteur' or coalesce(v_client_id, '') = '' then
    return jsonb_build_object('plans', '[]'::jsonb);
  end if;

  v_client := (select data from public.pi_clients where id = v_client_id);
  if v_client is null then
    return jsonb_build_object('plans', '[]'::jsonb);
  end if;

  if jsonb_typeof(v_client -> 'lot_ids') = 'array' and jsonb_array_length(v_client -> 'lot_ids') > 0 then
    v_lot_ids := (select array_agg(x) from jsonb_array_elements_text(v_client -> 'lot_ids') x);
  elsif coalesce(v_client ->> 'lot_id', '') <> '' then
    v_lot_ids := array[v_client ->> 'lot_id'];
  else
    return jsonb_build_object('plans', '[]'::jsonb);
  end if;

  -- Un plan par parcelle des lots du souscripteur (à défaut de parcelle : par programme).
  for v_cle in
    select distinct
           coalesce(nullif(l.data ->> 'parcelle_id', ''), '') as parcelle_id,
           case when coalesce(l.data ->> 'parcelle_id', '') = '' then coalesce(l.data ->> 'programme_id', '') else '' end as programme_id
    from public.pi_lots l
    where l.id = any (v_lot_ids)
  loop
    -- Point de référence : moyenne des lots du souscripteur sur ce plan (pour garder les lots voisins).
    select avg((l.data ->> 'lat')::numeric), avg((l.data ->> 'lng')::numeric)
      into v_lat0, v_lng0
    from public.pi_lots l
    where l.id = any (v_lot_ids)
      and (l.data ->> 'lat') ~ '^-?[0-9]+(\.[0-9]+)?$' and (l.data ->> 'lng') ~ '^-?[0-9]+(\.[0-9]+)?$'
      and ((v_cle.parcelle_id <> '' and l.data ->> 'parcelle_id' = v_cle.parcelle_id)
        or (v_cle.parcelle_id = '' and l.data ->> 'programme_id' = v_cle.programme_id and coalesce(l.data ->> 'parcelle_id', '') = ''));

    select count(*) into v_total
    from public.pi_lots l
    where (v_cle.parcelle_id <> '' and l.data ->> 'parcelle_id' = v_cle.parcelle_id)
       or (v_cle.parcelle_id = '' and l.data ->> 'programme_id' = v_cle.programme_id and coalesce(l.data ->> 'parcelle_id', '') = '');

    v_plans := v_plans || jsonb_build_object(
      'parcelle_id', v_cle.parcelle_id,
      'parcelle', coalesce((select nullif(p.data ->> 'ref', '') from public.pi_parcelles p where p.id = v_cle.parcelle_id), ''),
      'programme', coalesce((select pg.data ->> 'nom' from public.pi_programmes pg
                              where pg.id = coalesce(nullif(v_cle.programme_id, ''),
                                     (select l2.data ->> 'programme_id' from public.pi_lots l2 where l2.id = any (v_lot_ids) limit 1))), ''),
      'total', v_total,
      'tronque', v_total > v_max,
      'lots', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', s.id,
                 'numero', s.numero,
                 'ilot', s.ilot,
                 'surface', s.surface,
                 'statut', s.statut,
                 'poly', s.poly)), '[]'::jsonb)
        from (
          select l.id,
                 coalesce(nullif(l.data ->> 'numero', ''), nullif(l.data ->> 'ref', ''), l.id) as numero,
                 coalesce(l.data ->> 'ilot', '') as ilot,
                 case when (l.data ->> 'surface') ~ '^[0-9]+(\.[0-9]+)?$' then (l.data ->> 'surface')::numeric else null end as surface,
                 case when l.id = any (v_lot_ids) then 'mon_lot'
                      when l.data ->> 'statut' = 'disponible' then 'libre'
                      else 'attribue' end as statut,
                 case when jsonb_typeof(l.data -> 'geo_polygon') = 'array' then l.data -> 'geo_polygon' else null end as poly
          from public.pi_lots l
          where (v_cle.parcelle_id <> '' and l.data ->> 'parcelle_id' = v_cle.parcelle_id)
             or (v_cle.parcelle_id = '' and l.data ->> 'programme_id' = v_cle.programme_id and coalesce(l.data ->> 'parcelle_id', '') = '')
          order by (l.id = any (v_lot_ids)) desc,
                   case when v_lat0 is not null and (l.data ->> 'lat') ~ '^-?[0-9]+(\.[0-9]+)?$' and (l.data ->> 'lng') ~ '^-?[0-9]+(\.[0-9]+)?$'
                        then power((l.data ->> 'lat')::numeric - v_lat0, 2) + power((l.data ->> 'lng')::numeric - v_lng0, 2)
                        else 1e9 end,
                   l.data ->> 'numero', l.id
          limit v_max
        ) s));
  end loop;

  return jsonb_build_object('plans', v_plans);
end
$f$;

revoke all on function public.fc_vue_plan_lotissement() from public, anon;
grant execute on function public.fc_vue_plan_lotissement() to authenticated, service_role;
