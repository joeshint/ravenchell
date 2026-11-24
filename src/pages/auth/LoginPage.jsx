import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { loginSchema } from '@/schemas/auth.schema';
import { signIn } from '@/services/auth.service';
import { getErrorMessage } from '@/utils/errors';
import { Button } from '@/components/common/Button';
import { FormField, Input, PasswordInput } from '@/components/common/FormControls';
import { Alert } from '@/components/common/Feedback';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await signIn(values);
      toast.success('Welcome back!');
      const from = location.state?.from;
      navigate(from ? `${from.pathname}${from.search ?? ''}` : '/dashboard', { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Use your CvSU account to report and claim items.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <FormField label="CvSU email" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" placeholder="juan.delacruz@cvsu.edu.ph" {...register('email')} />
        </FormField>

        <FormField
          label="Password"
          error={errors.password?.message}
          required
          labelAction={
            <Link to="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...register('password')} />
        </FormField>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting} icon={LogIn}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        New to CvSU Lost and Found?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-sm">
        <Link to="/" className="text-slate-500 hover:text-slate-700">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
