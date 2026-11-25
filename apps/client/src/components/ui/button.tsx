import type { ComponentProps } from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all outline-none active:translate-y-px focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 shrink-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-linear-to-b from-amber-300 to-orange-500 text-primary-foreground shadow-[0_3px_0_#b45309,0_10px_24px_-10px_rgb(255_150_0/0.7)] hover:brightness-110 active:shadow-[0_1px_0_#b45309]',
        destructive: 'bg-linear-to-b from-rose-500 to-red-600 text-white shadow-[0_3px_0_#991b1b] hover:brightness-110 active:shadow-[0_1px_0_#991b1b]',
        outline: 'border border-white/15 bg-white/5 backdrop-blur hover:bg-white/10 hover:text-accent-foreground',
        secondary: 'bg-linear-to-b from-violet-500 to-indigo-600 text-white shadow-[0_3px_0_#3730a3] hover:brightness-110 active:shadow-[0_1px_0_#3730a3]',
        ghost: 'hover:bg-white/10 hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className, variant, size, asChild = false, ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
