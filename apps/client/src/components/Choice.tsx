import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

/** One radio option drawn as a chip (setup and online forms). */
export function Choice({ reg, value, label }: { reg: UseFormRegisterReturn; value: string; label: string }) {
  return (
    <label className="flex-1">
      <input type="radio" value={value} {...reg} className="peer sr-only" />
      <span className="block text-center px-3 py-2 rounded border border-border cursor-pointer peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
        {label}
      </span>
    </label>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold mb-1">{title}</legend>
      {children}
    </fieldset>
  );
}
