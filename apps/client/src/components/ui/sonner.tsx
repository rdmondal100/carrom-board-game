import type { ComponentProps } from 'react';
import { Toaster as Sonner } from 'sonner';
import { TOAST_MS } from '@/constants/view';

/** shadcn's toast (sonner), themed to the app colours. Call `toast(text)` from 'sonner'. */
export function Toaster(props: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      duration={TOAST_MS}
      toastOptions={{
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)',
          fontFamily: 'inherit',
        },
      }}
      {...props}
    />
  );
}
