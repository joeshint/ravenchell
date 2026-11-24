import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminMutation } from '@/hooks/useAdmin';
import { getAllSettings, updateSetting } from '@/services/admin.service';
import { formatDateTime } from '@/utils/format';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Checkbox, FormField, Input, Textarea } from '@/components/common/FormControls';
import { Alert, ErrorState, Skeleton } from '@/components/common/Feedback';
import { ConfirmDialog } from '@/components/common/Modal';

/**
 * Known settings get a typed editor; anything else falls back to raw JSON.
 * Each editor converts between the form value and the stored jsonb value.
 */
const EDITORS = {
  system_name: { label: 'System name', kind: 'text' },
  claim_office: { label: 'Default claiming office', kind: 'text' },
  claim_instructions: { label: 'Claim pickup instructions', kind: 'textarea' },
  support_email: { label: 'Support email', kind: 'text', validate: (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Enter a valid email or leave empty' : null) },
  require_lost_approval: { label: 'Lost-item reports need admin approval before listing', kind: 'boolean' },
  max_upload_mb: {
    label: 'Max image size shown to users (MB)',
    kind: 'number',
    validate: (v) => (!Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 50 ? 'Enter a whole number from 1 to 50' : null),
  },
  allowed_email_domains: {
    label: 'Allowed registration email domains',
    kind: 'list',
    validate: (v) =>
      v
        .split(/[\s,]+/)
        .filter(Boolean)
        .some((d) => !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(d))
        ? 'Enter domains like cvsu.edu.ph, separated by commas'
        : null,
  },
};

function toForm(kind, value) {
  if (kind === 'boolean') return Boolean(value);
  if (kind === 'list') return (Array.isArray(value) ? value : []).join(', ');
  if (kind === 'json') return JSON.stringify(value, null, 2);
  return value === null || value === undefined ? '' : String(value);
}

function fromForm(kind, v) {
  if (kind === 'boolean') return Boolean(v);
  if (kind === 'number') return Number(v);
  if (kind === 'list') return v.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (kind === 'json') return JSON.parse(v);
  return v.trim();
}

function SettingRow({ setting, canEdit }) {
  const editor = EDITORS[setting.key] ?? { label: setting.key, kind: 'json' };
  const initial = toForm(editor.kind, setting.value);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const mutation = useAdminMutation((v) => updateSetting(setting.key, v), { successMessage: `“${editor.label}” saved.` });

  const save = () => {
    let parsed;
    try {
      parsed = fromForm(editor.kind, value);
    } catch {
      setError('Invalid JSON');
      return;
    }
    const problem = editor.validate?.(value);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    // Opening registration to every domain is risky — confirm first.
    if (setting.key === 'allowed_email_domains' && parsed.length === 0 && !confirm) {
      setConfirm(true);
      return;
    }
    setConfirm(false);
    mutation.mutate(parsed);
  };

  const id = `setting-${setting.key}`;
  const control = {
    text: <Input id={id} value={value} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} />,
    number: <Input id={id} type="number" value={value} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} className="w-32" />,
    list: <Input id={id} value={value} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} placeholder="cvsu.edu.ph" />,
    textarea: <Textarea id={id} rows={3} value={value} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} />,
    json: <Textarea id={id} rows={4} className="font-mono text-xs" value={value} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} />,
    boolean: <Checkbox id={id} label="Enabled" checked={value} disabled={!canEdit} onChange={(e) => setValue(e.target.checked)} />,
  }[editor.kind];

  return (
    <li className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_1.2fr_auto] md:items-start">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-900">
          {editor.label}
        </label>
        {setting.description && <p className="mt-0.5 text-xs text-slate-500">{setting.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <code className="font-mono">{setting.key}</code>
          {setting.is_public ? <Badge tone="blue">Public</Badge> : <Badge>Admins only</Badge>}
          <span>
            Updated {formatDateTime(setting.updated_at)}
            {setting.editor?.full_name && ` by ${setting.editor.full_name}`}
          </span>
        </div>
      </div>
      <FormField error={error}>{control}</FormField>
      {canEdit && (
        <Button icon={Save} size="sm" disabled={!dirty} loading={mutation.isPending} onClick={save}>
          Save
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Allow any email domain?"
        description="Anyone with any email address will be able to register. Only do this for testing."
        confirmLabel="Allow all domains"
        onConfirm={save}
        loading={mutation.isPending}
      />
    </li>
  );
}

export default function AdminSettingsPage() {
  const { isSuperAdmin } = useAuth();
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ['settings', 'all'], queryFn: getAllSettings });

  return (
    <div className="space-y-5">
      <PageHeader title="System settings" description="Configuration used across the application. Every change is recorded in the activity log." />
      {!isSuperAdmin && (
        <Alert tone="info" title="View only">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" /> Only a super administrator can change system settings.
          </span>
        </Alert>
      )}
      <Card>
        <CardHeader title="Settings" />
        {isPending ? (
          <CardBody className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </CardBody>
        ) : isError ? (
          <ErrorState className="m-5" error={error} onRetry={refetch} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((s) => (
              <SettingRow key={`${s.key}-${s.updated_at}`} setting={s} canEdit={isSuperAdmin} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
