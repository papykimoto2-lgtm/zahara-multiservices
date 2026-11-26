-- ═══════════════════════════════════════════════════════════════════════════
-- Lot B — C5 (revue 26/11/2026) : pull_incremental() ne doit plus lire toute la base avec la clé publique.
-- PRÉALABLES : lot_b_garde_attestation.sql et pull_incremental_complet.sql appliqués ; IMMO_SYNC_ANON_FALLBACK = false déployé ;
--   chaque poste connecté avec un jeton du personnel (sinon le pull échoue : la synchronisation descendante s'arrête).
-- À appliquer avec la VAGUE A. Retour arrière en bas de fichier.
-- ═══════════════════════════════════════════════════════════════════════════
update attestation_garde.config set pull_restreint = true where id;
do $$ begin
  if to_regprocedure('public.pull_incremental_v1(jsonb)') is not null then
    revoke execute on function public.pull_incremental_v1(jsonb) from public, anon;
    grant  execute on function public.pull_incremental_v1(jsonb) to authenticated, service_role;
  end if;
end $$;
-- Vérification (doit être refusé avec la clé publique, accepté avec un jeton du personnel) :
--   curl -s -X POST "$URL/rest/v1/rpc/pull_incremental" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"cursors":{}}'
-- RETOUR ARRIÈRE :
--   update attestation_garde.config set pull_restreint = false where id;
--   grant execute on function public.pull_incremental_v1(jsonb) to anon;
