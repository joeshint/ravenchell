import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Power, Search, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminList, useAdminMutation } from '@/hooks/useAdmin';
import { ADMIN_PAGE_SIZE, adminUpdateProfile, listUsers, setUserActive, setUserRole } from '@/services/admin.service';
import { ROLES, USER_TYPES } from '@/lib/constants';
import { formatDate } from '@/utils/format';
import { getErrorMessage } from '@/utils/errors';
import { PageHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { FormField, Input, Select } from '@/components/common/FormControls';
import { Alert } from '@/components/common/Feedback';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { DataTable } from '@/components/admin/DataTable';

const ROLE_TONE = { user: 'slate', admin: 'blue', super_admin: 'gold' };

const editSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name').max(120),
  studentEmployeeId: z.string().trim().min(3, 'Enter the ID').max(30).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and hyphens only'),
  department: z.string().trim().min(2, 'Enter the college or department').max(150),
  userType: z.enum(['student', 'faculty', 'personnel']),
});

function EditUserDialog({ user, onClose }) {
  const [formError, setFormError] = useState(null);
  const mutation = useAdminMutation((v) => adminUpdateProfile(user.id, v), {
    successMessage: 'User details updated.',
    silentError: true,
    onSuccess: onClose,
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      fullName: user.full_name,
      studentEmployeeId: user.student_employee_id ?? '',
      department: user.department ?? '',
      userType: user.user_type,
    },
  });
  const submit = handleSubmit((v) => {
    setFormError(null);
    mutation.mutate(
      { full_name: v.fullName, student_employee_id: v.studentEmployeeId, department: v.department, user_type: v.userType },
      { onError: (err) => setFormError(getErrorMessage(err)) },
    );
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit user details"
      description={user.institutional_email}
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
        <FormField label="Full name" error={errors.fullName?.message} required className="sm:col-span-2">
          <Input {...register('fullName')} />
        </FormField>
        <FormField label="Student / Employee ID" error={errors.studentEmployeeId?.message} required>
          <Input {...register('studentEmployeeId')} />
        </FormField>
        <FormField label="User type" error={errors.userType?.message} required>
          <Select {...register('userType')}>
            {USER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="College / Department" error={errors.department?.message} required className="sm:col-span-2">
          <Input {...register('department')} />
        </FormField>
        <p className="text-xs text-slate-500 sm:col-span-2">The sign-in email can only be changed by the user through Supabase Auth.</p>
      </form>
    </Modal>
  );
}

export default function AdminUsersPage() {
  const { user: me, isSuperAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(
    () => ({
      q: params.get('q') ?? '',
      role: params.get('role') ?? '',
      userType: params.get('type') ?? '',
      active: params.get('active') ?? '',
      page: Math.max(1, Number(params.get('page')) || 1),
    }),
    [params],
  );
  const [search, setSearch] = useState(filters.q);
  const [roleChange, setRoleChange] = useState(null); // { user, role }
  const [toggle, setToggle] = useState(null);
  const [editing, setEditing] = useState(null);
  const list = useAdminList('users', listUsers, filters);

  const update = (patch) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  const roleMutation = useAdminMutation(({ user, role }) => setUserRole(user.id, role), {
    successMessage: (_r, v) => `${v.user.full_name} is now ${ROLES[v.role].toLowerCase()}.`,
    onSuccess: () => setRoleChange(null),
  });
  const activeMutation = useAdminMutation((u) => setUserActive(u.id, !u.is_active), {
    successMessage: (_r, u) => `${u.full_name} was ${u.is_active ? 'deactivated' : 'activated'}.`,
    onSuccess: () => setToggle(null),
  });

  /** Mirrors admin_set_user_active's rules so the UI only offers allowed actions. */
  const canToggle = (u) => u.id !== me?.id && u.role !== 'super_admin' && (u.role === 'user' || isSuperAdmin);

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
          <div className="min-w-0">
            <p className="max-w-56 truncate font-medium text-slate-900">
              {u.full_name}
              {u.id === me?.id && <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>}
            </p>
            <p className="max-w-56 truncate text-xs text-slate-500">{u.institutional_email}</p>
          </div>
        </div>
      ),
    },
    { key: 'sid', header: 'ID', render: (u) => <span className="font-mono text-xs">{u.student_employee_id ?? '—'}</span> },
    {
      key: 'type',
      header: 'Type · Department',
      render: (u) => (
        <div className="max-w-56">
          <p>{USER_TYPES.find((t) => t.value === u.user_type)?.label}</p>
          <p className="truncate text-xs text-slate-500">{u.department}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) =>
        isSuperAdmin && u.id !== me?.id ? (
          <Select
            aria-label={`Role for ${u.full_name}`}
            className="h-8 w-44 text-xs"
            value={u.role}
            onChange={(e) => setRoleChange({ user: u, role: e.target.value })}
          >
            {Object.entries(ROLES).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        ) : (
          <Badge tone={ROLE_TONE[u.role]}>{ROLES[u.role]}</Badge>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (u.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>),
    },
    { key: 'joined', header: 'Joined', render: (u) => formatDate(u.created_at) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right whitespace-nowrap',
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${u.full_name}`} title="Edit details" onClick={() => setEditing(u)}>
            <Pencil className="size-4" />
          </Button>
          {canToggle(u) && (
            <Button
              size="sm"
              variant={u.is_active ? 'danger-outline' : 'outline'}
              icon={Power}
              onClick={() => setToggle(u)}
            >
              {u.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description={
          isSuperAdmin
            ? 'Manage accounts and assign administrator roles.'
            : 'Manage accounts. Only a super administrator can change roles.'
        }
      />
      <div className="flex flex-wrap gap-2">
        <form
          role="search"
          className="relative min-w-60 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <Input
            id="user-search"
            type="search"
            className="pl-9"
            placeholder="Name, email or ID — press Enter"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value) update({ q: '' });
            }}
          />
        </form>
        <Select aria-label="Role" className="w-48" value={filters.role} onChange={(e) => update({ role: e.target.value })}>
          <option value="">All roles</option>
          {Object.entries(ROLES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select aria-label="User type" className="w-44" value={filters.userType} onChange={(e) => update({ type: e.target.value })}>
          <option value="">All user types</option>
          {USER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Account status" className="w-40" value={filters.active} onChange={(e) => update({ active: e.target.value })}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </Select>
      </div>

      <DataTable
        caption="Users"
        columns={columns}
        rows={list.data?.rows ?? []}
        isPending={list.isPending}
        isError={list.isError}
        error={list.error}
        onRetry={list.refetch}
        dimmed={list.isPlaceholderData}
        empty={{ icon: Users, title: 'No users found', description: 'Try a different search or filter.' }}
      />
      {list.data && (
        <Pagination page={filters.page} pageSize={ADMIN_PAGE_SIZE} total={list.data.total} onPageChange={(p) => update({ page: p > 1 ? p : '' })} />
      )}

      <ConfirmDialog
        open={Boolean(roleChange)}
        onClose={() => setRoleChange(null)}
        tone={roleChange?.role === 'user' ? 'danger' : 'primary'}
        title="Change role?"
        confirmLabel="Change role"
        loading={roleMutation.isPending}
        onConfirm={() => roleMutation.mutate(roleChange)}
        description={
          roleChange &&
          `${roleChange.user.full_name} will change from ${ROLES[roleChange.user.role]} to ${ROLES[roleChange.role]}.`
        }
      >
        {roleChange?.role !== 'user' && (
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" />
            {roleChange?.role === 'super_admin'
              ? 'Super administrators can manage other administrators and every system setting.'
              : 'Administrators can moderate reports, decide claims and see private details.'}
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(toggle)}
        onClose={() => setToggle(null)}
        tone={toggle?.is_active ? 'danger' : 'primary'}
        title={toggle?.is_active ? 'Deactivate this account?' : 'Activate this account?'}
        confirmLabel={toggle?.is_active ? 'Deactivate' : 'Activate'}
        loading={activeMutation.isPending}
        onConfirm={() => activeMutation.mutate(toggle)}
        description={
          toggle &&
          (toggle.is_active
            ? `${toggle.full_name} can no longer submit reports or claims and will be signed out the next time the app checks their account. Their existing records are kept.`
            : `${toggle.full_name} will be able to use the system again.`)
        }
      />

      {editing && <EditUserDialog key={editing.id} user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
