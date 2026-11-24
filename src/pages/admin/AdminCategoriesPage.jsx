import { createElement, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCategories } from '@/hooks/useLookups';
import { useAdminMutation } from '@/hooks/useAdmin';
import { countUsage, deleteRow, saveRow } from '@/services/admin.service';
import { getErrorMessage } from '@/utils/errors';
import { CATEGORY_ICONS, categoryIcon } from '@/lib/categoryIcons';
import { PageHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Checkbox, FormField, Input, Select, Textarea } from '@/components/common/FormControls';
import { Alert } from '@/components/common/Feedback';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable } from '@/components/admin/DataTable';

const ICON_CHOICES = Object.keys(CATEGORY_ICONS);

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(60, 'Name is too long'),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and single hyphens only'),
  description: z.string().trim().max(300, 'Too long'),
  icon: z.string(),
  sortOrder: z.coerce.number().int('Whole number').min(0).max(999),
  isActive: z.boolean(),
});

function CategoryIcon({ name, className = 'size-4' }) {
  // Icons come from a fixed module-level map, so no component is created here.
  return createElement(categoryIcon(name), { className, 'aria-hidden': true });
}

function CategoryDialog({ category, nextOrder, onClose }) {
  const [formError, setFormError] = useState(null);
  const mutation = useAdminMutation((values) => saveRow('item_categories', values, category?.id), {
    successMessage: category ? 'Category updated.' : 'Category created.',
    silentError: true,
    onSuccess: onClose,
  });
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors, dirtyFields },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      icon: category?.icon ?? 'Package',
      sortOrder: category?.sort_order ?? nextOrder,
      isActive: category?.is_active ?? true,
    },
  });
  const icon = useWatch({ control, name: 'icon' });

  const submit = handleSubmit((v) => {
    setFormError(null);
    mutation.mutate(
      { name: v.name, slug: v.slug, description: v.description || null, icon: v.icon, sort_order: v.sortOrder, is_active: v.isActive },
      { onError: (err) => setFormError(getErrorMessage(err)) },
    );
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
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
        <FormField label="Name" error={errors.name?.message} required>
          <Input
            {...register('name', {
              onChange: (e) => {
                if (!category && !dirtyFields.slug) setValue('slug', slugify(e.target.value));
              },
            })}
          />
        </FormField>
        <FormField label="Slug" error={errors.slug?.message} required hint="Used in links; must be unique.">
          <Input {...register('slug', { onBlur: () => setValue('slug', slugify(getValues('slug'))) })} />
        </FormField>
        <FormField label="Description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea rows={2} {...register('description')} />
        </FormField>
        <FormField label="Icon" error={errors.icon?.message}>
          <div className="flex items-center gap-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <CategoryIcon name={icon} className="size-5" />
            </span>
            <Select {...register('icon')}>
              {ICON_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        </FormField>
        <FormField label="Sort order" error={errors.sortOrder?.message} hint="Lower numbers appear first.">
          <Input type="number" min={0} max={999} {...register('sortOrder')} />
        </FormField>
        <FormField className="sm:col-span-2" hint="Inactive categories are hidden from report forms but kept on existing reports.">
          <Checkbox label="Active" {...register('isActive')} />
        </FormField>
      </form>
    </Modal>
  );
}

export default function AdminCategoriesPage() {
  const { data = [], isPending, isError, error, refetch } = useCategories();
  const [editing, setEditing] = useState(null); // category | 'new'
  const [toDelete, setToDelete] = useState(null);
  const [usage, setUsage] = useState(null);

  const del = useAdminMutation((c) => deleteRow('item_categories', c.id), {
    successMessage: 'Category deleted.',
    onSuccess: () => setToDelete(null),
  });
  const deactivate = useAdminMutation((c) => saveRow('item_categories', { is_active: false }, c.id), {
    successMessage: 'Category deactivated.',
    onSuccess: () => setToDelete(null),
  });

  const askDelete = async (c) => {
    try {
      setUsage(await countUsage('category_id', c.id));
      setToDelete(c);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Category',
      render: (c) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <CategoryIcon name={c.icon} />
          </span>
          <div>
            <p className="font-medium text-slate-900">{c.name}</p>
            <p className="font-mono text-xs text-slate-500">{c.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'description', header: 'Description', render: (c) => <span className="line-clamp-2 max-w-md text-slate-600">{c.description ?? '—'}</span> },
    { key: 'order', header: 'Order', render: (c) => c.sort_order },
    { key: 'status', header: 'Status', render: (c) => (c.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right whitespace-nowrap',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing(c)}>
            Edit
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.name}`} title="Delete" onClick={() => askDelete(c)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Item categories"
        description="Categories shown in report forms and listing filters."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            New category
          </Button>
        }
      />
      <DataTable
        caption="Item categories"
        columns={columns}
        rows={data}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={refetch}
        empty={{ icon: Tags, title: 'No categories yet', description: 'Create the first category to enable reporting.' }}
      />

      {editing && (
        <CategoryDialog
          key={editing === 'new' ? 'new' : editing.id}
          category={editing === 'new' ? null : editing}
          nextOrder={(data.at(-1)?.sort_order ?? 0) + 1}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title={usage ? 'Category is in use' : 'Delete this category?'}
        tone={usage ? 'primary' : 'danger'}
        confirmLabel={usage ? 'Deactivate instead' : 'Delete category'}
        loading={del.isPending || deactivate.isPending}
        onConfirm={() => (usage ? deactivate.mutate(toDelete) : del.mutate(toDelete))}
        description={
          toDelete &&
          (usage
            ? `“${toDelete.name}” is used by ${usage} report(s), so it cannot be deleted. You can deactivate it to hide it from new reports.`
            : `“${toDelete.name}” will be permanently deleted.`)
        }
      />
    </div>
  );
}
