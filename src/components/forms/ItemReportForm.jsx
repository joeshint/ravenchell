import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EyeOff, Save } from 'lucide-react';
import { itemSchemas } from '@/schemas/item.schema';
import { useCampuses, useCategories, useLocations } from '@/hooks/useLookups';
import { manilaToday } from '@/utils/format';
import { itemImageUrl } from '@/utils/storage';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { FormField, Input, Select, Textarea } from '@/components/common/FormControls';
import { Button } from '@/components/common/Button';
import { Alert, ErrorState, Skeleton } from '@/components/common/Feedback';
import { FileDropzone } from './FileDropzone';

/**
 * Lost / found report form (create and edit). Purely UI: the parent receives
 * (values, image) in onSubmit, where image = { file, keepExisting }.
 *
 * The form mounts only after the dropdown options exist; otherwise a native
 * <select> cannot show its default value (visible when editing a report).
 */
export function ItemReportForm(props) {
  const initialCampus = props.defaultValues?.campusId;
  const categories = useCategories({ activeOnly: true });
  const campuses = useCampuses({ activeOnly: true });
  const locations = useLocations(initialCampus, { activeOnly: true, enabled: Boolean(initialCampus) });
  const error = categories.error ?? campuses.error ?? locations.error;

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          categories.refetch();
          campuses.refetch();
          if (initialCampus) locations.refetch();
        }}
      />
    );
  }
  if (categories.isPending || campuses.isPending || (initialCampus && locations.isPending)) {
    return (
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    );
  }
  return <ItemReportFormInner {...props} />;
}

function ItemReportFormInner({ type, defaultValues, existingImagePath, onSubmit, submitLabel, onCancel, formError }) {
  const isLost = type === 'lost';
  const [file, setFile] = useState(null);
  const [keepExisting, setKeepExisting] = useState(Boolean(existingImagePath));

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(itemSchemas[type]), defaultValues });

  const campusId = useWatch({ control, name: 'campusId' });
  const { data: categories = [] } = useCategories({ activeOnly: true });
  const { data: campuses = [] } = useCampuses({ activeOnly: true });
  const { data: locations = [] } = useLocations(campusId, { activeOnly: true, enabled: Boolean(campusId) });
  const custodyPoints = locations.filter((l) => l.is_custody_point);

  const campusField = register('campusId', {
    onChange: () => {
      setValue('locationId', '');
      if (!isLost) setValue('custodyLocationId', '');
    },
  });

  const submit = (values) => onSubmit(values, { file, keepExisting: !file && keepExisting });

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}

      <Card>
        <CardHeader title="Item information" description={isLost ? 'What did you lose?' : 'What did you find?'} />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <FormField label="Item name" error={errors.itemName?.message} required className="sm:col-span-2">
            <Input placeholder={isLost ? 'e.g. Black Samsung phone' : 'e.g. Black smartphone'} {...register('itemName')} />
          </FormField>
          <FormField label="Category" error={errors.categoryId?.message} required>
            <Select placeholder="Select a category" {...register('categoryId')}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="hidden sm:block" />
          <FormField
            label="Description"
            error={errors.description?.message}
            required
            className="sm:col-span-2"
            hint={
              isLost
                ? 'Color, brand, size, and anything that helps others recognise it.'
                : 'Keep it general (color, type, brand). Put serial numbers, contents or names in the private section below.'
            }
          >
            <Textarea rows={4} {...register('description')} />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Where and when" description={isLost ? 'Where was it last seen?' : 'Where did you find it?'} />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <FormField label={isLost ? 'Date lost' : 'Date found'} error={errors.date?.message} required>
            <Input type="date" max={manilaToday()} {...register('date')} />
          </FormField>
          <FormField label={isLost ? 'Approximate time lost' : 'Approximate time found'} error={errors.time?.message}>
            <Input type="time" {...register('time')} />
          </FormField>
          <FormField label="Campus" error={errors.campusId?.message} required>
            <Select placeholder="Select a campus" {...campusField}>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={isLost ? 'Last known location' : 'Location found'} error={errors.locationId?.message}>
            <Select placeholder={campusId ? 'Select a location' : 'Select a campus first'} disabled={!campusId} {...register('locationId')}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Location details"
            error={errors.locationDetails?.message}
            hint="Building, room, or landmark — e.g. “CEIT Bldg, Room 204, near the window”"
            className="sm:col-span-2"
          >
            <Input {...register('locationDetails')} />
          </FormField>
          {!isLost && (
            <FormField
              label="Where is the item now?"
              error={errors.custodyLocationId?.message}
              required
              hint="Turn the item in to one of these offices, then select it here."
              className="sm:col-span-2"
            >
              <Select placeholder={campusId ? 'Select a custody office' : 'Select a campus first'} disabled={!campusId} {...register('custodyLocationId')}>
                {custodyPoints.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Photo"
          description={isLost ? 'Optional — a photo helps finders recognise your item.' : 'Recommended — a photo helps the owner recognise the item.'}
        />
        <CardBody className="space-y-3">
          {!isLost && (
            <Alert tone="warning">
              Don't show identifying details in the photo (names on IDs, card numbers, lock-screen pictures). The owner
              will be asked about those to prove ownership.
            </Alert>
          )}
          <FileDropzone
            bucket="item-images"
            file={file}
            onFileChange={setFile}
            existingUrl={keepExisting ? itemImageUrl(existingImagePath) : null}
            onRemoveExisting={() => setKeepExisting(false)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <EyeOff className="size-4 text-slate-400" /> Private details
            </span>
          }
          description="Only you and administrators can see this section."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Identifying details"
            error={errors.identifyingDetails?.message}
            className="sm:col-span-2"
            hint={
              isLost
                ? 'Serial number, contents, stickers, scratches — used to verify that a found item is yours.'
                : 'Serial number, contents, names, distinctive marks — used to verify the real owner.'
            }
          >
            <Textarea rows={3} {...register('identifyingDetails')} />
          </FormField>

          {isLost ? (
            <>
              <FormField label="Contact name" error={errors.contactName?.message}>
                <Input autoComplete="name" {...register('contactName')} />
              </FormField>
              <FormField label="Contact phone" error={errors.contactPhone?.message}>
                <Input type="tel" autoComplete="tel" placeholder="09171234567" {...register('contactPhone')} />
              </FormField>
              <FormField label="Contact email" error={errors.contactEmail?.message} className="sm:col-span-2">
                <Input type="email" autoComplete="email" {...register('contactEmail')} />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Additional information" error={errors.additionalInfo?.message} className="sm:col-span-2">
                <Textarea rows={3} {...register('additionalInfo')} />
              </FormField>
              <FormField
                label="Custody notes"
                error={errors.custodyNotes?.message}
                hint="e.g. “Handed to the guard on duty, Mr. Santos, at 3 PM.”"
                className="sm:col-span-2"
              >
                <Input {...register('custodyNotes')} />
              </FormField>
            </>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" loading={isSubmitting} icon={Save}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
