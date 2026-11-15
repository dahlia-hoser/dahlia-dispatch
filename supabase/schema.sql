-- The Hosers' Dahlia Dispatch: database tables.
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Then do the same with seed.sql.

create table if not exists farms (
  id            bigint generated always as identity primary key,
  code          text unique not null,          -- short code, e.g. LW
  name          text not null,
  place         text,
  province      text,
  site          text,                           -- shop web address the checker reads
  platform      text not null default 'unknown',-- shopify | woocommerce | manual | unknown
  collection    text,                           -- optional Shopify collection to read (e.g. dahlia-tubers)
  active        boolean not null default true,
  last_checked_at timestamptz,
  last_error    text,
  created_at    timestamptz not null default now()
);

create table if not exists varieties (
  id         bigint generated always as identity primary key,
  slug       text unique not null,
  name       text not null,
  colour1    text,
  colour2    text,
  form       text,
  status     text not null default 'Suggested',  -- Suggested | Needs you | Confirmed
  notes      text,
  created_at timestamptz not null default now()
);

-- Every spelling that points to a variety, in matching form (lower case, no accents or symbols).
create table if not exists aliases (
  alias      text primary key,
  variety_id bigint not null references varieties(id) on delete cascade,
  shown      text                                    -- spelling to show as "Also sold as", null = hide
);

create table if not exists listings (
  id           bigint generated always as identity primary key,
  farm_id      bigint not null references farms(id) on delete cascade,
  product_key  text not null,                        -- the farm shop's own product id
  variety_id   bigint references varieties(id) on delete set null,
  title        text not null,                        -- name as the farm writes it
  url          text,
  price_cents  integer,
  currency     text default 'CAD',
  in_stock     boolean not null default false,
  kind         text not null default 'tuber',        -- tuber | cutting | other
  active       boolean not null default true,        -- false once it disappears from the shop
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  last_changed timestamptz not null default now(),
  unique (farm_id, product_key)
);
create index if not exists listings_variety on listings(variety_id);

create table if not exists sale_events (
  id         bigint generated always as identity primary key,
  farm_id    bigint not null references farms(id) on delete cascade,
  label      text,
  starts_at  timestamptz,                            -- exact opening time if known (turns on fast checking)
  when_text  text,                                   -- what the calendar shows, e.g. "Sun Nov 29"
  time_text  text,
  url        text,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists review_items (
  id          bigint generated always as identity primary key,
  kind        text not null,                         -- name | colour | form | farm
  status      text not null default 'open',          -- open | later | done
  data        jsonb not null default '{}'::jsonb,
  answer      jsonb,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists review_open on review_items(status);

create table if not exists farm_candidates (
  id           bigint generated always as identity primary key,
  name         text unique not null,
  place        text,
  province     text,
  site         text,
  platform     text,
  status       text not null default 'waiting',      -- waiting | suggested | yes | no | later
  suggested_at timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists check_runs (
  id        bigint generated always as identity primary key,
  ran_at    timestamptz not null default now(),
  checked   integer,
  changes   integer,
  errors    integer,
  summary   text
);

-- Lock every table. Only the site's server and the checker (which hold the secret key) can read or write.
alter table farms           enable row level security;
alter table varieties       enable row level security;
alter table aliases         enable row level security;
alter table listings        enable row level security;
alter table sale_events     enable row level security;
alter table review_items    enable row level security;
alter table farm_candidates enable row level security;
alter table check_runs      enable row level security;

-- Let only the secret key (used by the website's server and the checker) read and write these tables.
-- The public "anon" key gets no access at all.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
revoke all on all tables in schema public from anon, authenticated;
