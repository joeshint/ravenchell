import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { resetPasswordSchema } from '@/schemas/auth.schema';
import { updatePassword } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/utils/errors';
import { Button } from '@/components/common/Button';
import { FormField, PasswordInput } from '@/components/common/FormControls';
import { Alert, FullPageSpinner } from '@/components/common/Feedback';

/**
 * Reached from the password-reset email. Supabase turns the link into a
 * temporary session (PASSWORD_RECOVERY event), which allows updateUser().
 */
export default function ResetPasswordPage() {
  const { session, loading, clearRecovery } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirmPassword: '' } });

  const onSubmit = async ({ password }) => {
    setFormError(null);
    try {
      await updatePassword(password);
      clearRecovery();
      toast.success('Your password has been updated.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  if (loading) return <FullPageSpinner label="Verifying reset link…" />;

  if (!session) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-amber-50">
          <LinkIcon className="size-7 text-amber-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Reset link is invalid or expired</h1>
        <p className="mt-2 text-sm text-slate-600">Request a new link to reset your password.</p>
        <Button to="/forgot-password" className="mt-8 w-full">
          Request a new link
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Set a new password</h1>
      <p className="mt-1 text-sm text-slate-500">Choose a strong password you don't use anywhere else.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormField label="New password" error={errors.password?.message} hint="8+ characters with a letter and a number" required>
          <PasswordInput autoComplete="new-password" {...register('password')} />
        </FormField>
        <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
          <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting} icon={KeyRound}>
          Update password
        </Button>
      </form>
    </div>
  );
}
