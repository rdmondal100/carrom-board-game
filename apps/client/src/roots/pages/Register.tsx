import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate } from 'react-router';
import { AuthError, Field } from '@/components/AuthForm';
import { GoogleButton } from '@/components/GoogleButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { registerSchema, type RegisterForm } from '@/schemas/auth';
import { clearAuthError, registerUser } from '@/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

/** AUTH-3 / AUTH-9: a new account, or a guest keeping progress (the guest's token is sent). */
export function Register() {
  useLang();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, loading } = useAppSelector((s) => s.auth);
  const isGuest = user?.isGuest === true;
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: user?.name ?? '', email: '', password: '', confirm: '' },
  });
  useEffect(() => { dispatch(clearAuthError()); }, [dispatch]);

  if (user && !user.isGuest) return <Navigate to="/profile" replace />;

  const onSubmit = async (v: RegisterForm) => {
    const r = await dispatch(registerUser({ name: v.name.trim(), email: v.email.trim(), password: v.password }));
    if (registerUser.fulfilled.match(r)) navigate('/profile', { replace: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <h2 className="text-xl font-bold">{t(isGuest ? 'auth.register.titleGuest' : 'auth.register.title')}</h2>
      {isGuest && <p className="text-sm text-muted-foreground">{t('auth.register.guestHint')}</p>}
      <Card>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label={t('auth.name')} autoComplete="nickname" error={errors.name} {...register('name')} />
          <Field label={t('auth.email')} type="email" autoComplete="email" error={errors.email} {...register('email')} />
          <Field label={t('auth.password')} type="password" autoComplete="new-password" error={errors.password} {...register('password')} />
          <Field label={t('auth.confirm')} type="password" autoComplete="new-password" error={errors.confirm} {...register('confirm')} />
          <AuthError actions={['register', 'google']} />
          <Button type="submit" disabled={loading}>{t('auth.register.submit')}</Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">{t('auth.or')}</p>
        <GoogleButton onDone={() => navigate('/profile', { replace: true })} />
      </Card>
      <p className="text-center text-sm">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">{t('auth.login.link')}</Link>
      </p>
    </div>
  );
}
