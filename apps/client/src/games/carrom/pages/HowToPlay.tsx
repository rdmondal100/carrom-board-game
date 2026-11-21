import { carromPath } from '../paths';
import { Link } from 'react-router';
import { RULES } from '@carrom/rules';
import { BoardDiagram, type DiagramVariant } from '@/games/carrom/components/BoardDiagram';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';

const MS_PER_S = 1000;

/** UI-4 sections, in reading order. Text lives in i18n under howto.<id>.*. */
const SECTIONS: readonly { id: string; diagram?: DiagramVariant }[] = [
  { id: 'goal', diagram: 'logo' },
  { id: 'shoot', diagram: 'shoot' },
  { id: 'colour', diagram: 'colour' },
  { id: 'point', diagram: 'point' },
  { id: 'queen', diagram: 'queen' },
  { id: 'lastCoin', diagram: 'lastCoin' },
  { id: 'turns' },
];

/** Numbers come from the rules package, so the text can't drift from the game. */
const VARS = {
  coins: RULES.COINS_PER_COLOUR,
  red: RULES.RED_BONUS,
  margin: RULES.RED_CUTOFF_MARGIN,
  boards: RULES.MAX_BOARDS,
  white: RULES.POINT_VALUE.white,
  black: RULES.POINT_VALUE.black,
  queen: RULES.POINT_VALUE.red,
  perBoard: RULES.COINS_PER_COLOUR * (RULES.POINT_VALUE.white + RULES.POINT_VALUE.black) + RULES.POINT_VALUE.red,
  clock: RULES.SHOT_CLOCK_MS / MS_PER_S,
  timeouts: RULES.TIMEOUTS_FOR_BOT,
};

/** Body text: one paragraph per line break in the string. */
function Body({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {text.split('\n').map((p) => <p key={p}>{p}</p>)}
    </div>
  );
}

export function HowToPlay() {
  useLang();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h2 className="text-xl font-bold">{t('howto.title')}</h2>
      {SECTIONS.map(({ id, diagram }) => (
        <Card key={id} className="gap-3 sm:flex-row sm:items-start">
          {diagram && <BoardDiagram variant={diagram} className="w-28 shrink-0 self-center sm:self-start" />}
          <section className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">{t(`howto.${id}.title`)}</h3>
            <Body text={t(`howto.${id}.body`, VARS)} />
          </section>
        </Card>
      ))}
      <Button asChild size="lg"><Link to={carromPath('play')}>{t('home.play')}</Link></Button>
    </div>
  );
}
