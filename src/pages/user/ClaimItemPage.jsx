import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useItem, useMyReports } from '@/hooks/useItems';
import { useMyActiveClaimForItem, useSubmitClaim } from '@/hooks/useClaims';
import { claimSchema } from '@/schemas/claim.schema';
import { formatDate } from '@/utils/format';
import { getErrorMessage } from '@/utils/errors';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/common/Card';
import { Checkbox, FormField, Input, Select, Textarea } from '@/components/common/FormControls';
import { Alert, ErrorState, FullPageSpinner } from '@/components/common/Feedback';
import { Button } from '@/components/common/Button';
import { FileDropzone } from '@/components/forms/FileDropzone';
import { ItemThumb } from '@/components/items/ItemThumb';

function ClaimForm({ item, onSubmitted }) {
  const { profile } = useAuth();
  const submit = useSubmitClaim();
  const myLost = useMyReports('lost');
  const [evidence, setEvidence] = useState(null);
  const [formError, setFormError] = useState(null);
  const questions = item.verification_questions ?? [];
  const linkable = (myLost.data ?? []).filter((r) => ['pending', 'approved'].includes(r.status));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      ownershipDescription: '',
      answers: questions.map(() => ''),
      lostItemId: '',
      contactPhone: profile?.phone ?? '',
      confirm: false,
    },
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      const claim = await submit.mutateAsync({ foundItemId: item.id, values, questions, evidenceFile: evidence });
      toast.success(`Claim ${claim.reference_no} submitted.`);
      onSubmitted(claim);
    } catch (err) {
      setFormError(getErrorMessage(err));
      window.scrollTo(0, 0);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}

      <Card>
        <CardHeader title="Proof of ownership" description="Your answers are visible only to you and administrators." />
        <CardBody className="space-y-5">
          <FormField
            label="Why is this item yours?"
            error={errors.ownershipDescription?.message}
            hint="Describe the item in detail and where/when you lost it. Mention anything not shown in the listing."
            required
          >
            <Textarea rows={5} {...register('ownershipDescription')} />
          </FormField>

          {questions.map((q, i) => (
            <FormField key={q} label={q} error={errors.answers?.[i]?.message} required>
              <Input {...register(`answers.${i}`)} />
            </FormField>
          ))}

          {linkable.length > 0 && (
            <FormField label="Link to your lost-item report (optional)" hint="If you reported this item as lost, select the report.">
              <Select placeholder="No linked report" {...register('lostItemId')}>
                {linkable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.item_name} — {r.reference_no} (lost {formatDate(r.date_lost)})
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label="Contact phone" error={errors.contactPhone?.message} hint="In case the administrator needs to reach you.">
            <Input type="tel" autoComplete="tel" placeholder="09171234567" {...register('contactPhone')} />
          </FormField>

          <FileDropzone
            bucket="claim-evidence"
            label="Supporting evidence (optional)"
            hint="A photo of you with the item, a receipt, or a screenshot. Stored privately."
            file={evidence}
            onFileChange={setEvidence}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <FormField error={errors.confirm?.message}>
            <Checkbox
              label="I confirm that this item belongs to me and that the information I provided is true. False claims may lead to disciplinary action."
              {...register('confirm')}
            />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={isSubmitting} icon={ClipboardCheck}>
              Submit claim
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

export default function ClaimItemPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const item = useItem('found', id);
  const active = useMyActiveClaimForItem(id);

  if (item.isPending || active.isPending) return <FullPageSpinner />;
  if (item.isError) return <ErrorState error={item.error} onRetry={item.refetch} />;
  if (!item.data) return <ErrorState title="Item not found" error="This item does not exist or is no longer listed." />;

  const data = item.data;
  let blocker = null;
  if (data.reporter_id === user?.id) blocker = 'You cannot claim an item that you reported as found.';
  else if (data.status !== 'verified') blocker = 'This item is no longer available for claiming.';

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Claim this item" description="An administrator will review your claim and contact you." />

      <Card className="mb-6">
        <CardBody className="flex items-center gap-4">
          <ItemThumb path={data.image_path} className="size-20" />
          <div className="min-w-0">
            <Link to={`/found/${data.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
              {data.item_name}
            </Link>
            <p className="text-sm text-slate-500">
              <span className="font-mono text-xs">{data.reference_no}</span> · {data.category?.name} · Found{' '}
              {formatDate(data.date_found)} at {data.campus?.name}
            </p>
          </div>
        </CardBody>
      </Card>

      {blocker ? (
        <Alert tone="warning">{blocker}</Alert>
      ) : active.data ? (
        <Alert tone="info" title="You already have a claim for this item">
          <Link to={`/my-claims/${active.data.id}`} className="font-medium underline">
            View claim {active.data.reference_no}
          </Link>
        </Alert>
      ) : (
        <>
          <Alert tone="info" className="mb-6" title="How claims are verified">
            <span className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              The finder recorded private details about this item. An administrator compares them with your answers.
              Matching answers do not guarantee approval; you will be asked to show a valid CvSU ID at pickup.
            </span>
          </Alert>
          <ClaimForm item={data} onSubmitted={(claim) => navigate(`/my-claims/${claim.id}`, { replace: true })} />
        </>
      )}
    </div>
  );
}
