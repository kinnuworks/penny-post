-- Who the devnet counter has already sent a welcome card to. One per wallet.
-- Row level security is on with no policies, so only the counter function,
-- which runs as the service role, can read or write it.

create table public.counter_welcomes (
  wallet text primary key,
  card text,
  sent_at timestamptz not null default now()
);
alter table public.counter_welcomes enable row level security;
