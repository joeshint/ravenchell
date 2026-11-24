-- =============================================================================
-- 0001_extensions_enums.sql
-- CvSU Lost and Found System — extensions, enum types and sequences
-- =============================================================================

-- Trigram search for fast `ilike '%term%'` on item names.
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------
create type public.user_type as enum ('student', 'faculty', 'personnel');

create type public.app_role as enum ('user', 'admin', 'super_admin');

create type public.lost_status as enum (
  'pending',    -- awaiting admin approval
  'approved',   -- publicly listed
  'rejected',   -- rejected by admin (reason in status history)
  'resolved',   -- owner got the item back
  'archived'    -- hidden by admin
);

create type public.found_status as enum (
  'pending_verification', -- awaiting admin verification
  'verified',             -- publicly listed and claimable
  'claimed',              -- a claim was approved, awaiting release
  'released',             -- handed over to the owner
  'rejected',             -- rejected by admin
  'archived'              -- hidden by admin
);

create type public.claim_status as enum (
  'pending',
  'under_review',
  'approved',
  'rejected',
  'released',
  'cancelled'   -- withdrawn by the claimant (addition to the original spec)
);

create type public.notification_type as enum (
  'report_submitted',
  'report_approved',
  'report_rejected',
  'claim_submitted',
  'claim_update',
  'claim_approved',
  'claim_rejected',
  'item_released',
  'match_suggestion',
  'system'
);

-- -----------------------------------------------------------------------------
-- Sequences for human-readable reference numbers (LST-2026-000001, ...)
-- -----------------------------------------------------------------------------
create sequence public.lost_ref_seq;
create sequence public.found_ref_seq;
create sequence public.claim_ref_seq;
