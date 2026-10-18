-- Caisse : la décision sur un bon soumis à validation est définitive.
-- Un bon validé ne peut plus être rejeté, un bon rejeté ne peut plus être
-- validé. Garde-fou serveur doublant le verrou applicatif (anciens onglets,
-- synchronisation différée). Normalise au lieu de lever une exception pour
-- ne pas bloquer le lot de synchronisation entier ; la correction est tracée
-- dans data.decision_corrigee_serveur. Les cas anciens (déjà validé ET rejeté)
-- ne sont pas touchés.
create or replace function public.pi_caisse_decision_definitive()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  n_v boolean := coalesce(NEW.data->'valide' = 'true'::jsonb, false);
  n_r boolean := coalesce(NEW.data->'rejete' = 'true'::jsonb, false);
  o_v boolean := false;
  o_r boolean := false;
  garde text;
begin
  if not (n_v and n_r) then return NEW; end if;
  if TG_OP = 'UPDATE' then
    o_v := coalesce(OLD.data->'valide' = 'true'::jsonb, false);
    o_r := coalesce(OLD.data->'rejete' = 'true'::jsonb, false);
    if o_v and o_r then return NEW; end if;
  end if;
  if o_v then garde := 'valide';
  elsif o_r then garde := 'rejete';
  elsif coalesce(NEW.data->>'rejete_le', '9') < coalesce(NEW.data->>'valide_le', '9') then garde := 'rejete';
  else garde := 'valide';
  end if;
  if garde = 'valide' then
    NEW.data := (NEW.data - 'rejete_le' - 'rejete_par' - 'motif_rejet')
      || jsonb_build_object('rejete', false);
  else
    NEW.data := (NEW.data - 'valide_le' - 'valide_par' - 'valide_role')
      || jsonb_build_object('valide', false);
  end if;
  NEW.data := NEW.data || jsonb_build_object('decision_corrigee_serveur',
    jsonb_build_object('conservee', garde, 'le', now()));
  return NEW;
end;
$$;

drop trigger if exists trg_pi_caisse_decision_definitive on public.pi_caisse_mouvements;
create trigger trg_pi_caisse_decision_definitive
  before insert or update on public.pi_caisse_mouvements
  for each row execute function public.pi_caisse_decision_definitive();
