import { Box, Square } from 'lucide-react';
import type { GameId } from '@hub/game-kit';
import { useGameView } from '@/game3d/useGameView';
import { t } from '@/i18n/t';
import { cn } from '@/lib/utils';
import type { View } from '@/store/settingsSlice';

const ICON: Record<View, typeof Box> = { '2d': Square, '3d': Box };

/** T3D-1 a 2D | 3D switch for one game's board (the game keeps going when it flips). */
export function ViewToggle({ game, className }: { game: GameId; className?: string }) {
  const { view, supported, setView } = useGameView(game);
  return (
    <div role="radiogroup" aria-label={t('view.label')} data-testid={`view-toggle-${game}`}
      className={cn('inline-flex shrink-0 rounded-full bg-black/25 p-0.5 text-xs font-semibold ring-1 ring-white/10', className)}>
      {(['2d', '3d'] as const).map((v) => {
        const Icon = ICON[v];
        const on = view === v;
        const off = v === '3d' && !supported;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} disabled={off} title={off ? t('view.noWebgl') : undefined}
            onClick={() => setView(v)} data-testid={`view-${v}`}
            className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 transition', on ? 'bg-amber-400 text-slate-900 shadow' : 'opacity-75 hover:opacity-100', off && 'cursor-not-allowed opacity-40')}>
            <Icon className="size-3.5" aria-hidden />{t(`view.${v}`)}
          </button>
        );
      })}
    </div>
  );
}
