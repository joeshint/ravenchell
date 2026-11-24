-- =============================================================================
-- rls_test.sql — security & workflow test for the CvSU Lost and Found schema
--
-- Run AFTER all migrations, in the Supabase SQL editor (or psql as `postgres`).
-- Everything runs inside one transaction and is ROLLED BACK at the end, so no
-- test users or rows are left behind.
--
-- Result: the last row says "ALL TESTS PASSED". Any failure stops the script
-- with an error that starts with "TEST FAILED:".
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Test helpers (dropped by the rollback)
-- -----------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

-- Switch the current role + JWT claims, the same way PostgREST does.
create function tests.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  if p_uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

create function tests.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'none', true);
end $$;

create function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'TEST FAILED: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

create function tests.throws(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok - % (blocked: %)', p_msg, sqlerrm;
    return;
  end;
  raise exception 'TEST FAILED: expected an error: %', p_msg;
end $$;

create function tests.id(p_key text) returns uuid language sql as $$
  select nullif(current_setting('tests.' || p_key, true), '')::uuid
$$;

create function tests.remember(p_key text, p_val uuid) returns void language sql as $$
  select set_config('tests.' || p_key, p_val::text, true);
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Test users
-- -----------------------------------------------------------------------------
select tests.remember('super',   'a0000000-0000-4000-8000-000000000001');
select tests.remember('admin',   'a0000000-0000-4000-8000-000000000002');
select tests.remember('alice',   'a0000000-0000-4000-8000-000000000003');  -- owner / claimant
select tests.remember('bob',     'a0000000-0000-4000-8000-000000000004');  -- finder
select tests.remember('mallory', 'a0000000-0000-4000-8000-000000000005');  -- attacker
select tests.remember('carol',   'a0000000-0000-4000-8000-000000000006');  -- competing claimant

insert into auth.users (id, email, raw_user_meta_data) values
  (tests.id('super'),   'test.super@cvsu.edu.ph',   '{"full_name":"Test Super","student_employee_id":"T-EMP-001","department":"OSAS","user_type":"personnel"}'),
  (tests.id('admin'),   'test.admin@cvsu.edu.ph',   '{"full_name":"Test Admin","student_employee_id":"T-EMP-002","department":"OSAS","user_type":"personnel"}'),
  (tests.id('alice'),   'test.alice@cvsu.edu.ph',   '{"full_name":"Alice Student","student_employee_id":"T-2021-0001","department":"CEIT","user_type":"student"}'),
  (tests.id('bob'),     'test.bob@cvsu.edu.ph',     '{"full_name":"Bob Faculty","student_employee_id":"T-FAC-0001","department":"CAS","user_type":"faculty"}'),
  (tests.id('mallory'), 'test.mallory@cvsu.edu.ph', '{"full_name":"Mallory","student_employee_id":"T-2021-0666","department":"CEIT","user_type":"student","role":"super_admin"}'),
  (tests.id('carol'),   'test.carol@cvsu.edu.ph',   '{"full_name":"Carol Student","student_employee_id":"T-2021-0002","department":"CEMDS","user_type":"student"}');

select tests.ok((select count(*) = 6 from public.profiles where institutional_email like 'test.%@cvsu.edu.ph'),
  'signup trigger creates a profile for each new auth user');
select tests.ok((select role = 'user' from public.profiles where id = tests.id('mallory')),
  'role in signup metadata is ignored (mallory is a plain user)');
select tests.throws($$insert into auth.users (id, email) values (gen_random_uuid(), 'outsider@gmail.com')$$,
  'non-CvSU email domains cannot register');

-- Bootstrap the super admin the way seed.sql does.
update public.profiles set role = 'super_admin' where id = tests.id('super');

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
select tests.act_as(tests.id('super'));
select tests.ok((select (public.admin_set_user_role(tests.id('admin'), 'admin')).role = 'admin'),
  'super admin can promote a user to admin');
select tests.throws(format($$select public.admin_set_user_role(%L, 'user')$$, tests.id('super')),
  'super admin cannot change their own role');

select tests.act_as(tests.id('admin'));
select tests.throws(format($$select public.admin_set_user_role(%L, 'admin')$$, tests.id('alice')),
  'a regular admin cannot grant roles');

select tests.act_as(tests.id('mallory'));
select tests.throws($$update public.profiles set role = 'super_admin' where id = tests.id('mallory')$$,
  'user cannot update their own role column');
select tests.throws($$update public.profiles set is_active = true where id = tests.id('mallory')$$,
  'user cannot update their own is_active column');
select tests.throws(format($$select public.admin_set_user_role(%L, 'super_admin')$$, tests.id('mallory')),
  'user cannot call admin_set_user_role');
select tests.ok((select count(*) = 1 from public.profiles),
  'user can read only their own profile');
select tests.ok((select count(*) = 0 from public.activity_logs),
  'user cannot read activity logs');
select tests.throws($$insert into public.item_categories (name, slug) values ('Hacked', 'hacked')$$,
  'user cannot create categories');
select tests.throws($$select public.get_admin_analytics()$$,
  'user cannot read admin analytics');
select tests.throws($$select public.notify_admins('system', 'spam')$$,
  'user cannot call internal notify_admins()');
select tests.throws($$select public.log_activity('fake.action')$$,
  'user cannot call internal log_activity()');
select tests.ok((select count(*) = 1 from public.profiles where full_name = 'Mallory'),
  'sanity: profile still readable');
update public.profiles set full_name = 'Mallory Updated' where id = tests.id('mallory');
select tests.ok((select full_name = 'Mallory Updated' from public.profiles where id = tests.id('mallory')),
  'user can update their own name');
select tests.throws($$update public.profiles set student_employee_id = 'T-NEW-ID' where id = tests.id('mallory')$$,
  'user cannot change an already-set Student/Employee ID');

-- -----------------------------------------------------------------------------
-- Found-item report (Bob)
-- -----------------------------------------------------------------------------
select tests.act_as(tests.id('bob'));
select tests.remember('found', (public.submit_found_report(
  p_item_name           => 'Black Android phone',
  p_category_id         => (select id from public.item_categories where slug = 'electronics'),
  p_description         => 'Black phone with a cracked screen protector, found on a bench.',
  p_date_found          => public.manila_today(),
  p_campus_id           => (select id from public.campuses where code = 'MAIN'),
  p_location_id         => (select cl.id from public.campus_locations cl join public.campuses c on c.id = cl.campus_id
                            where c.code = 'MAIN' and cl.name = 'Library'),
  p_image_path          => tests.id('bob')::text || '/phone.jpg',
  p_custody_location_id => (select cl.id from public.campus_locations cl join public.campuses c on c.id = cl.campus_id
                            where c.code = 'MAIN' and cl.is_custody_point limit 1),
  p_identifying_details => 'Lock screen shows a photo of a golden retriever; IMEI ends in 4471'
)).id);

select tests.ok((select status = 'pending_verification' and reference_no like 'FND-____-______'
                 from public.found_items where id = tests.id('found')),
  'found report starts as pending_verification with a FND reference number');
select tests.ok((select count(*) = 1 from public.found_item_private where found_item_id = tests.id('found')),
  'finder can read their own private details');
select tests.throws($$insert into public.found_items (reporter_id, item_name, category_id, description, date_found, campus_id, status)
  values (tests.id('bob'), 'Fake', (select id from public.item_categories limit 1), 'Trying to self-verify an item', current_date,
          (select id from public.campuses limit 1), 'verified')$$,
  'finder cannot set status on insert');
select tests.throws($$select public.submit_found_report('Future thing', (select id from public.item_categories limit 1),
  'Found tomorrow, apparently.', public.manila_today() + 2, (select id from public.campuses limit 1))$$,
  'date found cannot be in the future');
select tests.throws($$select public.submit_found_report('Wrong campus', (select id from public.item_categories limit 1),
  'Location from a different campus.', public.manila_today(), (select id from public.campuses where code = 'IMUS'),
  p_location_id => (select cl.id from public.campus_locations cl join public.campuses c on c.id = cl.campus_id where c.code = 'MAIN' limit 1))$$,
  'location must belong to the selected campus');
select tests.throws(format($$select public.submit_found_report('Stolen image path', (select id from public.item_categories limit 1),
  'Pointing at somebody else''s image.', public.manila_today(), (select id from public.campuses limit 1), p_image_path => %L)$$,
  tests.id('alice')::text || '/x.jpg'),
  'image_path must be inside the reporter''s own folder');

-- Not visible to the public or other users until verified.
select tests.act_as(null);
select tests.ok((select count(*) = 0 from public.found_items where id = tests.id('found')),
  'anon cannot see an unverified found item');
select tests.act_as(tests.id('alice'));
select tests.ok((select count(*) = 0 from public.found_items where id = tests.id('found')),
  'other users cannot see an unverified found item');
select tests.throws(format($$insert into public.claim_requests (found_item_id, claimant_id, ownership_description)
  values (%L, %L, 'This is my phone, I lost it at the library yesterday.')$$, tests.id('found'), tests.id('alice')),
  'cannot claim an unverified item');

-- -----------------------------------------------------------------------------
-- Lost-item report (Alice)
-- -----------------------------------------------------------------------------
select tests.remember('lost', (public.submit_lost_report(
  p_item_name     => 'Black Android phone',
  p_category_id   => (select id from public.item_categories where slug = 'electronics'),
  p_description   => 'Lost my black phone somewhere around the library.',
  p_date_lost     => public.manila_today() - 1,
  p_campus_id     => (select id from public.campuses where code = 'MAIN'),
  p_contact_phone => '09170000000'
)).id);
select tests.ok((select status = 'pending' and reference_no like 'LST-%' from public.lost_items where id = tests.id('lost')),
  'lost report starts as pending with an LST reference number');
select tests.ok((select (public.update_lost_report(tests.id('lost'), 'Black Android phone (Samsung)',
                   (select id from public.item_categories where slug = 'electronics'),
                   'Lost my black Samsung phone around the library.', public.manila_today() - 1,
                   (select id from public.campuses where code = 'MAIN'), p_contact_phone => '09171111111')).item_name
                 = 'Black Android phone (Samsung)'),
  'owner can edit a pending lost report');
select tests.ok((select contact_phone = '09171111111' from public.lost_item_private where lost_item_id = tests.id('lost')),
  'owner edit also updates private contact details');
select tests.throws(format($$update public.lost_items set status = 'approved' where id = %L$$, tests.id('lost')),
  'owner cannot approve their own lost report');

select tests.act_as(tests.id('mallory'));
select tests.ok((select count(*) = 0 from public.lost_item_private), 'other users cannot read lost-item contact details');
select tests.ok((select count(*) = 0 from public.lost_items where id = tests.id('lost')), 'other users cannot see a pending lost report');
delete from public.lost_items where id = tests.id('lost');
select tests.act_as(tests.id('alice'));
select tests.ok((select count(*) = 1 from public.lost_items where id = tests.id('lost')), 'other users cannot delete someone else''s report');

-- -----------------------------------------------------------------------------
-- Admin moderation
-- -----------------------------------------------------------------------------
select tests.act_as(tests.id('admin'));
select tests.throws(format($$select public.admin_review_lost_item(%L, 'reject')$$, tests.id('lost')),
  'rejecting requires a reason');
select tests.ok((select (public.admin_review_lost_item(tests.id('lost'), 'approve')).status = 'approved'),
  'admin approves the lost report');
select tests.ok((select (public.admin_review_found_item(tests.id('found'), 'verify', null,
                   array['What is the lock screen photo?', '  ', 'Last 4 digits of the IMEI?'])).status = 'verified'),
  'admin verifies the found report');
select tests.ok((select verification_questions = array['What is the lock screen photo?', 'Last 4 digits of the IMEI?']
                 from public.found_items where id = tests.id('found')),
  'blank verification questions are dropped');
select tests.throws(format($$select public.admin_review_found_item(%L, 'reject', 'x')$$, tests.id('found')),
  'invalid status transitions are rejected (verified -> rejected)');

select tests.act_as(null);
select tests.ok((select count(*) = 1 from public.found_items where id = tests.id('found')), 'anon can see a verified found item');
select tests.ok((select count(*) = 1 from public.lost_items where id = tests.id('lost')), 'anon can see an approved lost report');
select tests.throws($$select * from public.found_item_private$$, 'anon has no access to found_item_private');
select tests.throws($$select * from public.claim_requests$$, 'anon has no access to claim_requests');
select tests.ok((select (public.get_public_stats() ->> 'found_available')::int >= 1), 'anon can read public stats');

-- -----------------------------------------------------------------------------
-- Claims
-- -----------------------------------------------------------------------------
select tests.act_as(tests.id('bob'));
select tests.throws(format($$insert into public.claim_requests (found_item_id, claimant_id, ownership_description)
  values (%L, %L, 'Claiming the item I found myself, should fail.')$$, tests.id('found'), tests.id('bob')),
  'finder cannot claim their own found item');

select tests.act_as(tests.id('alice'));
select tests.ok((select count(*) = 0 from public.found_item_private), 'claimant cannot read the finder''s private details');
insert into public.claim_requests (found_item_id, claimant_id, lost_item_id, ownership_description, verification_answers, evidence_path)
values (tests.id('found'), tests.id('alice'), tests.id('lost'),
        'It is my Samsung phone; I left it on a library bench yesterday afternoon.',
        '[{"question":"What is the lock screen photo?","answer":"My golden retriever"}]',
        tests.id('alice')::text || '/receipt.pdf');
select tests.remember('claim', (select id from public.claim_requests where claimant_id = tests.id('alice')));
select tests.ok((select status = 'pending' and reference_no like 'CLM-%' from public.claim_requests where id = tests.id('claim')),
  'claim starts as pending with a CLM reference number');
select tests.throws(format($$insert into public.claim_requests (found_item_id, claimant_id, ownership_description)
  values (%L, %L, 'Submitting the same claim a second time.')$$, tests.id('found'), tests.id('alice')),
  'only one active claim per user per item');
select tests.throws(format($$update public.claim_requests set status = 'approved' where id = %L$$, tests.id('claim')),
  'claimant cannot approve their own claim');
select tests.throws(format($$select public.admin_update_claim(%L, 'approve')$$, tests.id('claim')),
  'claimant cannot call admin_update_claim');

select tests.act_as(tests.id('carol'));
insert into public.claim_requests (found_item_id, claimant_id, ownership_description)
values (tests.id('found'), tests.id('carol'), 'I also lost a black phone around that area last week.');
select tests.remember('claim2', (select id from public.claim_requests where claimant_id = tests.id('carol')));
select tests.ok((select count(*) = 1 from public.claim_requests), 'a claimant sees only their own claims');

select tests.act_as(tests.id('bob'));
select tests.ok((select count(*) = 0 from public.claim_requests), 'finder cannot see claims on their item');
select tests.ok((select count(*) = 2 from public.notifications where type = 'claim_submitted'),
  'finder is notified about each claim');

select tests.act_as(tests.id('admin'));
select tests.ok((select count(*) = 2 from public.claim_requests where found_item_id = tests.id('found')),
  'admin sees all claims');
select tests.ok((select (public.admin_update_claim(tests.id('claim'), 'review')).status = 'under_review'),
  'admin moves the claim to under_review');
select tests.ok((select (public.admin_update_claim(tests.id('claim'), 'approve', 'Answers match the private details.')).status = 'approved'),
  'admin approves the claim');
select tests.ok((select status = 'claimed' from public.found_items where id = tests.id('found')),
  'approving a claim marks the item as claimed');
select tests.ok((select status = 'rejected' from public.claim_requests where id = tests.id('claim2')),
  'competing open claims are rejected automatically');
select tests.throws(format($$select public.admin_release_claim(%L, 'Carol')$$, tests.id('claim2')),
  'a rejected claim cannot be released');
select tests.ok((select (public.admin_release_claim(tests.id('claim'), 'Alice Student', 'Checked school ID')).status = 'released'),
  'admin records the release');
select tests.ok((select status = 'released' and released_at is not null from public.found_items where id = tests.id('found')),
  'released claim marks the item as released');
select tests.ok((select status = 'resolved' from public.lost_items where id = tests.id('lost')),
  'the claimant''s linked lost report is resolved');
select tests.ok((select count(*) >= 4 from public.item_status_history where entity_type = 'claim' and entity_id = tests.id('claim')),
  'claim status history is recorded');
select tests.ok((select count(*) >= 1 from public.activity_logs where action = 'claim.release'),
  'admin actions are written to the activity log');
select tests.ok((select (public.get_admin_analytics() -> 'totals' ->> 'returned')::int >= 1),
  'admin analytics returns totals');

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
select tests.act_as(tests.id('alice'));
select tests.ok((select count(*) >= 3 from public.notifications), 'claimant received notifications');
update public.notifications set read_at = now() where user_id = tests.id('alice');
select tests.ok((select count(*) = 0 from public.notifications where read_at is null), 'user can mark notifications as read');
select tests.throws($$update public.notifications set title = 'changed'$$, 'user cannot edit notification content');
select tests.throws(format($$insert into public.notifications (user_id, title) values (%L, 'spoofed')$$, tests.id('bob')),
  'user cannot create notifications');
select tests.ok((select count(*) >= 1 from public.item_status_history where entity_id = tests.id('claim')),
  'claimant can read their own claim timeline');

select tests.act_as(tests.id('carol'));
select tests.ok((select count(*) = 0 from public.item_status_history where entity_id = tests.id('claim')),
  'users cannot read other people''s claim timelines');
select tests.ok((select count(*) = 1 from public.notifications where type = 'claim_rejected'),
  'losing claimant is notified');

-- -----------------------------------------------------------------------------
-- Storage object policies (rows only; no files are uploaded)
-- -----------------------------------------------------------------------------
select tests.act_as(tests.id('alice'));
insert into storage.objects (bucket_id, name) values ('claim-evidence', tests.id('alice')::text || '/test-evidence.pdf');
select tests.ok((select count(*) = 1 from storage.objects where bucket_id = 'claim-evidence'),
  'user can upload claim evidence to their own folder');
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('item-images', %L)$$,
  tests.id('bob')::text || '/planted.jpg'), 'user cannot upload into another user''s folder');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('item-images', 'no-folder.jpg')$$,
  'uploads outside a user folder are rejected');

select tests.act_as(tests.id('bob'));
select tests.ok((select count(*) = 0 from storage.objects where bucket_id = 'claim-evidence'),
  'other users cannot read someone''s claim evidence');

select tests.act_as(null);
select tests.ok((select count(*) = 0 from storage.objects), 'anon cannot list storage objects');

select tests.act_as(tests.id('admin'));
select tests.ok((select count(*) = 1 from storage.objects where bucket_id = 'claim-evidence'),
  'admin can read claim evidence');

-- -----------------------------------------------------------------------------
-- Claim edge cases: withdraw, revoke approval, archive with open claims, restore
-- -----------------------------------------------------------------------------
select tests.act_as(tests.id('bob'));
select tests.remember('found2', (public.submit_found_report(
  'Grey hoodie', (select id from public.item_categories where slug = 'clothing'),
  'Grey hoodie left on a chair in a classroom.', public.manila_today(),
  (select id from public.campuses where code = 'MAIN'))).id);
select tests.act_as(tests.id('admin'));
select public.admin_review_found_item(tests.id('found2'), 'verify');

select tests.act_as(tests.id('carol'));
insert into public.claim_requests (found_item_id, claimant_id, ownership_description)
values (tests.id('found2'), tests.id('carol'), 'My grey hoodie, size M, I left it in room 101.');
select tests.remember('claim3', (select id from public.claim_requests where found_item_id = tests.id('found2') and claimant_id = tests.id('carol')));

select tests.act_as(tests.id('alice'));
select tests.throws(format($$select public.cancel_my_claim(%L)$$, tests.id('claim3')),
  'users cannot withdraw someone else''s claim');
insert into public.claim_requests (found_item_id, claimant_id, ownership_description)
values (tests.id('found2'), tests.id('alice'), 'I think this grey hoodie is mine, it has a stain.');
select tests.remember('claim4', (select id from public.claim_requests where found_item_id = tests.id('found2') and claimant_id = tests.id('alice')));
select tests.ok((select (public.cancel_my_claim(tests.id('claim4'))).status = 'cancelled'),
  'claimant can withdraw their own pending claim');
select tests.throws(format($$select public.cancel_my_claim(%L)$$, tests.id('claim4')),
  'a withdrawn claim cannot be withdrawn again');

select tests.act_as(tests.id('admin'));
select public.admin_update_claim(tests.id('claim3'), 'approve');
select tests.ok((select status = 'claimed' from public.found_items where id = tests.id('found2')),
  'approval reserves the item');
select tests.throws(format($$select public.admin_update_claim(%L, 'reject')$$, tests.id('claim3')),
  'revoking an approval requires a reason');
select tests.ok((select (public.admin_update_claim(tests.id('claim3'), 'reject', 'Could not present an ID')).status = 'rejected'),
  'admin can revoke an approved claim');
select tests.ok((select status = 'verified' from public.found_items where id = tests.id('found2')),
  'revoking an approval makes the item claimable again');

select tests.act_as(tests.id('alice'));
insert into public.claim_requests (found_item_id, claimant_id, ownership_description)
values (tests.id('found2'), tests.id('alice'), 'Second try: grey hoodie with a stain on the sleeve.');
select tests.ok((select count(*) = 1 from public.claim_requests where found_item_id = tests.id('found2') and status = 'pending'),
  'a user may claim again after withdrawing');
select tests.remember('claim5', (select id from public.claim_requests where found_item_id = tests.id('found2') and status = 'pending'));

select tests.act_as(tests.id('admin'));
select tests.ok((select (public.admin_review_found_item(tests.id('found2'), 'archive')).status = 'archived'),
  'admin can archive a verified item');
select tests.ok((select status = 'rejected' from public.claim_requests where id = tests.id('claim5')),
  'archiving an item closes its open claims');
select tests.act_as(null);
select tests.ok((select count(*) = 0 from public.found_items where id = tests.id('found2')),
  'archived items are hidden from the public');
select tests.act_as(tests.id('admin'));
select tests.ok((select (public.admin_review_found_item(tests.id('found2'), 'verify')).status = 'verified'),
  'admin can restore an archived item');

-- -----------------------------------------------------------------------------
-- Report ownership edge cases
-- -----------------------------------------------------------------------------
select tests.act_as(tests.id('carol'));
select tests.remember('lost2', (public.submit_lost_report(
  'Blue tumbler', (select id from public.item_categories where slug = 'others'),
  'Blue tumbler with university stickers.', public.manila_today(),
  (select id from public.campuses where code = 'MAIN'))).id);

select tests.act_as(tests.id('bob'));
select tests.throws(format($$select public.update_lost_report(%L, 'Hacked', (select id from public.item_categories limit 1),
  'Changed by somebody else.', public.manila_today(), (select id from public.campuses limit 1))$$, tests.id('lost2')),
  'users cannot edit someone else''s report');
select tests.throws(format($$select public.mark_my_lost_item_resolved(%L)$$, tests.id('lost2')),
  'users cannot resolve someone else''s report');

select tests.act_as(tests.id('admin'));
select public.admin_review_lost_item(tests.id('lost2'), 'approve');

select tests.act_as(tests.id('carol'));
select tests.throws(format($$select public.update_lost_report(%L, 'Edited', (select id from public.item_categories limit 1),
  'Trying to edit after approval.', public.manila_today(), (select id from public.campuses limit 1))$$, tests.id('lost2')),
  'reports cannot be edited after they are approved');
do $$
declare n integer;
begin
  delete from public.lost_items where id = tests.id('lost2');
  get diagnostics n = row_count;
  perform tests.ok(n = 0, 'reports cannot be deleted after they are approved');
end $$;
select tests.ok((select (public.mark_my_lost_item_resolved(tests.id('lost2'))).status = 'resolved'),
  'owner can mark their listed report as recovered');

-- -----------------------------------------------------------------------------
-- Cross-user access, analytics, anonymous access, storage deletes
-- -----------------------------------------------------------------------------
select tests.act_as(tests.id('bob'));
do $$
declare n integer;
begin
  update public.profiles set full_name = 'Hacked Name' where id = tests.id('carol');
  get diagnostics n = row_count;
  perform tests.ok(n = 0, 'users cannot edit other users'' profiles');
end $$;
select tests.ok((select count(*) = 0 from public.notifications where user_id <> tests.id('bob')),
  'users cannot read other users'' notifications');

select tests.act_as(tests.id('admin'));
update public.profiles set student_employee_id = 'T-2021-0003' where id = tests.id('carol');
select tests.ok((select student_employee_id = 'T-2021-0003' from public.profiles where id = tests.id('carol')),
  'admins can correct a user''s Student/Employee ID');
select tests.throws($$select public.get_admin_analytics('2026-02-01', '2026-01-01')$$,
  'analytics rejects an inverted date range');
select tests.ok((select (public.get_admin_analytics(public.manila_today() - 7, public.manila_today()) -> 'totals' ->> 'lost_total')::int >= 1),
  'analytics accepts a date range');

select tests.act_as(null);
select tests.throws($$select public.submit_lost_report('x', (select id from public.item_categories limit 1),
  'Anonymous report attempt.', public.manila_today(), (select id from public.campuses limit 1))$$,
  'anonymous visitors cannot submit reports');
select tests.throws($$select public.get_user_dashboard()$$, 'anonymous visitors cannot read a user dashboard');

select tests.act_as(tests.id('alice'));
insert into storage.objects (bucket_id, name) values ('item-images', tests.id('alice')::text || '/bag.png');
select tests.act_as(tests.id('bob'));
-- Real Supabase forbids SQL deletes on storage.objects (storage.protect_delete);
-- there these two checks are skipped and covered by the manual checklist instead.
do $$
declare n integer;
begin
  delete from storage.objects where name like tests.id('alice')::text || '/%';
  get diagnostics n = row_count;
  perform tests.ok(n = 0, 'users cannot delete someone else''s files');
exception when insufficient_privilege then
  if sqlerrm like 'Direct deletion from storage tables%' then
    raise notice 'skipped - storage deletes must go through the Storage API (see docs/TESTING.md)';
  else
    raise;
  end if;
end $$;
select tests.act_as(tests.id('admin'));
do $$
declare n integer;
begin
  delete from storage.objects where bucket_id = 'item-images' and name like tests.id('alice')::text || '/%';
  get diagnostics n = row_count;
  perform tests.ok(n = 1, 'admins can remove an inappropriate item photo');
exception when insufficient_privilege then
  if sqlerrm like 'Direct deletion from storage tables%' then
    raise notice 'skipped - storage deletes must go through the Storage API (see docs/TESTING.md)';
  else
    raise;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Settings and deactivation
-- -----------------------------------------------------------------------------
select tests.act_as(null);
select tests.ok((select count(*) >= 1 from public.system_settings where key = 'allowed_email_domains'),
  'anon can read public settings');

select tests.act_as(tests.id('admin'));
update public.system_settings set value = 'false' where key = 'require_lost_approval';
select tests.ok((select value = 'true'::jsonb from public.system_settings where key = 'require_lost_approval'),
  'a regular admin cannot change system settings');
select tests.ok((select (public.admin_set_user_active(tests.id('mallory'), false)).is_active = false),
  'admin can deactivate a user');
select tests.throws(format($$select public.admin_set_user_active(%L, false)$$, tests.id('super')),
  'admin cannot deactivate a super admin');

select tests.act_as(tests.id('mallory'));
select tests.throws($$select public.submit_lost_report('Anything', (select id from public.item_categories limit 1),
  'A deactivated user tries to post.', public.manila_today(), (select id from public.campuses limit 1))$$,
  'deactivated users cannot submit reports');

select tests.act_as(tests.id('super'));
update public.system_settings set value = 'false' where key = 'require_lost_approval';
select tests.ok((select value = 'false'::jsonb from public.system_settings where key = 'require_lost_approval'),
  'super admin can change system settings');
select tests.ok((select count(*) >= 1 from public.activity_logs where action = 'settings.update'),
  'settings changes are audited');

select tests.act_as(tests.id('alice'));
select tests.ok((select (public.submit_lost_report('Pencil case', (select id from public.item_categories where slug = 'others'),
  'Green pencil case with highlighters.', public.manila_today(), (select id from public.campuses where code = 'MAIN'))).status = 'approved'),
  'with approval turned off, lost reports are listed immediately');

select tests.as_postgres();
select 'ALL TESTS PASSED' as result;

rollback;
