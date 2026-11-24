-- =============================================================================
-- seed.sql — DEVELOPMENT ONLY
--
-- Reference data (categories, campuses, locations, settings) is NOT here; it
-- lives in migrations/0007_reference_data.sql because every environment needs it.
--
-- This file only bootstraps the first super administrator. There is
-- deliberately no way to do this from the app.
--
-- Steps:
--   1. Register normally in the app with your @cvsu.edu.ph email.
--   2. Replace the email below and run this file in the Supabase SQL editor.
-- =============================================================================

do $$
declare
  v_email constant text := 'your.name@cvsu.edu.ph';   -- <== change me
  v_count integer;
begin
  update public.profiles
     set role = 'super_admin', is_active = true
   where institutional_email = lower(v_email);
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise notice 'No profile found for %. Register in the app first.', v_email;
  else
    insert into public.activity_logs (actor_id, action, entity_type, entity_id, details)
    select id, 'user.role_changed', 'profile', id,
           jsonb_build_object('email', institutional_email, 'to', 'super_admin', 'via', 'seed.sql bootstrap')
    from public.profiles where institutional_email = lower(v_email);
    raise notice '% is now a super administrator.', v_email;
  end if;
end;
$$;

-- Development convenience: allow any email domain (e.g. Gmail test accounts).
-- NEVER run this in production.
-- update public.system_settings set value = '[]' where key = 'allowed_email_domains';
