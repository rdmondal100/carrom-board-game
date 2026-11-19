import { EMOTES, type EmoteId } from '@carrom/protocol';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n/t';

/** ROOM-10: the fixed emote set; the icon shows on the button and with the label when received. */
export const EMOTE_ICONS: Record<EmoteId, string> = {
  wow: '😮', nice: '👍', oops: '😅', gg: '🤝', hurry: '⏱️', thanks: '🙏', laugh: '😂', angry: '😠',
};

export function EmoteBar({ onSend, disabled }: { onSend: (id: EmoteId) => void; disabled: boolean }) {
  return (
    <div role="toolbar" aria-label={t('online.emotes')} className="flex flex-wrap justify-center gap-1">
      {EMOTES.map((id) => (
        <Button
          key={id} size="sm" variant="ghost" className="px-2 text-lg" disabled={disabled}
          title={t(`emote.${id}`)} aria-label={t(`emote.${id}`)} onClick={() => onSend(id)}
        >
          {EMOTE_ICONS[id]}
        </Button>
      ))}
    </div>
  );
}
