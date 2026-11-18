-- Update 3 (Nov 17, 2026): farm photos on the review list.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run more than once.

alter table listings add column if not exists image text;   -- the farm's main product photo (owner's review list only)

grant all on all tables in schema public to service_role;
