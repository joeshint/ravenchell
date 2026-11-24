import { useState } from 'react';
import { Link } from 'react-router';
import { Archive, CheckCircle2, ExternalLink, ImageOff, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { useItemPrivate, useStatusHistory } from '@/hooks/useItems';
import { useAdminMutation } from '@/hooks/useAdmin';
import { reviewFoundItem, reviewLostItem } from '@/services/admin.service';
import { USER_TYPES } from '@/lib/constants';
import { formatDate, formatDateTime, formatTime } from '@/utils/format';
import { itemImageUrl } from '@/utils/storage';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/Badge';
import { Skeleton } from '@/components/common/Feedback';
import { StatusTimeline } from '@/components/items/StatusTimeline';
import { ReasonDialog } from './ReasonDialog';
import { VerifyFoundDialog } from './VerifyFoundDialog';

/** Which actions each status allows (mirrors the transitions enforced in 0005_rpc.sql). */
const ACTIONS = {
  lost: {
    pending: ['approve', 'reject'],
    approved: ['resolve', 'archive'],
    rejected: ['approve', 'archive'],
    resolved: ['archive'],
    archived: ['approve'],
  },
  found: {
    pending_verification: ['verify', 'reject'],
    verified: ['archive'],
    rejected: ['verify', 'archive'],
    released: ['archive'],
    archived: ['verify'],
    claimed: [],
  },
};

const ACTION_META = {
  approve: { label: 'Approve & list', icon: CheckCircle2, variant: 'primary' },
  verify: { label: 'Verify & list', icon: ShieldCheck, variant: 'primary' },
  reject: { label: 'Reject', icon: XCircle, variant: 'danger-outline' },
  resolve: { label: 'Mark resolved', icon: CheckCircle2, variant: 'secondary' },
  archive: { label: 'Archive', icon: Archive, variant: 'outline' },
};

const SUCCESS = {
  approve: 'approved and listed',
  verify: 'verified and listed',
  reject: 'rejected',
  resolve: 'marked as resolved',
  archive: 'archived',
};

function Row({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm whitespace-pre-line text-slate-800">{children || '—'}</dd>
    </div>
  );
}

export function ItemReviewModal({ type, item, onClose }) {
  const priv = useItemPrivate(type, item.id, true);
  const history = useStatusHistory(type === 'lost' ? 'lost_item' : 'found_item', item.id);
  const [dialog, setDialog] = useState(null); // 'reject' | 'archive' | 'resolve' | 'approve' | 'verify'

  const mutation = useAdminMutation(
    ({ action, notes, questions, custodyLocationId }) =>
      type === 'lost'
        ? reviewLostItem(item.id, action, notes)
        : reviewFoundItem(item.id, action, { notes, questions, custodyLocationId }),
    {
      successMessage: (_r, v) => `${item.reference_no} ${SUCCESS[v.action]}.`,
      onSuccess: () => {
        setDialog(null);
        onClose();
      },
    },
  );

  const image = itemImageUrl(item.image_path);
  const isLost = type === 'lost';
  const actions = ACTIONS[type][item.status] ?? [];
  const p = priv.data;
  const restoreLabel = item.status === 'archived' ? 'Restore & list' : null;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="xl"
        title={item.item_name}
        description={`${item.reference_no} · submitted ${formatDateTime(item.created_at)}`}
        footer={
          <>
            <Button to={`/${type}/${item.id}`} variant="ghost" icon={ExternalLink} target="_blank" className="mr-auto">
              Public page
            </Button>
            {actions.length === 0 && item.status === 'claimed' && (
              <Button to="/admin/claims?status=approved" variant="outline">
                See approved claims
              </Button>
            )}
            {actions.map((a) => {
              const meta = ACTION_META[a];
              return (
                <Button key={a} variant={meta.variant} icon={a === 'approve' || a === 'verify' ? (restoreLabel ? RotateCcw : meta.icon) : meta.icon} onClick={() => setDialog(a)}>
                  {(a === 'approve' || a === 'verify') && restoreLabel ? restoreLabel : meta.label}
                </Button>
              );
            })}
          </>
        }
      >
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {image ? (
                <a href={image} target="_blank" rel="noreferrer">
                  <img src={image} alt={item.item_name} className="aspect-square w-full object-cover" />
                </a>
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-1 text-slate-400">
                  <ImageOff className="size-8" />
                  <span className="text-xs">No photo</span>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{isLost ? 'Reporter' : 'Finder'}</p>
              <p className="mt-1 font-medium text-slate-900">{item.reporter?.full_name}</p>
              <p className="text-slate-600">{item.reporter?.institutional_email}</p>
              <p className="text-slate-500">
                {USER_TYPES.find((t) => t.value === item.reporter?.user_type)?.label} · ID {item.reporter?.student_employee_id ?? '—'}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge type={type} status={item.status} />
              <span className="text-sm text-slate-500">{item.category?.name}</span>
            </div>
            <p className="text-sm whitespace-pre-line text-slate-700">{item.description}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Row label={isLost ? 'Date lost' : 'Date found'}>
                {formatDate(isLost ? item.date_lost : item.date_found)}
                {formatTime(isLost ? item.time_lost : item.time_found) && `, ${formatTime(isLost ? item.time_lost : item.time_found)}`}
              </Row>
              <Row label="Campus">{item.campus?.name}</Row>
              <Row label="Location">{[item.location?.name, item.location_details].filter(Boolean).join(' — ')}</Row>
              {!isLost && <Row label="Kept at">{item.custody?.name}</Row>}
              {!isLost && item.verification_questions?.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Verification questions</dt>
                  <dd>
                    <ol className="list-decimal pl-5 text-sm text-slate-800">
                      {item.verification_questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ol>
                  </dd>
                </div>
              )}
            </dl>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-amber-800 uppercase">Private details</p>
              {priv.isPending ? (
                <Skeleton className="h-12" />
              ) : priv.isError ? (
                <p className="text-sm text-red-600">Could not load private details.</p>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Row label="Identifying details">{p?.identifying_details}</Row>
                  {isLost ? (
                    <>
                      <Row label="Contact name">{p?.contact_name}</Row>
                      <Row label="Contact phone">{p?.contact_phone}</Row>
                      <Row label="Contact email">{p?.contact_email}</Row>
                    </>
                  ) : (
                    <>
                      <Row label="Additional information">{p?.additional_info}</Row>
                      <Row label="Custody notes">{p?.custody_notes}</Row>
                    </>
                  )}
                </dl>
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Status history</p>
              <StatusTimeline type={type} history={history.data} isPending={history.isPending} />
            </div>

            {item.status === 'claimed' && (
              <p className="text-sm text-slate-600">
                A claim for this item was approved. Record the release from the{' '}
                <Link to="/admin/claims?status=approved" className="font-medium text-brand-700 hover:underline">
                  claims page
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </Modal>

      {dialog === 'verify' && (
        <VerifyFoundDialog
          key={item.id}
          open
          item={item}
          privateDetails={p}
          loading={mutation.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(v) => mutation.mutate({ action: 'verify', ...v })}
        />
      )}
      {dialog && dialog !== 'verify' && (
        <ReasonDialog
          key={`${item.id}-${dialog}`}
          open
          onClose={() => setDialog(null)}
          loading={mutation.isPending}
          required={dialog === 'reject'}
          tone={dialog === 'reject' ? 'danger' : 'primary'}
          title={
            {
              approve: item.status === 'archived' ? 'Restore and list this report?' : 'Approve and list this report?',
              reject: 'Reject this report?',
              resolve: 'Mark this report as resolved?',
              archive: 'Archive this report?',
            }[dialog]
          }
          description={
            {
              approve: 'It will appear in the public lost-items list and the reporter will be notified.',
              reject: 'The reporter will be notified with your reason. The report will not be listed.',
              resolve: 'Use this when the owner has recovered the item outside the claim process.',
              archive: 'The report will be hidden from public listings. Open claims on it will be closed.',
            }[dialog]
          }
          label={dialog === 'reject' ? 'Reason (sent to the reporter)' : 'Note (optional, saved in the status history)'}
          confirmLabel={ACTION_META[dialog].label}
          onConfirm={(notes) => mutation.mutate({ action: dialog, notes })}
        />
      )}
    </>
  );
}
