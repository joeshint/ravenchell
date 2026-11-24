import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { makeRegisterSchema } from '@/schemas/auth.schema';
import { checkRegistrationAvailability, signUp } from '@/services/auth.service';
import { useAllowedEmailDomains } from '@/hooks/useLookups';
import { DEPARTMENT_SUGGESTIONS, USER_TYPES } from '@/lib/constants';
import { getErrorMessage } from '@/utils/errors';
import { Button } from '@/components/common/Button';
import { Checkbox, FormField, Input, PasswordInput, Select } from '@/components/common/FormControls';
import { Alert } from '@/components/common/Feedback';

export default function RegisterPage() {
  const navigate = useNavigate();
  const domains = useAllowedEmailDomains();
  const schema = useMemo(() => makeRegisterSchema(domains), [domains]);
  const [formError, setFormError] = useState(null);
  const [confirmationEmail, setConfirmationEmail] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      studentEmployeeId: '',
      email: '',
      department: '',
      userType: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      const availability = await checkRegistrationAvailability(values.email, values.studentEmployeeId);
      let conflict = false;
      if (availability?.email_taken) {
        setError('email', { message: 'An account with this email already exists.' });
        conflict = true;
      }
      if (availability?.student_id_taken) {
        setError('studentEmployeeId', { message: 'This ID is already registered.' });
        conflict = true;
      }
      if (conflict) return;

      const { needsEmailConfirmation } = await signUp(values);
      if (needsEmailConfirmation) {
        setConfirmationEmail(values.email);
      } else {
        toast.success('Account created. Welcome!');
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  if (confirmationEmail) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-brand-50">
          <MailCheck className="size-7 text-brand-600" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Check your email</h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a confirmation link to <span className="font-medium text-slate-900">{confirmationEmail}</span>. Open
          it to activate your account, then sign in.
        </p>
        <Button to="/login" className="mt-8 w-full" size="lg">
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">For CvSU students, faculty and university personnel.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <FormField label="Full name" error={errors.fullName?.message} required>
          <Input autoComplete="name" placeholder="Juan A. Dela Cruz" {...register('fullName')} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="User type" error={errors.userType?.message} required>
            <Select placeholder="Select…" {...register('userType')}>
              {USER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Student / Employee ID" error={errors.studentEmployeeId?.message} required>
            <Input placeholder="2021-00123" autoComplete="off" {...register('studentEmployeeId')} />
          </FormField>
        </div>

        <FormField
          label="CvSU institutional email"
          error={errors.email?.message}
          hint={domains.length ? `Must end with @${domains.join(' or @')}` : undefined}
          required
        >
          <Input type="email" autoComplete="email" placeholder={`juan.delacruz@${domains[0] ?? 'cvsu.edu.ph'}`} {...register('email')} />
        </FormField>

        <FormField label="College / Department" error={errors.department?.message} required>
          <Input list="department-suggestions" placeholder="Start typing your college…" {...register('department')} />
        </FormField>
        <datalist id="department-suggestions">
          {DEPARTMENT_SUGGESTIONS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Password" error={errors.password?.message} hint="8+ characters with a letter and a number" required>
            <PasswordInput autoComplete="new-password" {...register('password')} />
          </FormField>
          <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
            <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
          </FormField>
        </div>

        <FormField error={errors.acceptTerms?.message}>
          <Checkbox
            label="I will provide truthful information and only claim items that belong to me."
            {...register('acceptTerms')}
          />
        </FormField>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting} icon={UserPlus}>
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
