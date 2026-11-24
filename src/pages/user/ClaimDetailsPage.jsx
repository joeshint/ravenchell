import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, PackageCheck, XCircle } from 'lucide-react';
import { useClaim, useCancelClaim } from '@/hooks/useClaims';
import { useStatusHistory } from '@/hooks/useItems';
import { usePublicSettings } from '@/hooks/useLookups';
import { getSignedUrl } from '@/services/storage.service';
import { formatDate, formatDateTime } from '@/utils/format';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Alert, ErrorState, FullPageSpinner } from '@/components/common/Feedback';
import { ConfirmDialog } from '@/components/common/Modal';
import { StatusTimeline } from '@/components/items/StatusTimeline';
import { ItemThumb } from '@/components/items/ItemThumb';

function EvidenceLink({ path }) {
  const { data: url, isPending, isError } = useQuery({
    queryKey: ['signed-url', 'claim-evidence', path],
    queryFn: () => getSignedUrl('claim-evidence', path, 300),
    staleTime: 4 * 60_000,
  });
  if (isPending) return <span className="text-sm text-slate-400">Preparing link…</span>;
  if (isError || !url) return <span className="text-sm text-red-600">Could not load the file.</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
      <FileText className="size-4" /> View uploaded evidence
    </a>
  );
}

function StatusMessage({ claim, office }) {
  const custody = claim.found_item?.custody;
  const place = custody ? `${custody.name}${custody.campus ? ` — ${custody.campus.name}` : ''}` : office;
  switch (claim.status) {
    case 'pending':
      return <Alert tone="info" title="Waiting for review">An administrator will review your claim soon.</Alert>;
    case 'under_review':
      return <Alert tone="info" title="Under review">An administrator is verifying your answers. You may be contacted for more information.</Alert>;
    case 'approved':
      return (
        <Alert tone="success" title="Claim approved — ready for pickup">
          Bring a valid CvSU ID to <strong>{place}</strong> and mention reference no. {claim.reference_no}.
        </Alert>
      );
    case 'rejected':
      return (
        <Alert tone="error" title="Claim not approved">
          {claim.review_notes || 'Your claim could not be verified.'}
        </Alert>
      );
    case 'released':
      return (
        <Alert tone="success" title="Item released">
          Released to {claim.released_to_name} on {formatDateTime(claim.released_at)}.
        </Alert>
      );
    case 'cancelled':
      return <Alert tone="warning" title="Claim withdrawn">You withdrew this claim.</Alert>;
    default:
      return null;
  }
}

export default function ClaimDetailsPage() {
  const { id } = useParams();
  const { data: claim, isPending, isError, error, refetch } = useClaim(id);
  const history = useStatusHistory('claim', id);
  const { data: settings } = usePublicSettings();
  const cancel = useCancelClaim();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isPending) return <FullPageSpinner />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!claim) return <ErrorState title="Claim not found" error="This claim does not exist or belongs to another user." />;

  const item = claim.found_item;
  const canCancel = ['pending', 'under_review'].includes(claim.status);
  const answers = Array.isArray(claim.verification_answers) ? claim.verification_answers : [];

  return (
    <div className="space-y-6">
      <Link to="/my-claims" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> My claims
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Claim {claim.reference_no}</h1>
            <StatusBadge type="claim" status={claim.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Submitted {formatDateTime(claim.created_at)}</p>
        </div>
        {canCancel && (
          <Button variant="danger-outline" icon={XCircle} onClick={() => setConfirmCancel(true)}>
            Withdraw claim
          </Button>
        )}
      </div>

      <StatusMessage claim={claim} office={settings?.claim_office} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Item" />
            <CardBody>
              {item ? (
                <Link to={`/found/${item.id}`} className="flex items-center gap-4 rounded-lg hover:bg-slate-50">
                  <ItemThumb path={item.image_path} className="size-20" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{item.item_name}</p>
                    <p className="text-sm text-slate-500">
                      <span className="font-mono text-xs">{item.reference_no}</span> · {item.category?.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      Found {formatDate(item.date_found)} · {item.campus?.name}
                    </p>
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-slate-500">This item is no longer publicly listed.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Your submission" description="Visible only to you and administrators." />
            <CardBody className="space-y-5">
              <div>
                <p className="text-xs font-medium text-slate-500">Ownership description</p>
                <p className="mt-1 text-sm whitespace-pre-line text-slate-800">{claim.ownership_description}</p>
              </div>
              {answers.length > 0 && (
                <dl className="space-y-3">
                  {answers.map((a) => (
                    <div key={a.question}>
                      <dt className="text-xs font-medium text-slate-500">{a.question}</dt>
                      <dd className="text-sm text-slate-800">{a.answer}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">Contact phone</p>
                  <p className="text-sm text-slate-800">{claim.contact_phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Linked lost report</p>
                  <p className="text-sm text-slate-800">
                    {claim.lost_item ? (
                      <Link to={`/lost/${claim.lost_item.id}`} className="text-brand-700 hover:underline">
                        {claim.lost_item.reference_no}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Evidence</p>
                {claim.evidence_path ? <EvidenceLink path={claim.evidence_path} /> : <p className="text-sm text-slate-800">None uploaded</p>}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status timeline" />
            <CardBody>
              <StatusTimeline type="claim" history={history.data} isPending={history.isPending} />
            </CardBody>
          </Card>
          {claim.status === 'released' && (
            <Card>
              <CardBody className="flex gap-3">
                <PackageCheck className="size-5 shrink-0 text-brand-600" />
                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-900">Release record</p>
                  <p>Received by: {claim.released_to_name}</p>
                  <p>Date: {formatDateTime(claim.released_at)}</p>
                  {claim.release_notes && <p className="mt-1">{claim.release_notes}</p>}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Withdraw this claim?"
        description="Your claim will be closed. You can submit a new claim later while the item is still available."
        confirmLabel="Withdraw claim"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(claim.id, { onSuccess: () => setConfirmCancel(false) })}
      />
    </div>
  );
}
