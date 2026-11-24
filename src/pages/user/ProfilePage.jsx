import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, KeyRound, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { changePasswordSchema, profileSchema } from '@/schemas/profile.schema';
import { changePassword, removeAvatar, updateAvatar, updateProfile } from '@/services/profile.service';
import { queryKeys } from '@/lib/queryClient';
import { DEPARTMENT_SUGGESTIONS, ROLES, USER_TYPES } from '@/lib/constants';
import { formatDate } from '@/utils/format';
import { getErrorMessage } from '@/utils/errors';
import { validateFile } from '@/utils/storage';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/common/Card';
import { FormField, Input, PasswordInput, Select } from '@/components/common/FormControls';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Feedback';

function AvatarCard({ profile }) {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.profile(profile.id) });

  const onPick = async (file) => {
    if (!file) return;
    const problem = validateFile(file, 'avatars');
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      await updateAvatar(profile.id, file, profile.avatar_url);
      await refresh();
      toast.success('Profile photo updated.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    setBusy(true);
    try {
      await removeAvatar(profile.id, profile.avatar_url);
      await refresh();
      toast.success('Profile photo removed.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-4 text-center">
        <Avatar name={profile.full_name} src={profile.avatar_url} size="xl" />
        <div>
          <p className="font-semibold text-slate-900">{profile.full_name}</p>
          <p className="text-sm text-slate-500">{profile.institutional_email}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <Badge tone="brand">{USER_TYPES.find((t) => t.value === profile.user_type)?.label}</Badge>
            {profile.role !== 'user' && <Badge tone="gold">{ROLES[profile.role]}</Badge>}
          </div>
          <p className="mt-2 text-xs text-slate-400">Member since {formatDate(profile.created_at)}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" icon={Camera} loading={busy} onClick={() => inputRef.current?.click()}>
            {profile.avatar_url ? 'Change photo' : 'Upload photo'}
          </Button>
          {profile.avatar_url && (
            <Button variant="ghost" size="sm" icon={Trash2} disabled={busy} onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <p className="text-xs text-slate-400">JPG, PNG or WEBP, up to 2 MB.</p>
      </CardBody>
    </Card>
  );
}

function ProfileForm({ profile }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState(null);
  const idLocked = Boolean(profile.student_employee_id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.full_name,
      studentEmployeeId: profile.student_employee_id ?? '',
      department: profile.department ?? '',
      userType: profile.user_type,
      phone: profile.phone ?? '',
    },
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      const updated = await updateProfile(profile.id, idLocked ? { ...values, studentEmployeeId: undefined } : values);
      queryClient.setQueryData(queryKeys.profile(profile.id), updated);
      reset(values);
      toast.success('Profile updated.');
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader title="Personal information" />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 sm:grid-cols-2" noValidate>
          {formError && <Alert tone="error" className="sm:col-span-2">{formError}</Alert>}
          <FormField label="Full name" error={errors.fullName?.message} required className="sm:col-span-2">
            <Input autoComplete="name" {...register('fullName')} />
          </FormField>
          <FormField
            label="Student / Employee ID"
            error={errors.studentEmployeeId?.message}
            hint={idLocked ? 'Contact an administrator to change your ID.' : undefined}
            required
          >
            {idLocked ? (
              <Input value={profile.student_employee_id} disabled readOnly />
            ) : (
              <Input {...register('studentEmployeeId')} />
            )}
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
            <Input list="profile-departments" {...register('department')} />
          </FormField>
          <datalist id="profile-departments">
            {DEPARTMENT_SUGGESTIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <FormField label="Mobile number" error={errors.phone?.message} hint="Optional. Pre-fills your reports and claims.">
            <Input type="tel" autoComplete="tel" placeholder="09171234567" {...register('phone')} />
          </FormField>
          <FormField label="Institutional email" hint="Your sign-in email cannot be changed here.">
            <Input value={profile.institutional_email} disabled readOnly />
          </FormField>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" icon={Save} loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function PasswordForm({ email }) {
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async ({ currentPassword, password }) => {
    setFormError(null);
    try {
      await changePassword(email, currentPassword, password);
      reset();
      toast.success('Password changed.');
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader title="Change password" />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 sm:grid-cols-2" noValidate>
          {formError && <Alert tone="error" className="sm:col-span-2">{formError}</Alert>}
          <FormField label="Current password" error={errors.currentPassword?.message} required className="sm:col-span-2">
            <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
          </FormField>
          <FormField label="New password" error={errors.password?.message} hint="8+ characters with a letter and a number" required>
            <PasswordInput autoComplete="new-password" {...register('password')} />
          </FormField>
          <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
            <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
          </FormField>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" variant="dark" icon={KeyRound} loading={isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export default function ProfilePage() {
  const { profile } = useAuth();
  return (
    <div>
      <PageHeader title="Profile settings" description="Manage your personal information and password." />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <AvatarCard profile={profile} />
        </div>
        <div className="space-y-6">
          <ProfileForm profile={profile} />
          <PasswordForm email={profile.institutional_email} />
        </div>
      </div>
    </div>
  );
}
