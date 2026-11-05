-- Documents joints : synchronisation de la LISTE seule (sans le contenu des fichiers).
-- Les postes admin / manager lisent le contenu à la demande (pi_documents). Les autres ne reçoivent que la liste.
-- Idempotent. Les postes qui n'envoient pas _docs_legers = 'oui' reçoivent l'ancien comportement (lots de 30 Mo).

create table if not exists public.pi_documents_meta (
  id text primary key,
  data jsonb,
  updated_at timestamptz
);
create index if not exists pi_documents_meta_updated_idx on public.pi_documents_meta (updated_at);
alter table public.pi_documents_meta enable row level security;   -- aucune politique : lisible seulement via pull_incremental (SECURITY DEFINER)

create or replace function public._docs_meta_sync() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  if tg_op = 'DELETE' then
    delete from public.pi_documents_meta where id = old.id;
    return old;
  end if;
  insert into public.pi_documents_meta (id, data, updated_at)
  values (new.id, (new.data - 'blob') || '{"_sans_contenu": true}'::jsonb, new.updated_at)
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return new;
end
$f$;

drop trigger if exists _docs_meta_sync on public.pi_documents;
create trigger _docs_meta_sync after insert or update or delete on public.pi_documents
  for each row execute function public._docs_meta_sync();

insert into public.pi_documents_meta (id, data, updated_at)
select id, (data - 'blob') || '{"_sans_contenu": true}'::jsonb, updated_at from public.pi_documents
on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;

-- pull_incremental devient un relais : l'ancienne fonction est conservée sous le nom pull_incremental_v1.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'pull_incremental_v1' and pronamespace = 'public'::regnamespace) then
    alter function public.pull_incremental(jsonb) rename to pull_incremental_v1;
  end if;
end $$;

create or replace function public.pull_incremental(cursors jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare
  result jsonb;
  t text;
  cur text;
  rows jsonb;
  c jsonb := coalesce(cursors, '{}'::jsonb);
  cur_docs text := nullif(coalesce(cursors, '{}'::jsonb)->>'pi_documents', '');
  docs_legers boolean := coalesce(cursors, '{}'::jsonb)->>'_docs_legers' = 'oui';
  lot_octets constant bigint := 30 * 1024 * 1024;
  borne timestamptz;
begin
  result := public.pull_incremental_v1(c || jsonb_build_object('pi_documents', '9999-12-31T00:00:00Z'));

  if docs_legers then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'data', data, 'updated_at', updated_at) order by updated_at, id), '[]'::jsonb)
      into rows
    from public.pi_documents_meta
    where cur_docs is null or updated_at > cur_docs::timestamptz;
  else
    select max(updated_at) into borne
    from (
      select updated_at,
             sum(pg_column_size(data)) over (order by updated_at, id) - pg_column_size(data) as avant
      from public.pi_documents
      where cur_docs is null or updated_at > cur_docs::timestamptz
    ) s
    where avant < lot_octets;
    if borne is null then
      rows := '[]'::jsonb;
    else
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'data', data, 'updated_at', updated_at) order by updated_at, id), '[]'::jsonb)
        into rows
      from public.pi_documents
      where (cur_docs is null or updated_at > cur_docs::timestamptz) and updated_at <= borne;
    end if;
  end if;
  result := result || jsonb_build_object('pi_documents', rows);

  for t in select jsonb_object_keys(c) loop
    continue when result ? t;
    continue when t !~ '^pi_[a-z0-9_]+$';
    continue when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = t
                     and column_name in ('id','data','updated_at')) < 3;
    cur := c->>t;
    if cur is null or cur = '' then
      execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'', id, ''data'', data, ''updated_at'', updated_at)), ''[]''::jsonb) from public.%I', t) into rows;
    else
      execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'', id, ''data'', data, ''updated_at'', updated_at)), ''[]''::jsonb) from public.%I where updated_at > $1::timestamptz', t) into rows using cur;
    end if;
    result := result || jsonb_build_object(t, rows);
  end loop;
  return result;
end;
$f$;
