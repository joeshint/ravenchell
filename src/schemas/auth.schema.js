import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
});

/** Built per render because the allowed email domains come from system settings. */
export function makeRegisterSchema(allowedDomains = []) {
  const domains = allowedDomains.map((d) => d.toLowerCase());
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(2, 'Enter your full name')
        .max(120, 'Name is too long')
        .regex(/^[\p{L}\s.'-]+$/u, 'Use letters, spaces, periods, apostrophes or hyphens only'),
      studentEmployeeId: z
        .string()
        .trim()
        .min(3, 'Enter your Student or Employee ID')
        .max(30, 'ID is too long')
        .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and hyphens only'),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .min(1, 'Email is required')
        .pipe(z.email('Enter a valid email address'))
        .refine((v) => domains.length === 0 || domains.some((d) => v.endsWith(`@${d}`)), {
          message: domains.length ? `Use your CvSU email (@${domains.join(', @')})` : 'Invalid email',
        }),
      department: z.string().trim().min(2, 'Enter your college or department').max(150, 'Too long'),
      userType: z.enum(['student', 'faculty', 'personnel'], { error: 'Select your user type' }),
      password,
      confirmPassword: z.string().min(1, 'Confirm your password'),
      acceptTerms: z.literal(true, { error: 'You must agree to use the system responsibly' }),
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    });
}

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
});

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
