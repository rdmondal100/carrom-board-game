import { useId, type ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';

/** One settings line: label + hint on the left, the control on the right. */
export function Row({ label, hint, control, id }: { label: string; hint?: string; control: ReactNode; id: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-1 flex-col">
        <label htmlFor={id} className="font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {control}
    </div>
  );
}

export function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  const id = useId();
  return <Row id={id} label={label} hint={hint} control={<Switch id={id} checked={checked} onCheckedChange={onChange} />} />;
}
