-- Comptabilité : garde-fous SERVEUR (équilibre D/C, exercice clos, pièce visée, audit).
-- Idempotent. Ne touche ni RLS ni droits. À appliquer sur chaque instance (MENCO, Zahara).
-- Les pièces de journal CLO / AN (clôture, à-nouveaux) sont exemptées : clôture/réouverture les génèrent.

create or replace function public.chk_ecriture() returns trigger
language plpgsql as $$
declare
  d numeric := 0; c numeric := 0; sig_old text; sig_new text; an text; div text; clos boolean;
  row_ record;
begin
  row_ := case when TG_OP = 'DELETE' then old else new end;
  if coalesce(row_.data->>'journal','') in ('CLO','AN') or coalesce(row_.data->>'type','') = 'cloture' then
    return row_;
  end if;

  -- Exercice clos (consolidé ou par division)
  an  := substr(coalesce(row_.data->>'date',''), 1, 4);
  div := coalesce(row_.data->>'division','');
  if an ~ '^[0-9]{4}$' then
    select coalesce((p.data->>('cloture_'||an))='true', false)
        or (div <> '' and coalesce((p.data->>('cloture_'||an||'-'||div))='true', false))
      into clos from public.pi_params p where p.id = 'main';
    if coalesce(clos,false) then
      raise exception 'Exercice % clôturé : écriture verrouillée', an using errcode = 'P0001';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    if old.data->>'valide_le' is not null then
      raise exception 'Pièce visée : suppression interdite (contre-passer)' using errcode = 'P0001';
    end if;
    return old;
  end if;

  -- Équilibre D/C (tolérance < 1 F pour les données historiques)
  if jsonb_typeof(new.data->'lignes') = 'array' then
    select coalesce(sum((l->>'montant')::numeric) filter (where l->>'sens' = 'D'), 0),
           coalesce(sum((l->>'montant')::numeric) filter (where l->>'sens' = 'C'), 0)
      into d, c from jsonb_array_elements(new.data->'lignes') l;
    if abs(d - c) >= 1 then
      raise exception 'Écriture déséquilibrée : débit % ≠ crédit %', d, c using errcode = 'P0001';
    end if;
  end if;

  -- Pièce visée : contenu comptable immuable (date, comptes, sens, montants)
  if TG_OP = 'UPDATE' and old.data->>'valide_le' is not null then
    select coalesce(old.data->>'date','') || '|' || coalesce(string_agg((l->>'compte')||':'||(l->>'sens')||':'||round(coalesce((l->>'montant')::numeric,0)), ';' order by ord),'')
      into sig_old from jsonb_array_elements(coalesce(old.data->'lignes','[]'::jsonb)) with ordinality as t(l, ord);
    select coalesce(new.data->>'date','') || '|' || coalesce(string_agg((l->>'compte')||':'||(l->>'sens')||':'||round(coalesce((l->>'montant')::numeric,0)), ';' order by ord),'')
      into sig_new from jsonb_array_elements(coalesce(new.data->'lignes','[]'::jsonb)) with ordinality as t(l, ord);
    if new.data->>'valide_le' is null or sig_old is distinct from sig_new then
      raise exception 'Pièce visée : modification interdite (contre-passer)' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists t_chk_ecriture on public.pi_ecritures;
create trigger t_chk_ecriture before insert or update or delete on public.pi_ecritures
  for each row execute function public.chk_ecriture();

-- Audit serveur des écritures (en plus du journal client)
create or replace function public.audit_ecriture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pi_audit_log(id, data)
  values ('srv_' || gen_random_uuid()::text, jsonb_build_object(
    'entite','ecritures','entite_id', coalesce(new.id, old.id), 'action','srv_'||lower(TG_OP),
    'date', now(), 'user', coalesce(auth.jwt()->>'sub','anon'),
    'snapshot', case when TG_OP = 'INSERT' then null else old.data end));
  return coalesce(new, old);
exception when others then
  return coalesce(new, old);  -- l'audit ne doit jamais bloquer la saisie
end $$;

drop trigger if exists t_audit_ecriture on public.pi_ecritures;
create trigger t_audit_ecriture after insert or update or delete on public.pi_ecritures
  for each row execute function public.audit_ecriture();
