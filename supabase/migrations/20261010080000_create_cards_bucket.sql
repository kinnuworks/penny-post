-- Card contents live here, named by the SHA-256 of their bytes.
-- Anyone can read a card they know the hash of. Nobody can write directly:
-- there are no insert policies, so only the `cards` edge function, which checks
-- each upload against the chain, can store one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', true, 400000, array['application/octet-stream'])
on conflict (id) do nothing;
