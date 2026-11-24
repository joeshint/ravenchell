import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useItem, useItemPrivate, useSaveReport } from '@/hooks/useItems';
import { itemFormDefaults } from '@/schemas/item.schema';
import { getErrorMessage } from '@/utils/errors';
import { PageHeader } from '@/components/common/Card';
import { Alert, ErrorState, FullPageSpinner } from '@/components/common/Feedback';
import { Button } from '@/components/common/Button';
import { ItemReportForm } from '@/components/forms/ItemReportForm';

const EDITABLE = { lost: 'pending', found: 'pending_verification' };

export default function EditReportPage() {
  const { type, id } = useParams();
  const validType = type === 'lost' || type === 'found';
  const { user } = useAuth();
  const navigate = useNavigate();
  const item = useItem(validType ? type : 'lost', validType ? id : null);
  const isOwner = item.data?.reporter_id === user?.id;
  const priv = useItemPrivate(type, id, validType && isOwner);
  const save = useSaveReport(validType ? type : 'lost');
  const [formError, setFormError] = useState(null);

  if (!validType) return <Navigate to="/my-reports" replace />;
  if (item.isPending || (isOwner && priv.isPending)) return <FullPageSpinner />;
  if (item.isError) return <ErrorState error={item.error} onRetry={item.refetch} />;
  if (priv.isError) return <ErrorState error={priv.error} onRetry={priv.refetch} />;
  if (!item.data || !isOwner) {
    return <ErrorState title="Report not found" error="This report does not exist or you cannot edit it." />;
  }

  if (item.data.status !== EDITABLE[type]) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title="Edit report" />
        <Alert tone="info" title="This report can no longer be edited">
          Reports can only be changed while they are waiting for review. If something needs correcting, please contact
          the Office of Student Affairs and mention reference no. {item.data.reference_no}.
        </Alert>
        <Button to={`/${type}/${id}`} variant="outline">
          View report
        </Button>
      </div>
    );
  }

  const onSubmit = async (values, image) => {
    setFormError(null);
    try {
      await save.mutateAsync({ id, values, image, existingPath: item.data.image_path });
      toast.success('Report updated.');
      navigate(`/${type}/${id}`);
    } catch (err) {
      setFormError(getErrorMessage(err));
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${type} report`}
        description={`Reference no. ${item.data.reference_no} · You can edit this report until it is reviewed.`}
      />
      <ItemReportForm
        type={type}
        defaultValues={itemFormDefaults(type, { item: item.data, privateDetails: priv.data })}
        existingImagePath={item.data.image_path}
        onSubmit={onSubmit}
        submitLabel="Save changes"
        onCancel={() => navigate(-1)}
        formError={formError}
      />
    </div>
  );
}
