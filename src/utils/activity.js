/** Human-readable labels for activity_logs.action values written by the database. */
const LABELS = {
  'user.registered': 'Registered an account',
  'user.role_changed': 'Changed a user role',
  'user.activated': 'Activated a user',
  'user.deactivated': 'Deactivated a user',
  'lost_item.created': 'Reported a lost item',
  'lost_item.approve': 'Approved a lost-item report',
  'lost_item.reject': 'Rejected a lost-item report',
  'lost_item.resolve': 'Marked a lost item as resolved',
  'lost_item.archive': 'Archived a lost-item report',
  'lost_item.self_resolved': 'Marked their lost item as recovered',
  'found_item.created': 'Reported a found item',
  'found_item.verify': 'Verified a found-item report',
  'found_item.reject': 'Rejected a found-item report',
  'found_item.archive': 'Archived a found-item report',
  'claim.created': 'Submitted a claim',
  'claim.review': 'Started reviewing a claim',
  'claim.approve': 'Approved a claim',
  'claim.reject': 'Rejected a claim',
  'claim.release': 'Released an item to its owner',
  'claim.cancelled': 'Withdrew a claim',
  'settings.insert': 'Added a system setting',
  'settings.update': 'Changed a system setting',
  'settings.delete': 'Deleted a system setting',
};

export const ACTION_GROUPS = [
  { value: 'lost_item.', label: 'Lost-item reports' },
  { value: 'found_item.', label: 'Found-item reports' },
  { value: 'claim.', label: 'Claims' },
  { value: 'user.', label: 'Users' },
  { value: 'settings.', label: 'Settings' },
];

export function actionLabel(action) {
  return LABELS[action] ?? action;
}

/** The most useful single detail to show next to an action. */
export function actionSubject(log) {
  const d = log.details ?? {};
  return d.reference_no ?? d.email ?? d.key ?? d.found_item_reference_no ?? null;
}

/** Admin page for the entity a log entry refers to, if any. */
export function entityLink(log) {
  if (!log.entity_id) return null;
  switch (log.entity_type) {
    case 'claim':
      return `/admin/claims/${log.entity_id}`;
    case 'lost_item':
      return `/admin/lost-items?ref=${log.details?.reference_no ?? ''}`;
    case 'found_item':
      return `/admin/found-items?ref=${log.details?.reference_no ?? ''}`;
    default:
      return null;
  }
}
