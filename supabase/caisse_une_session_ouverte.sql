-- Une seule session de caisse ouverte par caisse (garantie côté base).
-- À appliquer APRÈS la publication du code qui gère le refus (caisseOuvrir / caisseVerifierSessionCloud).
-- Pré-contrôle : cette requête doit renvoyer 0 ligne.
--   select data->>'caisse_id', count(*) from pi_caisse_sessions where data->>'statut'='ouverte' group by 1 having count(*)>1;
create unique index if not exists uq_pi_caisse_sessions_une_ouverte
  on public.pi_caisse_sessions ((data->>'caisse_id'))
  where data->>'statut' = 'ouverte';
-- Retour arrière : drop index public.uq_pi_caisse_sessions_une_ouverte;
