-- Arc-en-Ciel Connect — V3 · 011 Signature numérique des documents (ECDSA P-256)
-- Principe (même que ANGEL'S GROUP) : la clé PRIVÉE ne quitte jamais l'appareil du signataire (CryptoKey non exportable) ;
-- la base ne garde que la clé PUBLIQUE et le registre des documents signés. La vérification se fait dans le navigateur de qui scanne le QR.

insert into app.permissions (code, libelle) values ('signature.gerer','Signer des documents au nom de la cité');
insert into app.role_permissions (role_code, perm_code) values ('president','signature.gerer'),('tresorier','signature.gerer'),('secretaire','signature.gerer'),('controleur','signature.gerer');

create table app.signing_keys (
  kid text primary key check (kid ~ '^[A-Za-z0-9_-]{8,64}$'),
  jwk jsonb not null check (jwk->>'kty' = 'EC' and jwk->>'crv' = 'P-256' and jwk ? 'x' and jwk ? 'y' and not (jwk ? 'd')),   -- jamais de partie privée
  titulaire uuid not null default auth.uid(),
  fonction text not null check (length(trim(fonction)) >= 3),
  cree_le timestamptz not null default now(),
  revoquee_le timestamptz, motif_revocation text,
  check (revoquee_le is null or length(coalesce(motif_revocation,'')) >= 5)
);
create table app.signed_documents (
  ref text primary key check (ref ~ '^[A-Za-z0-9._-]{6,64}$'),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  kid text not null references app.signing_keys(kid),
  signature text not null check (signature ~ '^[A-Za-z0-9_-]{80,100}$'),     -- ECDSA P-256 brute (r||s), 64 octets en base64url
  titre text not null, canon text not null,
  signe_par uuid not null default auth.uid(),
  signe_le timestamptz not null default now()
);
create or replace function app.immuable_signature() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'signing_keys' and tg_op = 'UPDATE' then      -- seule la révocation (une fois) est permise
    if (to_jsonb(new) - 'revoquee_le' - 'motif_revocation') is not distinct from (to_jsonb(old) - 'revoquee_le' - 'motif_revocation') and (to_jsonb(old)->>'revoquee_le') is null then return new; end if;
  end if;
  raise exception 'Registre de signature immuable (%).', tg_op using errcode='42501';
end $$;
create trigger sk_garde before update or delete on app.signing_keys for each row execute function app.immuable_signature();
create trigger sd_garde before update or delete on app.signed_documents for each row execute function app.immuable_signature();

create or replace function app.enregistrer_cle(p_kid text, p_jwk jsonb, p_fonction text) returns void
language plpgsql security definer set search_path = app, public as $$
begin
  if not app.a_perm('signature.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  insert into app.signing_keys (kid, jwk, fonction) values (p_kid, p_jwk, p_fonction);
  perform app.journaliser('CLE_SIGNATURE', 'signing_keys', p_kid, null, jsonb_build_object('fonction', p_fonction));
exception when unique_violation then raise exception 'Identifiant de clé déjà utilisé.';
end $$;
create or replace function app.revoquer_cle(p_kid text, p_motif text) returns void
language plpgsql security definer set search_path = app, public as $$
declare k app.signing_keys;
begin
  select * into k from app.signing_keys where kid = p_kid for update;
  if not found then raise exception 'Clé inconnue.'; end if;
  if k.titulaire <> auth.uid() and not app.a_role('president') then raise exception 'Seul le titulaire ou le président révoque une clé.' using errcode='42501'; end if;
  if k.revoquee_le is not null then raise exception 'Clé déjà révoquée.'; end if;
  if length(coalesce(trim(p_motif),'')) < 5 then raise exception 'Motif obligatoire.'; end if;
  update app.signing_keys set revoquee_le = now(), motif_revocation = p_motif where kid = p_kid;
  perform app.journaliser('CLE_REVOQUEE', 'signing_keys', p_kid, null, jsonb_build_object('motif', p_motif));
end $$;
create or replace function app.enregistrer_signature(p_ref text, p_hash text, p_kid text, p_signature text, p_titre text, p_canon text) returns void
language plpgsql security definer set search_path = app, public as $$
declare k app.signing_keys;
begin
  if not app.a_perm('signature.gerer') then raise exception 'Droit insuffisant.' using errcode='42501'; end if;
  select * into k from app.signing_keys where kid = p_kid;
  if not found or k.titulaire <> auth.uid() then raise exception 'Clé inconnue ou non titulaire.' using errcode='42501'; end if;
  if k.revoquee_le is not null then raise exception 'Clé révoquée : signature refusée.'; end if;
  if p_canon <> 'ARC1|' || p_ref || '|' || p_hash || '|' || p_kid then raise exception 'Format signé incohérent.'; end if;
  insert into app.signed_documents (ref, hash, kid, signature, titre, canon) values (p_ref, p_hash, p_kid, p_signature, left(p_titre, 160), p_canon);
  perform app.journaliser('DOCUMENT_SIGNE', 'signed_documents', p_ref, null, jsonb_build_object('titre', left(p_titre, 160), 'hash', p_hash, 'kid', p_kid));
exception when unique_violation then raise exception 'Cette référence est déjà signée.';
end $$;

-- Vérification publique (aucune connexion) : ne renvoie que ce qu'imprime déjà le QR, la clé PUBLIQUE et l'état de révocation.
create or replace function app.verifier_signature(p_ref text) returns jsonb
language sql stable security definer set search_path = app, public as $$
  select coalesce((select jsonb_build_object('ref', d.ref, 'hash', d.hash, 'kid', d.kid, 'signature', d.signature, 'canon', d.canon, 'titre', d.titre, 'signe_le', d.signe_le,
           'jwk', k.jwk, 'fonction', k.fonction, 'revoquee_le', k.revoquee_le, 'motif_revocation', k.motif_revocation)
         from app.signed_documents d join app.signing_keys k on k.kid = d.kid where d.ref = left(p_ref, 64)), jsonb_build_object('inconnu', true));
$$;

revoke execute on all functions in schema app from public, anon;      -- puis uniquement les droits ci-dessous
grant execute on function app.enregistrer_cle(text,jsonb,text), app.revoquer_cle(text,text), app.enregistrer_signature(text,text,text,text,text,text) to authenticated;
grant execute on function app.verifier_signature(text) to anon, authenticated;
grant usage on schema app to anon;                                   -- uniquement pour l'appel ci-dessus : aucune table n'est accordée à anon
revoke all on app.signing_keys, app.signed_documents from anon, public;
grant select on app.signing_keys, app.signed_documents to authenticated;
alter table app.signing_keys enable row level security; alter table app.signed_documents enable row level security;
create policy sel_sk on app.signing_keys for select to authenticated using (titulaire = auth.uid() or app.a_perm('audit.lire') or app.a_perm('finance.lire'));
create policy sel_sd on app.signed_documents for select to authenticated using (signe_par = auth.uid() or app.a_perm('audit.lire') or app.a_perm('finance.lire'));
