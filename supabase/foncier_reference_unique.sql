-- Foncier : référence de dossier (DF-AAAA-NNN) unique, garantie côté serveur.
-- La référence est calculée dans le navigateur à partir des dossiers chargés :
-- deux postes (ou un poste pas encore synchronisé) peuvent produire le même
-- numéro. Le trigger attribue alors le numéro libre suivant au lieu de rejeter
-- l'enregistrement (la synchronisation n'est pas bloquée) et garde la trace
-- dans data.reference_initiale. L'index unique est le dernier rempart.
create or replace function public.pi_fc_reference_unique()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  ref text := NEW.data->>'reference';
  an text;
  n int;
begin
  if ref is null or ref = '' then return NEW; end if;
  if TG_OP = 'UPDATE' and ref is not distinct from OLD.data->>'reference' then return NEW; end if;
  perform pg_advisory_xact_lock(hashtext('pi_fc_reference'));
  if not exists (select 1 from pi_dossiers_fonciers where data->>'reference' = ref and id <> NEW.id) then
    return NEW;
  end if;
  an := coalesce(substring(ref from '^DF-(\d{4})-'), to_char(now(), 'YYYY'));
  select coalesce(max((substring(data->>'reference' from '^DF-' || an || '-(\d+)$'))::int), 0) + 1 into n
    from pi_dossiers_fonciers where data->>'reference' ~ ('^DF-' || an || '-\d+$');
  NEW.data := NEW.data || jsonb_build_object(
    'reference', 'DF-' || an || '-' || lpad(n::text, 3, '0'),
    'reference_initiale', ref,
    'reference_corrigee_le', now());
  return NEW;
end;
$$;

drop trigger if exists trg_pi_fc_reference_unique on public.pi_dossiers_fonciers;
create trigger trg_pi_fc_reference_unique
  before insert or update on public.pi_dossiers_fonciers
  for each row execute function public.pi_fc_reference_unique();

create unique index if not exists uq_pi_dossiers_fonciers_reference
  on public.pi_dossiers_fonciers ((data->>'reference'))
  where coalesce(data->>'reference', '') <> '';
