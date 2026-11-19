import { describe, expect, it } from 'vitest';
import en from '@/i18n/en.json';
import bn from '@/i18n/bn.json';
import { loginSchema, nameField, profileSchema, registerSchema } from './auth';

const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => i.message);

const goodReg = { name: 'Rina', email: 'rina@example.com', password: 'correct horse', confirm: 'correct horse' };

describe('auth schemas', () => {
  it('AUTH-6 name: 3–20 characters after trimming, Bangla allowed', () => {
    expect(nameField.parse('  Rina ')).toBe('Rina');
    expect(nameField.safeParse('রিনা').success).toBe(true);
    expect(nameField.safeParse('x'.repeat(20)).success).toBe(true);
    expect(messages(nameField.safeParse('ab'))).toEqual(['auth.err.name']);
    expect(messages(nameField.safeParse('   ab  '))).toEqual(['auth.err.name']);
    expect(messages(nameField.safeParse('x'.repeat(21)))).toEqual(['auth.err.name']);
    expect(nameField.safeParse('Ri\u0007na').success).toBe(false);
  });

  it('AUTH-3 register: good input passes; email is trimmed and lowercased', () => {
    const r = registerSchema.parse({ ...goodReg, email: ' Rina@Example.COM ' });
    expect(r.email).toBe('rina@example.com');
  });

  it('AUTH-3 register: short password, bad email, mismatch', () => {
    expect(messages(registerSchema.safeParse({ ...goodReg, password: '1234567', confirm: '1234567' })))
      .toEqual(['auth.err.passwordShort']);
    expect(messages(registerSchema.safeParse({ ...goodReg, email: 'nope' }))).toEqual(['auth.err.email']);
    expect(messages(registerSchema.safeParse({ ...goodReg, confirm: 'other horse' }))).toEqual(['auth.err.passwordMatch']);
  });

  it('AUTH-4 login: email and a password are required', () => {
    expect(loginSchema.safeParse({ email: 'r@example.com', password: 'x' }).success).toBe(true);
    expect(messages(loginSchema.safeParse({ email: 'r@example.com', password: '' }))).toEqual(['auth.err.passwordRequired']);
    expect(messages(loginSchema.safeParse({ email: '', password: 'x' }))).toEqual(['auth.err.email']);
  });

  it('AUTH-6 profile: avatar must be in the fixed set', () => {
    expect(profileSchema.safeParse({ name: 'Rina', avatar: 11 }).success).toBe(true);
    expect(profileSchema.safeParse({ name: 'Rina', avatar: 12 }).success).toBe(false);
    expect(profileSchema.safeParse({ name: 'Rina', avatar: -1 }).success).toBe(false);
  });

  it('AUTH-9 every schema message has en and bn text', () => {
    const keys = ['auth.err.name', 'auth.err.email', 'auth.err.passwordShort', 'auth.err.passwordMatch', 'auth.err.passwordRequired'];
    for (const k of keys) {
      expect(en).toHaveProperty([k]);
      expect(bn).toHaveProperty([k]);
    }
    expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort());
  });
});
