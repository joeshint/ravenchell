export const APP_NAME = 'CvSU Lost and Found';

export const DEFAULT_EMAIL_DOMAINS = ['cvsu.edu.ph'];

export const USER_TYPES = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'personnel', label: 'University Personnel' },
];

export const ROLES = {
  user: 'User',
  admin: 'Administrator',
  super_admin: 'Super Administrator',
};

export const ADMIN_ROLES = ['admin', 'super_admin'];

/** Suggestions only — the department field accepts free text. */
export const DEPARTMENT_SUGGESTIONS = [
  'College of Agriculture, Food, Environment and Natural Resources (CAFENR)',
  'College of Arts and Sciences (CAS)',
  'College of Criminal Justice (CCJ)',
  'College of Economics, Management and Development Studies (CEMDS)',
  'College of Education (CED)',
  'College of Engineering and Information Technology (CEIT)',
  'College of Medicine (COM)',
  'College of Nursing (CON)',
  'College of Sports, Physical Education and Recreation (CSPEAR)',
  'College of Veterinary Medicine and Biomedical Sciences (CVMBS)',
  'Graduate School and Open Learning College',
  'Office of Student Affairs and Services (OSAS)',
  'Administration',
];

/** Status presentation: label + badge tone (see components/common/Badge). */
export const LOST_STATUS = {
  pending: { label: 'Pending review', tone: 'amber' },
  approved: { label: 'Still missing', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'slate' },
  resolved: { label: 'Recovered', tone: 'green' },
  archived: { label: 'Archived', tone: 'slate' },
};

export const FOUND_STATUS = {
  pending_verification: { label: 'Pending verification', tone: 'amber' },
  verified: { label: 'Available', tone: 'green' },
  claimed: { label: 'Claim approved', tone: 'blue' },
  released: { label: 'Returned', tone: 'brand' },
  rejected: { label: 'Rejected', tone: 'slate' },
  archived: { label: 'Archived', tone: 'slate' },
};

export const CLAIM_STATUS = {
  pending: { label: 'Pending', tone: 'amber' },
  under_review: { label: 'Under review', tone: 'blue' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  released: { label: 'Released', tone: 'brand' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
};

export const STATUS_MAPS = {
  lost: LOST_STATUS,
  found: FOUND_STATUS,
  claim: CLAIM_STATUS,
};

/** Must match the bucket limits in supabase/migrations/0006_storage.sql. */
export const UPLOAD_LIMITS = {
  'item-images': { maxBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
  'claim-evidence': {
    maxBytes: 10 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  avatars: { maxBytes: 2 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
};

export const PAGE_SIZE = 12;
