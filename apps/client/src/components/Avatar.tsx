import { AVATAR_COUNT } from '@carrom/protocol';
import { cn } from '@/lib/utils';

/** AUTH-1: the fixed avatar set: one colour each, with the player's initial. */
export const AVATAR_COLOURS: readonly string[] = [
  'bg-red-600', 'bg-orange-600', 'bg-amber-500', 'bg-lime-600', 'bg-green-700', 'bg-teal-600',
  'bg-cyan-600', 'bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-fuchsia-600', 'bg-rose-500',
];
if (AVATAR_COLOURS.length !== AVATAR_COUNT) throw new Error('AVATAR_COLOURS must match AVATAR_COUNT');

const SIZES = { sm: 'size-8 text-sm', md: 'size-12 text-lg', lg: 'size-20 text-3xl' } as const;

export function Avatar({ index, name, size = 'md', className }: {
  index: number; name: string; size?: keyof typeof SIZES; className?: string;
}) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white',
        AVATAR_COLOURS[index] ?? AVATAR_COLOURS[0], SIZES[size], className,
      )}
    >
      {initial}
    </span>
  );
}
