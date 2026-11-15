-- Update 2 (Nov 15, 2026): shipping and pickup for farms, descriptions for listings,
-- "new introduction" year and Canadian-bred for varieties.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run more than once.

alter table farms add column if not exists ships_to text;          -- 'all' = across Canada, or provinces like 'BC,AB'
alter table farms add column if not exists ship_window text;       -- e.g. 'April–May'
alter table farms add column if not exists ship_cost text;         -- e.g. '$18, free over $250'
alter table farms add column if not exists pickup text;            -- where pickup happens, empty = no pickup
alter table farms add column if not exists shipping_checked_at timestamptz;

alter table listings add column if not exists description text;    -- start of the farm's description, for spotting new introductions

alter table varieties add column if not exists intro_year integer; -- year it was introduced, if a farm says so
alter table varieties add column if not exists canadian_bred boolean; -- empty = decide from the name

grant all on all tables in schema public to service_role;
