import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useSaveReport } from '@/hooks/useItems';
import { itemFormDefaults } from '@/schemas/item.schema';
import { getErrorMessage } from '@/utils/errors';
import { PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { ItemReportForm } from '@/components/forms/ItemReportForm';

const COPY = {
  lost: {
    title: 'Report a lost item',
    description: 'Tell us what you lost. An administrator reviews the report before it is listed.',
    success: 'Your lost-item report was submitted.',
    next: 'An administrator will review it shortly. You will be notified once it is listed publicly.',
  },
  found: {
    title: 'Report a found item',
    description: 'Thank you for helping! Report the item and turn it in to a campus custody office.',
    success: 'Your found-item report was submitted.',
    next: 'An administrator will verify it before it is listed. You will be notified when the owner claims it.',
  },
};

export default function ReportItemPage({ type }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const save = useSaveReport(type);
  const [created, setCreated] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const copy = COPY[type];

  const onSubmit = async (values, image) => {
    setFormError(null);
    try {
      const row = await save.mutateAsync({ values, image });
      toast.success(copy.success);
      setCreated(row);
      window.scrollTo(0, 0);
    } catch (err) {
      setFormError(getErrorMessage(err));
      window.scrollTo(0, 0);
    }
  };

  if (created) {
    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-brand-50">
          <CheckCircle2 className="size-7 text-brand-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Report submitted</h1>
        <p className="mt-2 text-sm text-slate-600">{copy.next}</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <span className="text-sm text-slate-500">Reference no.</span>
          <span className="font-mono text-base font-semibold text-slate-900">{created.reference_no}</span>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(created.reference_no).then(() => toast.success('Copied'))}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Copy reference number"
          >
            <Copy className="size-4" />
          </button>
        </div>
        {type === 'found' && (
          <p className="mt-4 text-sm text-slate-600">
            If you haven't yet, please turn the item in to the office you selected.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button to={`/${type}/${created.id}`}>View report</Button>
          <Button to="/my-reports" variant="outline">
            My reports
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setCreated(null);
              setFormKey((k) => k + 1);
            }}
          >
            Report another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={copy.title} description={copy.description} />
      <ItemReportForm
        key={`${type}-${formKey}`}
        type={type}
        defaultValues={itemFormDefaults(type, { profile })}
        onSubmit={onSubmit}
        submitLabel="Submit report"
        onCancel={() => navigate(-1)}
        formError={formError}
      />
    </div>
  );
}
