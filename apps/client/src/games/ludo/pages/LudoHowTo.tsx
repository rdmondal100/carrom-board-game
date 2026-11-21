import { Link } from 'react-router';
import { LUDO } from '@hub/ludo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LudoPreview } from '@/games/ludo/components/LudoPreview';
import { ludoPath } from '@/games/ludo/paths';
import { t, useLang } from '@/i18n/t';

const MS_PER_S = 1000;

/** LUDO-9 sections in reading order; text lives in i18n under ludo.howto.<id>.*. */
const SECTIONS = ['goal', 'turn', 'leave', 'capture', 'safe', 'home', 'presets', 'teams', 'quick', 'clock'] as const;

/** Numbers come from the rules package, so the text can't drift from the game. */
const VARS = {
  tokens: LUDO.TOKENS,
  six: LUDO.SIX,
  sixes: LUDO.SIXES_LOSE,
  column: LUDO.HOME - LUDO.LAST_TRACK - 1,
  clock: LUDO.CLOCK_MS / MS_PER_S,
  timeouts: LUDO.TIMEOUTS_FOR_BOT,
};

function Body({ text }: { text: string }) {
  return <div className="flex flex-col gap-2 text-sm leading-relaxed">{text.split('\n').map((p) => <p key={p}>{p}</p>)}</div>;
}

/** LUDO-9 how to play Ludo (bn + en), with what BD rules change from classic. */
export function LudoHowTo() {
  useLang();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h2 className="text-xl font-bold">{t('ludo.howto.title')}</h2>
      <LudoPreview equipped={{}} className="mx-auto w-40" />
      {SECTIONS.map((id) => (
        <Card key={id} className="gap-2 p-4">
          <h3 className="text-lg font-semibold">{t(`ludo.howto.${id}.title`)}</h3>
          <Body text={t(`ludo.howto.${id}.body`, VARS)} />
        </Card>
      ))}
      <Button asChild size="lg"><Link to={ludoPath('play')}>{t('home.play')}</Link></Button>
    </div>
  );
}
