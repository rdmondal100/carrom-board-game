import { Link } from 'react-router';
import { CB } from '@hub/callbreak';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CbPreview } from '@/games/callbreak/components/CbPreview';
import { cbPath } from '@/games/callbreak/paths';
import { t, useLang } from '@/i18n/t';

const MS_PER_S = 1000;

/** CB-7 sections in reading order; text lives in i18n under callbreak.howto.<id>.*. */
const SECTIONS = ['goal', 'deal', 'call', 'play', 'trumps', 'score', 'length', 'redeal', 'clock'] as const;

/** Numbers come from the rules package, so the text can't drift from the game. */
const VARS = {
  hand: CB.HAND,
  min: CB.MIN_BID,
  max: CB.MAX_BID,
  rounds: CB.ROUND_OPTIONS[0],
  short: CB.ROUND_OPTIONS[1],
  clock: CB.CLOCK_MS / MS_PER_S,
  timeouts: CB.TIMEOUTS_FOR_BOT,
};

function Body({ text }: { text: string }) {
  return <div className="flex flex-col gap-2 text-sm leading-relaxed">{text.split('\n').map((p) => <p key={p}>{p}</p>)}</div>;
}

/** CB-7 how to play Callbreak (bn + en). */
export function CbHowTo() {
  useLang();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h2 className="text-xl font-bold">{t('callbreak.howto.title')}</h2>
      <CbPreview equipped={{}} className="mx-auto w-48" />
      {SECTIONS.map((id) => (
        <Card key={id} className="gap-2 p-4">
          <h3 className="text-lg font-semibold">{t(`callbreak.howto.${id}.title`)}</h3>
          <Body text={t(`callbreak.howto.${id}.body`, VARS)} />
        </Card>
      ))}
      <Button asChild size="lg"><Link to={cbPath('play')}>{t('home.play')}</Link></Button>
    </div>
  );
}
