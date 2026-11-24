import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, Eye, FileSearch, PackageCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteReport, useMarkLostRecovered, useMyReports } from '@/hooks/useItems';
import { formatDate } from '@/utils/format';
import { PageHeader } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Tabs } from '@/components/common/Tabs';
import { ConfirmDialog } from '@/components/common/Modal';
import { EmptyState, ErrorState, Skeleton } from '@/components/common/Feedback';
import { ItemThumb } from '@/components/items/ItemThumb';

const EDITABLE = { lost: 'pending', found: 'pending_verification' };

function ReportRow({ type, item, onDelete, onRecovered }) {
  const editable = item.status === EDITABLE[type];
  const canRecover = type === 'lost' && ['pending', 'approved'].includes(item.status);
  const date = type === 'lost' ? item.date_lost : item.date_found;

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ItemThumb path={item.image_path} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/${type}/${item.id}`} className="truncate font-semibold text-slate-900 hover:text-brand-700">
              {item.item_name}
            </Link>
            <StatusBadge type={type} status={item.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono text-xs">{item.reference_no}</span> · {item.category?.name} ·{' '}
            {type === 'lost' ? 'Lost' : 'Found'} {formatDate(date)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button to={`/${type}/${item.id}`} variant="outline" size="sm" icon={Eye}>
          View
        </Button>
        {editable && (
          <Button to={`/my-reports/${type}/${item.id}/edit`} variant="outline" size="sm" icon={Pencil}>
            Edit
          </Button>
        )}
        {canRecover && (
          <Button variant="secondary" size="sm" icon={CheckCircle2} onClick={() => onRecovered(item)}>
            I got it back
          </Button>
        )}
        {editable && (
          <Button variant="danger-outline" size="sm" icon={Trash2} onClick={() => onDelete(item)}>
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}

export default function MyReportsPage() {
  const [params, setParams] = useSearchParams();
  const type = params.get('tab') === 'found' ? 'found' : 'lost';
  const lost = useMyReports('lost');
  const found = useMyReports('found');
  const current = type === 'lost' ? lost : found;
  const del = useDeleteReport(type);
  const recover = useMarkLostRecovered();
  const [toDelete, setToDelete] = useState(null);
  const [toRecover, setToRecover] = useState(null);

  return (
    <div>
      <PageHeader
        title="My reports"
        description="Everything you have reported. Pending reports can be edited or deleted until they are reviewed."
        actions={
          <>
            <Button to="/report/lost" variant="outline" icon={Plus}>
              Lost item
            </Button>
            <Button to="/report/found" icon={Plus}>
              Found item
            </Button>
          </>
        }
      />

      <Tabs
        label="Report type"
        value={type}
        onChange={(v) => setParams(v === 'lost' ? {} : { tab: v }, { replace: true })}
        options={[
          { value: 'lost', label: 'Lost items', count: lost.data?.length },
          { value: 'found', label: 'Found items', count: found.data?.length },
        ]}
        className="mb-5"
      />

      {current.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : current.isError ? (
        <ErrorState error={current.error} onRetry={current.refetch} />
      ) : current.data.length === 0 ? (
        <EmptyState
          icon={type === 'lost' ? FileSearch : PackageCheck}
          title={type === 'lost' ? 'No lost-item reports yet' : 'No found-item reports yet'}
          description={
            type === 'lost'
              ? 'If you lose something on campus, report it here so others can help.'
              : 'Found something? Report it so the owner can claim it.'
          }
          action={
            <Button to={`/report/${type}`} icon={Plus}>
              Report {type === 'lost' ? 'a lost' : 'a found'} item
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {current.data.map((item) => (
            <ReportRow key={item.id} type={type} item={item} onDelete={setToDelete} onRecovered={setToRecover} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete this report?"
        description={toDelete && `“${toDelete.item_name}” (${toDelete.reference_no}) and its photo will be permanently deleted.`}
        confirmLabel="Delete report"
        loading={del.isPending}
        onConfirm={() => del.mutate(toDelete, { onSuccess: () => setToDelete(null) })}
      />
      <ConfirmDialog
        open={Boolean(toRecover)}
        onClose={() => setToRecover(null)}
        tone="primary"
        title="Mark as recovered?"
        description={toRecover && `“${toRecover.item_name}” will be marked as recovered and shown as returned in the listings.`}
        confirmLabel="Yes, I got it back"
        loading={recover.isPending}
        onConfirm={() => recover.mutate(toRecover.id, { onSuccess: () => setToRecover(null) })}
      />
    </div>
  );
}
