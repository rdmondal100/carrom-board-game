import { z } from 'zod';
import { AVATAR_COUNT, NAME_MAX, NAME_MIN, PASSWORD_MIN } from '@carrom/protocol';

// Messages are i18n keys; the forms translate them. Rules match the server's.

export const nameField = z.string().trim()
  .min(NAME_MIN, 'auth.err.name')
  .max(NAME_MAX, 'auth.err.name')
  .regex(/^[^\p{Cc}\p{Cf}]*$/u, 'auth.err.name');

const emailField = z.string().trim().toLowerCase().pipe(z.email('auth.err.email'));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'auth.err.passwordRequired'),
});

export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  password: z.string().min(PASSWORD_MIN, 'auth.err.passwordShort'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'auth.err.passwordMatch' });

export const profileSchema = z.object({
  name: nameField,
  avatar: z.number().int().min(0).max(AVATAR_COUNT - 1),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.input<typeof registerSchema>;
export type ProfileForm = z.infer<typeof profileSchema>;
