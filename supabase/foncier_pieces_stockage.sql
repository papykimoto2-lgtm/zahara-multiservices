-- ═══════════════════════════════════════════════════════════════════════════
-- Foncier Connect — stockage PRIVÉ des pièces jointes (titres, pièces d'identité, actes).
-- À exécuter sur le projet Supabase de Zahara ET sur celui de Menco, après foncier_connect.sql
-- (qui crée déjà la table pi_pieces_foncieres : métadonnées seulement). Idempotent.
--
-- · Bucket « pieces-foncieres » : PRIVÉ, 5 Mo max, PDF / JPG / PNG / WebP uniquement.
-- · Lecture et dépôt réservés au PERSONNEL (jeton avec claim app_role). Ni anon, ni souscripteur,
--   ni intervenant n'ont d'accès direct : ils passeront par une fonction serveur dédiée.
-- · AUCUNE règle UPDATE ni DELETE : un fichier déposé ne peut ni être remplacé ni supprimé
--   (preuve ; une nouvelle version est un nouvel objet). Chemin : {dossier_id}/{piece_id}.
-- · L'ERP obtient des URL signées de 2 minutes ; chaque consultation est journalisée côté dossier.
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pieces-foncieres', 'pieces-foncieres', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pieces_fonc_personnel_insert') then
    create policy pieces_fonc_personnel_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'pieces-foncieres' and (auth.jwt() ->> 'app_role') is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pieces_fonc_personnel_select') then
    create policy pieces_fonc_personnel_select on storage.objects
      for select to authenticated
      using (bucket_id = 'pieces-foncieres' and (auth.jwt() ->> 'app_role') is not null);
  end if;
end
$$;
