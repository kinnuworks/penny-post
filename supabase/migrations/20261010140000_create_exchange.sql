-- The pen-pal exchange: send a card to a stranger, and the next stranger's card
-- comes to you. These tables only remember who is owed a card. They hold no
-- keys, no messages and no money.
--
-- Row level security is on with no policies, so nothing can read or write
-- these tables except the `exchange` edge function.

create table if not exists public.exchange_members (
  cluster text not null check (cluster in ('devnet', 'mainnet')),
  wallet text not null,
  -- Cards this wallet has sent through the exchange and not yet been sent in return.
  owed integer not null default 0 check (owed >= 0),
  joined_at timestamptz not null default now(),
  last_received_at timestamptz,
  primary key (cluster, wallet)
);

create table if not exists public.exchange_draws (
  id bigint generated always as identity primary key,
  cluster text not null check (cluster in ('devnet', 'mainnet')),
  drawer text not null,
  recipient text not null,
  drawn_at timestamptz not null default now(),
  -- Set once the card is seen on-chain. A card can settle one draw only.
  card text unique,
  fulfilled_at timestamptz
);

create index if not exists exchange_draws_open
  on public.exchange_draws (cluster, drawer)
  where fulfilled_at is null;

create index if not exists exchange_members_waiting
  on public.exchange_members (cluster, last_received_at nulls first, joined_at)
  where owed > 0;

alter table public.exchange_members enable row level security;
alter table public.exchange_draws enable row level security;
