import { z } from 'zod';
import { optionalPhone } from './item.schema';

export const profileSchema = z.object({
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
  department: z.string().trim().min(2, 'Enter your college or department').max(150, 'Too long'),
  userType: z.enum(['student', 'faculty', 'personnel'], { error: 'Select your user type' }),
  phone: optionalPhone,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine((d) => d.password !== d.currentPassword, {
    path: ['password'],
    message: 'Your new password must be different from the current one',
  });
