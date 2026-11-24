import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCampuses, useLocations } from '@/hooks/useLookups';
import { useAdminMutation } from '@/hooks/useAdmin';
import { countUsage, deleteRow, saveRow } from '@/services/admin.service';
import { getErrorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';
import { Card, CardHeader, PageHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Checkbox, FormField, Input, Textarea } from '@/components/common/FormControls';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/common/Feedback';
import { ConfirmDialog, Modal } from '@/components/common/Modal';

const campusSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,12}$/, '2–12 capital letters or numbers'),
  address: z.string().trim().max(300),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
});

const locationSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(120),
  description: z.string().trim().max(300),
  isCustodyPoint: z.boolean(),
  isActive: z.boolean(),
});

function EntityDialog({ title, schema, defaultValues, toRow, table, id, onClose, children }) {
  const [formError, setFormError] = useState(null);
  const mutation = useAdminMutation((values) => saveRow(table, values, id), {
    successMessage: id ? 'Saved.' : 'Created.',
    silentError: true,
    onSuccess: onClose,
  });
  const form = useForm({ resolver: zodResolver(schema), defaultValues });
  const submit = form.handleSubmit((v) => {
    setFormError(null);
    mutation.mutate(toRow(v), { onError: (err) => setFormError(getErrorMessage(err)) });
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {formError && <Alert tone="error" className="sm:col-span-2">{formError}</Alert>}
        {children(form)}
      </form>
    </Modal>
  );
}

function CampusDialog({ campus, nextOrder, onClose }) {
  return (
    <EntityDialog
      title={campus ? 'Edit campus' : 'New campus'}
      schema={campusSchema}
      table="campuses"
      id={campus?.id}
      onClose={onClose}
      defaultValues={{
        name: campus?.name ?? '',
        code: campus?.code ?? '',
        address: campus?.address ?? '',
        sortOrder: campus?.sort_order ?? nextOrder,
        isActive: campus?.is_active ?? true,
      }}
      toRow={(v) => ({ name: v.name, code: v.code, address: v.address || null, sort_order: v.sortOrder, is_active: v.isActive })}
    >
      {({ register, formState: { errors } }) => (
        <>
          <FormField label="Campus name" error={errors.name?.message} required className="sm:col-span-2">
            <Input placeholder="e.g. Silang Campus" {...register('name')} />
          </FormField>
          <FormField label="Short code" error={errors.code?.message} required hint="Shown on item cards, e.g. MAIN">
            <Input className="uppercase" {...register('code')} />
          </FormField>
          <FormField label="Sort order" error={errors.sortOrder?.message}>
            <Input type="number" min={0} {...register('sortOrder')} />
          </FormField>
          <FormField label="Address" error={errors.address?.message} className="sm:col-span-2">
            <Textarea rows={2} {...register('address')} />
          </FormField>
          <FormField className="sm:col-span-2" hint="Inactive campuses are hidden from report forms.">
            <Checkbox label="Active" {...register('isActive')} />
          </FormField>
        </>
      )}
    </EntityDialog>
  );
}

function LocationDialog({ location, campus, onClose }) {
  return (
    <EntityDialog
      title={location ? 'Edit location' : `New location — ${campus.name}`}
      schema={locationSchema}
      table="campus_locations"
      id={location?.id}
      onClose={onClose}
      defaultValues={{
        name: location?.name ?? '',
        description: location?.description ?? '',
        isCustodyPoint: location?.is_custody_point ?? false,
        isActive: location?.is_active ?? true,
      }}
      toRow={(v) => ({
        ...(location ? {} : { campus_id: campus.id }),
        name: v.name,
        description: v.description || null,
        is_custody_point: v.isCustodyPoint,
        is_active: v.isActive,
      })}
    >
      {({ register, formState: { errors } }) => (
        <>
          <FormField label="Location name" error={errors.name?.message} required className="sm:col-span-2">
            <Input placeholder="e.g. CEIT Building" {...register('name')} />
          </FormField>
          <FormField label="Description" error={errors.description?.message} className="sm:col-span-2">
            <Textarea rows={2} {...register('description')} />
          </FormField>
          <FormField className="sm:col-span-2" hint="Custody points are offices where found items are kept and released.">
            <Checkbox label="Custody point (found items are kept here)" {...register('isCustodyPoint')} />
          </FormField>
          <FormField className="sm:col-span-2">
            <Checkbox label="Active" {...register('isActive')} />
          </FormField>
        </>
      )}
    </EntityDialog>
  );
}

export default function AdminLocationsPage() {
  const campuses = useCampuses();
  const [selectedId, setSelectedId] = useState(null);
  const campusList = campuses.data ?? [];
  const selected = campusList.find((c) => c.id === selectedId) ?? campusList[0] ?? null;
  const locations = useLocations(selected?.id, { enabled: Boolean(selected) });

  const [campusDialog, setCampusDialog] = useState(null); // campus | 'new'
  const [locationDialog, setLocationDialog] = useState(null); // location | 'new'
  const [toDelete, setToDelete] = useState(null); // { kind, row, usage }

  const del = useAdminMutation(({ kind, row }) => deleteRow(kind === 'campus' ? 'campuses' : 'campus_locations', row.id), {
    successMessage: 'Deleted.',
    onSuccess: (_r, v) => {
      if (v.kind === 'campus' && v.row.id === selectedId) setSelectedId(null);
      setToDelete(null);
    },
  });
  const deactivate = useAdminMutation(
    ({ kind, row }) => saveRow(kind === 'campus' ? 'campuses' : 'campus_locations', { is_active: false }, row.id),
    { successMessage: 'Deactivated.', onSuccess: () => setToDelete(null) },
  );

  const askDelete = async (kind, row) => {
    try {
      const usage = await countUsage(kind === 'campus' ? 'campus_id' : 'location_id', row.id);
      setToDelete({ kind, row, usage });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Campus locations" description="Campuses and the places within them used in reports and custody." />

      {campuses.isError ? (
        <ErrorState error={campuses.error} onRetry={campuses.refetch} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="self-start">
            <CardHeader
              title="Campuses"
              action={
                <Button size="sm" icon={Plus} onClick={() => setCampusDialog('new')}>
                  Add
                </Button>
              }
            />
            {campuses.isPending ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : campusList.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No campuses yet.</p>
            ) : (
              <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
                {campusList.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-current={selected?.id === c.id ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left text-sm',
                        selected?.id === c.id ? 'bg-brand-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <Building2 className={cn('size-4 shrink-0', selected?.id === c.id ? 'text-brand-600' : 'text-slate-400')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{c.name}</span>
                        <span className="font-mono text-xs text-slate-500">{c.code}</span>
                      </span>
                      {!c.is_active && <Badge>Inactive</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {selected && (
            <Card>
              <CardHeader
                title={selected.name}
                description={selected.address ?? undefined}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" icon={Pencil} onClick={() => setCampusDialog(selected)}>
                      Edit campus
                    </Button>
                    <Button size="sm" variant="danger-outline" icon={Trash2} onClick={() => askDelete('campus', selected)}>
                      Delete
                    </Button>
                    <Button size="sm" icon={Plus} onClick={() => setLocationDialog('new')}>
                      Add location
                    </Button>
                  </div>
                }
              />
              {locations.isPending ? (
                <div className="space-y-2 p-5">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : locations.isError ? (
                <ErrorState className="m-5" error={locations.error} onRetry={locations.refetch} />
              ) : locations.data.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={MapPin} title="No locations yet" description="Add buildings, offices and landmarks for this campus." />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {locations.data.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <MapPin className="size-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{l.name}</p>
                        {l.description && <p className="text-xs text-slate-500">{l.description}</p>}
                      </div>
                      {l.is_custody_point && <Badge tone="brand">Custody point</Badge>}
                      {!l.is_active && <Badge>Inactive</Badge>}
                      <div className="flex gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${l.name}`} title="Edit" onClick={() => setLocationDialog(l)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${l.name}`} title="Delete" onClick={() => askDelete('location', l)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}

      {campusDialog && (
        <CampusDialog
          key={campusDialog === 'new' ? 'new' : campusDialog.id}
          campus={campusDialog === 'new' ? null : campusDialog}
          nextOrder={(campusList.at(-1)?.sort_order ?? 0) + 1}
          onClose={() => setCampusDialog(null)}
        />
      )}
      {locationDialog && selected && (
        <LocationDialog
          key={locationDialog === 'new' ? 'new' : locationDialog.id}
          location={locationDialog === 'new' ? null : locationDialog}
          campus={selected}
          onClose={() => setLocationDialog(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        tone={toDelete?.usage ? 'primary' : 'danger'}
        title={toDelete?.usage ? 'This record is in use' : `Delete this ${toDelete?.kind}?`}
        confirmLabel={toDelete?.usage ? 'Deactivate instead' : 'Delete'}
        loading={del.isPending || deactivate.isPending}
        onConfirm={() => (toDelete.usage ? deactivate.mutate(toDelete) : del.mutate(toDelete))}
        description={
          toDelete &&
          (toDelete.usage
            ? `“${toDelete.row.name}” is used by ${toDelete.usage} report(s), so it cannot be deleted. Deactivate it to hide it from new reports.`
            : toDelete.kind === 'campus'
              ? `“${toDelete.row.name}” and all of its locations will be permanently deleted.`
              : `“${toDelete.row.name}” will be permanently deleted.`)
        }
      />
    </div>
  );
}
