import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

/** One radio option drawn as a chip (setup and online forms). */
export function Choice({ reg, value, label }: { reg: UseFormRegisterReturn; value: string; label: string }) {
  return (
    <label className="flex-1">
      <input type="radio" value={value} {...reg} className="peer sr-only" />
      <span className="block cursor-pointer rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-center font-medium whitespace-nowrap transition-all hover:bg-white/10 peer-checked:border-transparent peer-checked:bg-linear-to-b peer-checked:from-amber-300 peer-checked:to-orange-500 peer-checked:text-primary-foreground peer-checked:shadow-[0_3px_0_#b45309] peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
        {label}
      </span>
    </label>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <legend className="px-1 text-xs font-bold tracking-wider text-amber-200/90 uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}
