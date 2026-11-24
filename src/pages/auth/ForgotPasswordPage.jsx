import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, Send } from 'lucide-react';
import { forgotPasswordSchema } from '@/schemas/auth.schema';
import { requestPasswordReset } from '@/services/auth.service';
import { getErrorMessage } from '@/utils/errors';
import { Button } from '@/components/common/Button';
import { FormField, Input } from '@/components/common/FormControls';
import { Alert } from '@/components/common/Feedback';

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState(null);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    setFormError(null);
    try {
      await requestPasswordReset(email);
      // Same message whether or not the account exists (no account enumeration).
      setSentTo(email);
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-brand-50">
          <MailCheck className="size-7 text-brand-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Check your email</h1>
        <p className="mt-2 text-sm text-slate-600">
          If an account exists for <span className="font-medium text-slate-900">{sentTo}</span>, you will receive a link
          to reset your password. The link expires after a short time.
        </p>
        <Button to="/login" variant="outline" className="mt-8 w-full">
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Forgot your password?</h1>
      <p className="mt-1 text-sm text-slate-500">Enter your CvSU email and we'll send you a reset link.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormField label="CvSU email" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting} icon={Send}>
          Send reset link
        </Button>
      </form>

      <p className="mt-8 text-center text-sm">
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
