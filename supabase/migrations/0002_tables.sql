-- =============================================================================
-- 0002_tables.sql
-- CvSU Lost and Found System — tables, constraints and indexes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: 1:1 with auth.users. Created by trigger (see 0003), never by clients.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  full_name           text not null,
  institutional_email text not null,
  student_employee_id text,
  department          text,
  user_type           public.user_type not null default 'student',
  role                public.app_role not null default 'user',
  avatar_url          text,
  phone               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint profiles_full_name_len   check (char_length(btrim(full_name)) between 2 and 120),
  constraint profiles_email_lower     check (institutional_email = lower(institutional_email)),
  constraint profiles_student_id_len  check (student_employee_id is null or char_length(btrim(student_employee_id)) between 3 and 30),
  constraint profiles_department_len  check (department is null or char_length(department) <= 150),
  constraint profiles_phone_len       check (phone is null or char_length(phone) <= 30),
  constraint profiles_avatar_url_len  check (avatar_url is null or char_length(avatar_url) <= 500)
);

create unique index profiles_email_key       on public.profiles (institutional_email);
create unique index profiles_student_id_key  on public.profiles (lower(student_employee_id)) where student_employee_id is not null;
create index        profiles_role_idx        on public.profiles (role);
create index        profiles_full_name_trgm  on public.profiles using gin (full_name extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Lookup tables
-- -----------------------------------------------------------------------------
create table public.item_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  description text,
  icon        text,                      -- lucide-react icon name, e.g. 'Smartphone'
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint item_categories_name_len    check (char_length(btrim(name)) between 2 and 60),
  constraint item_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint item_categories_desc_len    check (description is null or char_length(description) <= 300),
  constraint item_categories_icon_len    check (icon is null or char_length(icon) <= 40)
);
create unique index item_categories_name_key on public.item_categories (lower(name));
create unique index item_categories_slug_key on public.item_categories (slug);

create table public.campuses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null,
  address     text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint campuses_name_len    check (char_length(btrim(name)) between 2 and 120),
  constraint campuses_code_format check (code ~ '^[A-Z0-9]{2,12}$'),
  constraint campuses_address_len check (address is null or char_length(address) <= 300)
);
create unique index campuses_name_key on public.campuses (lower(name));
create unique index campuses_code_key on public.campuses (code);

create table public.campus_locations (
  id               uuid primary key default gen_random_uuid(),
  campus_id        uuid not null references public.campuses (id) on delete cascade,
  name             text not null,
  description      text,
  is_custody_point boolean not null default false,  -- where found items are kept (OSAS, guard house)
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint campus_locations_name_len check (char_length(btrim(name)) between 2 and 120),
  constraint campus_locations_desc_len check (description is null or char_length(description) <= 300)
);
create unique index campus_locations_campus_name_key on public.campus_locations (campus_id, lower(name));
create index        campus_locations_campus_idx      on public.campus_locations (campus_id);

-- -----------------------------------------------------------------------------
-- Lost items (public-safe columns only — sensitive data lives in lost_item_private)
-- -----------------------------------------------------------------------------
create table public.lost_items (
  id               uuid primary key default gen_random_uuid(),
  reference_no     text not null,
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  item_name        text not null,
  category_id      uuid not null references public.item_categories (id) on delete restrict,
  description      text not null,
  date_lost        date not null,
  time_lost        time,
  campus_id        uuid not null references public.campuses (id) on delete restrict,
  location_id      uuid references public.campus_locations (id) on delete set null,
  location_details text,
  image_path       text,                 -- path inside the `item-images` bucket
  status           public.lost_status not null default 'pending',
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lost_items_reference_no_key  unique (reference_no),
  constraint lost_items_item_name_len     check (char_length(btrim(item_name)) between 2 and 120),
  constraint lost_items_description_len  check (char_length(btrim(description)) between 10 and 2000),
  constraint lost_items_location_det_len  check (location_details is null or char_length(location_details) <= 300),
  constraint lost_items_image_path_len    check (image_path is null or char_length(image_path) <= 500),
  constraint lost_items_resolved_at       check (status <> 'resolved' or resolved_at is not null)
);
create index lost_items_status_created_idx on public.lost_items (status, created_at desc);
create index lost_items_reporter_idx       on public.lost_items (reporter_id);
create index lost_items_category_idx       on public.lost_items (category_id);
create index lost_items_campus_idx         on public.lost_items (campus_id);
create index lost_items_location_idx       on public.lost_items (location_id);
create index lost_items_date_idx           on public.lost_items (date_lost);
create index lost_items_name_trgm          on public.lost_items using gin (item_name extensions.gin_trgm_ops);

create table public.lost_item_private (
  lost_item_id        uuid primary key references public.lost_items (id) on delete cascade,
  identifying_details text,
  contact_name        text,
  contact_phone       text,
  contact_email       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint lost_private_ident_len   check (identifying_details is null or char_length(identifying_details) <= 2000),
  constraint lost_private_name_len    check (contact_name is null or char_length(contact_name) <= 120),
  constraint lost_private_phone_len   check (contact_phone is null or char_length(contact_phone) <= 30),
  constraint lost_private_email_len   check (contact_email is null or char_length(contact_email) <= 254)
);

-- -----------------------------------------------------------------------------
-- Found items (public-safe columns only — sensitive data lives in found_item_private)
-- -----------------------------------------------------------------------------
create table public.found_items (
  id                     uuid primary key default gen_random_uuid(),
  reference_no           text not null,
  reporter_id            uuid not null references public.profiles (id) on delete cascade,
  item_name              text not null,
  category_id            uuid not null references public.item_categories (id) on delete restrict,
  description            text not null,  -- generic; must not reveal identifying marks
  date_found             date not null,
  time_found             time,
  campus_id              uuid not null references public.campuses (id) on delete restrict,
  location_id            uuid references public.campus_locations (id) on delete set null,
  location_details       text,
  image_path             text,
  custody_location_id    uuid references public.campus_locations (id) on delete set null,
  status                 public.found_status not null default 'pending_verification',
  verification_questions text[] not null default '{}',  -- shown to claimants; answers are never stored here
  verified_by            uuid references public.profiles (id) on delete set null,
  verified_at            timestamptz,
  released_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint found_items_reference_no_key unique (reference_no),
  constraint found_items_item_name_len    check (char_length(btrim(item_name)) between 2 and 120),
  constraint found_items_description_len  check (char_length(btrim(description)) between 10 and 2000),
  constraint found_items_location_det_len check (location_details is null or char_length(location_details) <= 300),
  constraint found_items_image_path_len   check (image_path is null or char_length(image_path) <= 500),
  constraint found_items_questions_max    check (cardinality(verification_questions) <= 5),
  constraint found_items_verified_state   check (status not in ('verified', 'claimed', 'released') or verified_at is not null),
  constraint found_items_released_state   check (status <> 'released' or released_at is not null)
);
create index found_items_status_created_idx on public.found_items (status, created_at desc);
create index found_items_reporter_idx       on public.found_items (reporter_id);
create index found_items_category_idx       on public.found_items (category_id);
create index found_items_campus_idx         on public.found_items (campus_id);
create index found_items_location_idx       on public.found_items (location_id);
create index found_items_custody_idx        on public.found_items (custody_location_id);
create index found_items_date_idx           on public.found_items (date_found);
create index found_items_name_trgm          on public.found_items using gin (item_name extensions.gin_trgm_ops);

create table public.found_item_private (
  found_item_id       uuid primary key references public.found_items (id) on delete cascade,
  identifying_details text,   -- serial numbers, contents, distinctive marks
  additional_info     text,
  custody_notes       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint found_private_ident_len   check (identifying_details is null or char_length(identifying_details) <= 2000),
  constraint found_private_info_len    check (additional_info is null or char_length(additional_info) <= 2000),
  constraint found_private_custody_len check (custody_notes is null or char_length(custody_notes) <= 500)
);

-- -----------------------------------------------------------------------------
-- Claim requests
-- -----------------------------------------------------------------------------
create table public.claim_requests (
  id                    uuid primary key default gen_random_uuid(),
  reference_no          text not null,
  found_item_id         uuid not null references public.found_items (id) on delete cascade,
  claimant_id           uuid not null references public.profiles (id) on delete cascade,
  lost_item_id          uuid references public.lost_items (id) on delete set null,  -- claimant's own lost report, optional
  ownership_description text not null,
  verification_answers  jsonb not null default '[]'::jsonb,  -- [{ "question": "...", "answer": "..." }]
  evidence_path         text,                                -- path inside the private `claim-evidence` bucket
  contact_phone         text,
  status                public.claim_status not null default 'pending',
  reviewed_by           uuid references public.profiles (id) on delete set null,
  reviewed_at           timestamptz,
  review_notes          text,
  released_at           timestamptz,
  released_by           uuid references public.profiles (id) on delete set null,
  released_to_name      text,
  release_notes         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint claim_requests_reference_no_key unique (reference_no),
  constraint claim_ownership_len        check (char_length(btrim(ownership_description)) between 20 and 3000),
  constraint claim_answers_is_array     check (jsonb_typeof(verification_answers) = 'array' and jsonb_array_length(verification_answers) <= 10),
  constraint claim_evidence_path_len    check (evidence_path is null or char_length(evidence_path) <= 500),
  constraint claim_contact_phone_len    check (contact_phone is null or char_length(contact_phone) <= 30),
  constraint claim_review_notes_len     check (review_notes is null or char_length(review_notes) <= 2000),
  constraint claim_release_notes_len    check (release_notes is null or char_length(release_notes) <= 2000),
  constraint claim_released_to_len      check (released_to_name is null or char_length(btrim(released_to_name)) between 2 and 120),
  constraint claim_reviewed_state       check (status not in ('approved', 'rejected', 'released') or reviewed_at is not null),
  constraint claim_released_state       check (status <> 'released' or (released_at is not null and released_by is not null and released_to_name is not null))
);
create index claim_requests_item_idx      on public.claim_requests (found_item_id);
create index claim_requests_claimant_idx  on public.claim_requests (claimant_id);
create index claim_requests_status_idx    on public.claim_requests (status, created_at desc);
-- A user can have only one active claim per item.
create unique index claim_requests_one_active_per_user
  on public.claim_requests (found_item_id, claimant_id)
  where status in ('pending', 'under_review', 'approved');
-- An item can have only one approved/released claim.
create unique index claim_requests_one_winner_per_item
  on public.claim_requests (found_item_id)
  where status in ('approved', 'released');

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null default 'system',
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_len check (char_length(title) between 1 and 150),
  constraint notifications_body_len  check (body is null or char_length(body) <= 1000),
  constraint notifications_link_len  check (link is null or char_length(link) <= 300)
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx  on public.notifications (user_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- Audit trail (append-only; written only by SECURITY DEFINER functions)
-- -----------------------------------------------------------------------------
create table public.activity_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint activity_logs_action_len check (char_length(action) between 1 and 80)
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_actor_idx   on public.activity_logs (actor_id);
create index activity_logs_entity_idx  on public.activity_logs (entity_type, entity_id);
create index activity_logs_action_idx  on public.activity_logs (action);

-- -----------------------------------------------------------------------------
-- Status timeline for items and claims (written by trigger)
-- -----------------------------------------------------------------------------
create table public.item_status_history (
  id          bigint generated always as identity primary key,
  entity_type text not null,
  entity_id   uuid not null,
  from_status text,
  to_status   text not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  constraint item_status_history_entity_type check (entity_type in ('lost_item', 'found_item', 'claim'))
);
create index item_status_history_entity_idx on public.item_status_history (entity_type, entity_id, created_at);

-- -----------------------------------------------------------------------------
-- System settings (key/value)
-- -----------------------------------------------------------------------------
create table public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_public   boolean not null default false,  -- readable by anonymous visitors
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  constraint system_settings_key_format check (key ~ '^[a-z][a-z0-9_]{1,63}$')
);
