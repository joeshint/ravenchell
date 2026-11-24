import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, FileText, PackageCheck, Search, ShieldAlert, XCircle } from 'lucide-react';
import { useAdminMutation } from '@/hooks/useAdmin';
import { useItemPrivate, useStatusHistory } from '@/hooks/useItems';
import { getAdminClaim, getCompetingClaims, releaseClaim, updateClaim } from '@/services/admin.service';
import { getSignedUrl } from '@/services/storage.service';
import { USER_TYPES } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/utils/format';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Alert, ErrorState, FullPageSpinner, Skeleton } from '@/components/common/Feedback';
import { FormField, Input, Textarea } from '@/components/common/FormControls';
import { Modal } from '@/components/common/Modal';
import { StatusTimeline } from '@/components/items/StatusTimeline';
import { ItemThumb } from '@/components/items/ItemThumb';
import { ReasonDialog } from '@/components/admin/ReasonDialog';

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm whitespace-pre-line text-slate-800">{children || '—'}</dd>
    </div>
  );
}

function Evidence({ path }) {
  const { data: url, isPending, isError } = useQuery({
    queryKey: ['signed-url', 'claim-evidence', path],
    queryFn: () => getSignedUrl('claim-evidence', path, 300),
    staleTime: 4 * 60_000,
  });
  if (isPending) return <Skeleton className="h-5 w-40" />;
  if (isError || !url) return <p className="text-sm text-red-600">Could not create a link to the evidence file.</p>;
  const isPdf = path.endsWith('.pdf');
  return (
    <div className="space-y-2">
      {!isPdf && (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="Claim evidence" className="max-h-64 rounded-lg border border-slate-200 object-contain" />
        </a>
      )}
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
        <FileText className="size-4" /> Open evidence ({isPdf ? 'PDF' : 'image'}) — link expires in 5 minutes
      </a>
    </div>
  );
}

function ReleaseDialog({ claim, onClose, mutation }) {
  const [name, setName] = useState(claim.claimant?.full_name ?? '');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const invalid = name.trim().length < 2;
  return (
    <Modal
      open
      onClose={mutation.isPending ? undefined : onClose}
      dismissible={!mutation.isPending}
      title="Record item release"
      description={`${claim.found_item?.item_name} · ${claim.reference_no}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            icon={PackageCheck}
            loading={mutation.isPending}
            onClick={() => {
              setTouched(true);
              if (!invalid) mutation.mutate({ kind: 'release', name: name.trim(), notes });
            }}
          >
            Confirm release
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="warning" title="Check identity before handing over">
          Verify the person's CvSU ID matches the claimant ({claim.claimant?.full_name}, ID {claim.claimant?.student_employee_id ?? '—'}).
        </Alert>
        <FormField label="Received by (full name)" required error={touched && invalid ? 'Enter the name of the person who received the item' : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} data-autofocus />
        </FormField>
        <FormField label="Release notes (optional)" hint="e.g. ID presented, who released it, condition of the item.">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <p className="text-xs text-slate-500">The release date and your account are recorded automatically.</p>
      </div>
    </Modal>
  );
}

export default function AdminClaimReviewPage() {
  const { id } = useParams();
  const { data: claim, isPending, isError, error, refetch } = useQuery({ queryKey: ['admin', 'claim', id], queryFn: () => getAdminClaim(id) });
  const foundId = claim?.found_item?.id;
  const foundPrivate = useItemPrivate('found', foundId, Boolean(foundId));
  const lostPrivate = useItemPrivate('lost', claim?.lost_item_id, Boolean(claim?.lost_item_id));
  const history = useStatusHistory('claim', id);
  const competing = useQuery({
    queryKey: ['admin', 'competing', foundId, id],
    queryFn: () => getCompetingClaims(foundId, id),
    enabled: Boolean(foundId),
  });
  const [dialog, setDialog] = useState(null);

  const mutation = useAdminMutation(
    (v) => (v.kind === 'release' ? releaseClaim(id, v.name, v.notes) : updateClaim(id, v.action, v.notes)),
    {
      successMessage: (_r, v) =>
        v.kind === 'release'
          ? 'Release recorded. The claimant and finder were notified.'
          : { review: 'Claim moved to under review.', approve: 'Claim approved. The claimant was notified.', reject: 'Claim rejected. The claimant was notified.' }[v.action],
      onSuccess: () => setDialog(null),
    },
  );

  if (isPending) return <FullPageSpinner />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!claim) return <ErrorState title="Claim not found" error="This claim does not exist." />;

  const item = claim.found_item;
  const answers = Array.isArray(claim.verification_answers) ? claim.verification_answers : [];
  const s = claim.status;
  const openCompeting = (competing.data ?? []).filter((c) => ['pending', 'under_review', 'approved'].includes(c.status));

  return (
    <div className="space-y-6">
      <Link to="/admin/claims" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Claim requests
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Claim {claim.reference_no}</h1>
            <StatusBadge type="claim" status={s} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Submitted {formatDateTime(claim.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {s === 'pending' && (
            <Button variant="outline" icon={Search} loading={mutation.isPending && mutation.variables?.action === 'review'} onClick={() => mutation.mutate({ action: 'review' })}>
              Start review
            </Button>
          )}
          {['pending', 'under_review'].includes(s) && (
            <>
              <Button variant="danger-outline" icon={XCircle} onClick={() => setDialog('reject')}>
                Reject
              </Button>
              <Button icon={CheckCircle2} onClick={() => setDialog('approve')}>
                Approve
              </Button>
            </>
          )}
          {s === 'approved' && (
            <>
              <Button variant="danger-outline" icon={XCircle} onClick={() => setDialog('reject')}>
                Revoke approval
              </Button>
              <Button icon={PackageCheck} onClick={() => setDialog('release')}>
                Record release
              </Button>
            </>
          )}
        </div>
      </div>

      {openCompeting.length > 0 && ['pending', 'under_review'].includes(s) && (
        <Alert tone="warning" title={`${openCompeting.length} other open claim(s) on this item`}>
          Approving this claim will automatically reject the others and notify those claimants.
        </Alert>
      )}
      {s === 'approved' && (
        <Alert tone="success" title="Approved — waiting for pickup">
          Record the release when the claimant collects the item with a valid CvSU ID.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Ownership verification"
              description="Compare the claimant's answers with the finder's private details. Matching answers alone are not proof."
            />
            <CardBody className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Claimant says</p>
                <Field label="Ownership description">{claim.ownership_description}</Field>
                {answers.map((a) => (
                  <Field key={a.question} label={a.question}>
                    {a.answer}
                  </Field>
                ))}
                {answers.length === 0 && <p className="text-sm text-slate-500">No verification questions were set for this item.</p>}
              </div>
              <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-800 uppercase">
                  <ShieldAlert className="size-3.5" /> Finder recorded (private)
                </p>
                {foundPrivate.isPending ? (
                  <Skeleton className="h-16" />
                ) : (
                  <>
                    <Field label="Identifying details">{foundPrivate.data?.identifying_details}</Field>
                    <Field label="Additional information">{foundPrivate.data?.additional_info}</Field>
                  </>
                )}
                <Field label="Public description">{item?.description}</Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Supporting information" />
            <CardBody className="space-y-5">
              <div>
                <p className="mb-1 text-xs text-slate-500">Evidence</p>
                {claim.evidence_path ? <Evidence path={claim.evidence_path} /> : <p className="text-sm text-slate-800">None uploaded</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contact phone">{claim.contact_phone}</Field>
                <Field label="Linked lost report">
                  {claim.lost_item ? (
                    <span>
                      {claim.lost_item.item_name} ({claim.lost_item.reference_no}) — lost {formatDate(claim.lost_item.date_lost)}
                    </span>
                  ) : null}
                </Field>
              </div>
              {claim.lost_item && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">From the claimant's lost report</p>
                  <p className="mt-1 text-sm text-slate-800">{claim.lost_item.description}</p>
                  {lostPrivate.data?.identifying_details && (
                    <p className="mt-2 text-sm text-slate-800">
                      <span className="text-xs text-slate-500">Identifying details: </span>
                      {lostPrivate.data.identifying_details}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">Reported before the claim — useful to check consistency.</p>
                </div>
              )}
            </CardBody>
          </Card>

          {(claim.review_notes || claim.reviewed_at) && (
            <Card>
              <CardHeader title="Decision" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Reviewed by">{claim.reviewer?.full_name}</Field>
                <Field label="Reviewed at">{claim.reviewed_at && formatDateTime(claim.reviewed_at)}</Field>
                <div className="sm:col-span-2">
                  <Field label="Notes">{claim.review_notes}</Field>
                </div>
              </CardBody>
            </Card>
          )}

          {s === 'released' && (
            <Card>
              <CardHeader title="Release record" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Received by">{claim.released_to_name}</Field>
                <Field label="Released at">{formatDateTime(claim.released_at)}</Field>
                <Field label="Released by (staff)">{claim.releaser?.full_name}</Field>
                <Field label="Notes">{claim.release_notes}</Field>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Claimant" />
            <CardBody className="grid gap-3">
              <Field label="Name">{claim.claimant?.full_name}</Field>
              <Field label="Email">{claim.claimant?.institutional_email}</Field>
              <Field label="Student / Employee ID">{claim.claimant?.student_employee_id}</Field>
              <Field label="Type · Department">
                {[USER_TYPES.find((t) => t.value === claim.claimant?.user_type)?.label, claim.claimant?.department].filter(Boolean).join(' · ')}
              </Field>
              {!claim.claimant?.is_active && <Alert tone="error">This account is deactivated.</Alert>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Item" />
            <CardBody className="space-y-3">
              {item ? (
                <>
                  <div className="flex items-center gap-3">
                    <ItemThumb path={item.image_path} className="size-16" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{item.item_name}</p>
                      <p className="font-mono text-xs text-slate-500">{item.reference_no}</p>
                      <StatusBadge type="found" status={item.status} className="mt-1" />
                    </div>
                  </div>
                  <dl className="grid gap-3">
                    <Field label="Found">
                      {formatDate(item.date_found)} · {item.location?.name ?? '—'}, {item.campus?.name}
                    </Field>
                    <Field label="Kept at">{item.custody?.name}</Field>
                    <Field label="Finder">
                      {item.reporter?.full_name} ({item.reporter?.institutional_email})
                    </Field>
                  </dl>
                  <Button to={`/admin/found-items?ref=${item.reference_no}`} variant="outline" size="sm">
                    Open in found items
                  </Button>
                </>
              ) : (
                <p className="text-sm text-slate-500">The item record is no longer available.</p>
              )}
            </CardBody>
          </Card>

          {competing.data?.length > 0 && (
            <Card>
              <CardHeader title="Other claims on this item" />
              <ul className="divide-y divide-slate-100">
                {competing.data.map((c) => (
                  <li key={c.id}>
                    <Link to={`/admin/claims/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <span>
                        <span className="font-mono text-xs">{c.reference_no}</span> · {c.claimant?.full_name}
                      </span>
                      <StatusBadge type="claim" status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Status timeline" />
            <CardBody>
              <StatusTimeline type="claim" history={history.data} isPending={history.isPending} />
            </CardBody>
          </Card>
        </div>
      </div>

      {dialog === 'approve' && (
        <ReasonDialog
          key="approve"
          open
          onClose={() => setDialog(null)}
          loading={mutation.isPending}
          title="Approve this claim?"
          description="The item will be reserved for this claimant, who will be told to pick it up with a valid CvSU ID."
          label="Verification notes (optional)"
          placeholder="e.g. Described the wallpaper and IMEI correctly."
          confirmLabel="Approve claim"
          onConfirm={(notes) => mutation.mutate({ action: 'approve', notes })}
        >
          {openCompeting.length > 0 && (
            <Alert tone="warning">{openCompeting.length} other open claim(s) will be rejected automatically.</Alert>
          )}
        </ReasonDialog>
      )}
      {dialog === 'reject' && (
        <ReasonDialog
          key="reject"
          open
          onClose={() => setDialog(null)}
          loading={mutation.isPending}
          required
          tone="danger"
          title={s === 'approved' ? 'Revoke this approval?' : 'Reject this claim?'}
          description={
            s === 'approved'
              ? 'The item becomes claimable again and the claimant is notified with your reason.'
              : 'The claimant is notified with your reason.'
          }
          label="Reason (sent to the claimant)"
          confirmLabel={s === 'approved' ? 'Revoke approval' : 'Reject claim'}
          onConfirm={(notes) => mutation.mutate({ action: 'reject', notes })}
        />
      )}
      {dialog === 'release' && <ReleaseDialog claim={claim} mutation={mutation} onClose={() => setDialog(null)} />}
    </div>
  );
}
