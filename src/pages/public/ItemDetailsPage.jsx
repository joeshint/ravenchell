import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Clock,
  EyeOff,
  Hash,
  ImageOff,
  Landmark,
  MapPin,
  PackageCheck,
  Pencil,
  ShieldCheck,
  Tag,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteReport, useItem, useItemPrivate, useStatusHistory } from '@/hooks/useItems';
import { useMyActiveClaimForItem } from '@/hooks/useClaims';
import { CLAIM_STATUS } from '@/lib/constants';
import { formatDate, formatDateTime, formatTime } from '@/utils/format';
import { itemImageUrl } from '@/utils/storage';
import { StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { Alert, ErrorState, Skeleton } from '@/components/common/Feedback';
import { ConfirmDialog } from '@/components/common/Modal';
import { StatusTimeline } from '@/components/items/StatusTimeline';
import { NotFoundPage } from './ErrorPages';

const EDITABLE = { lost: 'pending', found: 'pending_verification' };

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className="text-sm text-slate-800">{children}</dd>
      </div>
    </div>
  );
}

function ClaimPanel({ item }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const isOwner = item.reporter_id === user?.id;
  const active = useMyActiveClaimForItem(isAuthenticated && !isOwner ? item.id : null);

  let content;
  if (isOwner) {
    content = <p className="text-sm text-slate-600">You reported this item as found. Thank you for turning it in!</p>;
  } else if (item.status === 'claimed') {
    content = <p className="text-sm text-slate-600">An ownership claim for this item has been approved and is awaiting release.</p>;
  } else if (item.status === 'released') {
    content = <p className="text-sm text-slate-600">This item has been returned to its owner.</p>;
  } else if (item.status !== 'verified') {
    content = <p className="text-sm text-slate-600">This item is not open for claims.</p>;
  } else if (!isAuthenticated) {
    content = (
      <>
        <p className="text-sm text-slate-600">Sign in with your CvSU account to claim this item.</p>
        <Button to="/login" state={{ from: location }} className="w-full">
          Sign in to claim
        </Button>
      </>
    );
  } else if (active.isPending) {
    content = <Skeleton className="h-10 w-full" />;
  } else if (active.data) {
    content = (
      <>
        <p className="text-sm text-slate-600">
          You already have a claim for this item ({CLAIM_STATUS[active.data.status]?.label.toLowerCase()}).
        </p>
        <Button to={`/my-claims/${active.data.id}`} variant="outline" className="w-full">
          View my claim
        </Button>
      </>
    );
  } else {
    content = (
      <>
        <p className="text-sm text-slate-600">
          Is this yours? Submit a claim and answer a few questions only the owner would know.
        </p>
        <Button to={`/found/${item.id}/claim`} className="w-full" icon={ClipboardCheck}>
          Claim this item
        </Button>
      </>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <ShieldCheck className="size-4 text-brand-600" /> Claiming this item
        </p>
        {content}
      </CardBody>
    </Card>
  );
}

function OwnerPanel({ type, item }) {
  const navigate = useNavigate();
  const priv = useItemPrivate(type, item.id, true);
  const history = useStatusHistory(type === 'lost' ? 'lost_item' : 'found_item', item.id);
  const del = useDeleteReport(type);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = item.status === EDITABLE[type];
  const p = priv.data;

  const privateRows =
    type === 'lost'
      ? [
          ['Identifying details', p?.identifying_details],
          ['Contact name', p?.contact_name],
          ['Contact phone', p?.contact_phone],
          ['Contact email', p?.contact_email],
        ]
      : [
          ['Identifying details', p?.identifying_details],
          ['Additional information', p?.additional_info],
          ['Custody notes', p?.custody_notes],
        ];

  return (
    <>
      <Card>
        <CardHeader
          title="Your report"
          description={editable ? 'You can edit or delete this report until it is reviewed.' : undefined}
          action={
            editable && (
              <div className="flex gap-2">
                <Button to={`/my-reports/${type}/${item.id}/edit`} variant="outline" size="sm" icon={Pencil}>
                  Edit
                </Button>
                <Button variant="danger-outline" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              </div>
            )
          }
        />
        <CardBody className="space-y-5">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <EyeOff className="size-3.5" /> Private details (only you and admins)
            </p>
            {priv.isPending ? (
              <Skeleton className="h-16" />
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                {privateRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-sm whitespace-pre-line text-slate-800">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Status history</p>
            <StatusTimeline type={type} history={history.data} isPending={history.isPending} />
          </div>
        </CardBody>
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this report?"
        description={`“${item.item_name}” (${item.reference_no}) and its photo will be permanently deleted.`}
        confirmLabel="Delete report"
        loading={del.isPending}
        onConfirm={() => del.mutate(item, { onSuccess: () => navigate('/my-reports', { replace: true }) })}
      />
    </>
  );
}

export default function ItemDetailsPage({ type }) {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { data: item, isPending, isError, error, refetch } = useItem(type, id);

  if (isPending) {
    return (
      <div className="container-page grid gap-8 py-10 lg:grid-cols-2">
        <Skeleton className="aspect-[4/3] rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="container-page py-10">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }
  if (!item) return <NotFoundPage />;

  const isOwner = item.reporter_id === user?.id;
  const image = itemImageUrl(item.image_path);
  const isLost = type === 'lost';
  const date = isLost ? item.date_lost : item.date_found;
  const time = formatTime(isLost ? item.time_lost : item.time_found);
  const notPublic = isLost ? !['approved', 'resolved'].includes(item.status) : !['verified', 'claimed', 'released'].includes(item.status);

  return (
    <div className="container-page py-8 lg:py-10">
      <Link to={`/${type}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Back to {type} items
      </Link>

      {notPublic && (
        <Alert tone="info" className="mt-4" title="This report is not publicly listed">
          Only you and administrators can see it right now (status: {item.status.replace('_', ' ')}).
        </Alert>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {image ? (
              <a href={image} target="_blank" rel="noreferrer" title="Open full-size photo">
                <img src={image} alt={item.item_name} className="max-h-[520px] w-full object-contain" />
              </a>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-slate-400">
                <ImageOff className="size-10" />
                <span className="text-sm">No photo provided</span>
              </div>
            )}
          </div>
          {isOwner && <OwnerPanel type={type} item={item} />}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge type={type} status={item.status} />
              <span className="text-sm text-slate-500">{item.category?.name}</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{item.item_name}</h1>
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">{item.description}</p>
          </div>

          <Card>
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail icon={Hash} label="Reference no.">
                  <span className="font-mono">{item.reference_no}</span>
                </Detail>
                <Detail icon={Tag} label="Category">
                  {item.category?.name ?? '—'}
                </Detail>
                <Detail icon={CalendarDays} label={isLost ? 'Date lost' : 'Date found'}>
                  {formatDate(date)}
                </Detail>
                <Detail icon={Clock} label="Approximate time">
                  {time ?? 'Not specified'}
                </Detail>
                <Detail icon={Landmark} label="Campus">
                  {item.campus?.name ?? '—'}
                </Detail>
                <Detail icon={MapPin} label={isLost ? 'Last known location' : 'Location found'}>
                  {[item.location?.name, item.location_details].filter(Boolean).join(' — ') || 'Not specified'}
                </Detail>
                {!isLost && (
                  <Detail icon={PackageCheck} label="Currently kept at">
                    {item.custody ? `${item.custody.name}${item.custody.campus ? ` — ${item.custody.campus.name}` : ''}` : 'Not specified'}
                  </Detail>
                )}
                <Detail icon={CalendarDays} label="Reported">
                  {formatDateTime(item.created_at)}
                </Detail>
              </dl>
            </CardBody>
          </Card>

          {isLost ? (
            !isOwner &&
            item.status === 'approved' && (
              <Card>
                <CardBody className="space-y-3">
                  <p className="font-semibold text-slate-900">Have you found this item?</p>
                  <p className="text-sm text-slate-600">
                    Please turn it in to the security office or the Office of Student Affairs, then report it as found so
                    the owner can claim it.
                  </p>
                  <Button
                    to={isAuthenticated ? '/report/found' : '/login'}
                    state={isAuthenticated ? undefined : { from: { pathname: '/report/found' } }}
                    variant="outline"
                    icon={PackageCheck}
                  >
                    Report as found
                  </Button>
                </CardBody>
              </Card>
            )
          ) : (
            <>
              <ClaimPanel item={item} />
              <p className="flex gap-2 text-xs text-slate-500">
                <EyeOff className="size-4 shrink-0" />
                Some details (serial numbers, contents, distinctive marks) are intentionally hidden. They are used to
                verify the real owner.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
