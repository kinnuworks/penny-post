-- Where the devnet counter keeps its key. See supabase/functions/counter.
--
-- The key is for a devnet wallet that holds test SOL and stand-in tokens. It
-- sits in a schema the API does not serve, and only the service role, which
-- the counter function runs as, can read it. The row itself is put in by hand
-- and is not part of this migration.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table private.counter_keys (
  cluster text primary key,
  secret_key jsonb not null
);

create function public.counter_key(for_cluster text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select secret_key from private.counter_keys where cluster = for_cluster
$$;

revoke execute on function public.counter_key(text) from public, anon, authenticated;
grant execute on function public.counter_key(text) to service_role;
