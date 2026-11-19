import { useId, type ComponentProps } from 'react';
import type { FieldError } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n/t';
import { authErrorKey, type AuthAction } from '@/store/authSlice';
import { useAppSelector } from '@/store/store';

/** A labelled input with its (translated) zod error under it. */
export function Field({ label, error, ...props }: ComponentProps<'input'> & { label: string; error?: FieldError }) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} {...props} />
      {error?.message && <p id={errId} className="text-sm text-destructive">{t(error.message)}</p>}
    </div>
  );
}

/** The last failed call of one of `actions`, translated when we know it. */
export function AuthError({ actions }: { actions: readonly AuthAction[] }) {
  const err = useAppSelector((s) => s.auth.error);
  if (!err || !actions.includes(err.action)) return null;
  const key = authErrorKey(err);
  return <p role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{key ? t(key) : err.error}</p>;
}
