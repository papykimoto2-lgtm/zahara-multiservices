-- Simule le strict nécessaire de Supabase pour tester les migrations en local.
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create extension if not exists btree_gist;
create schema t;
grant usage on schema t to authenticated;
create function t.err(q text, frag text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm like '%' || frag || '%' then return; end if;
    raise exception 'FAUX MESSAGE: "%" (attendu "%") pour: %', sqlerrm, frag, q;
  end;
  raise exception 'ERREUR ATTENDUE NON LEVÉE (%): %', frag, q;
end $$;
create function t.eq(a anyelement, b anyelement, label text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ECHEC %: obtenu %, attendu %', label, a, b; end if; raise notice 'ok  %', label; end $$;
grant execute on all functions in schema t to authenticated;
create function t.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); end $$;
