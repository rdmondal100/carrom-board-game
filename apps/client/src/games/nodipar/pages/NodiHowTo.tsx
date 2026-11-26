import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { NODI_RULES } from '@hub/nodipar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RiverBoard } from '@/games/nodipar/components/RiverBoard';
import { demoStart, demoStep } from '@/games/nodipar/demo';
import { nodiPath } from '@/games/nodipar/paths';
import type { RiverApi } from '@/games/nodipar/useRiverCanvas';
import { t, useLang } from '@/i18n/t';

const MS_PER_S = 1000;
const PAUSE_MS = 900;

/** NODI-6 sections in reading order; text lives in i18n under nodi.howto.<id>.*. */
const SECTIONS = ['goal', 'turn', 'moor', 'whirl', 'par', 'score', 'borsha', 'teams', 'clock'] as const;

/** Numbers come from the rules package, so the text can't drift from the game. */
const VARS = {
  boats: NODI_RULES.BOATS,
  launches: NODI_RULES.LAUNCHES,
  flicks: NODI_RULES.EXTRA_FLICKS,
  island: NODI_RULES.ISLAND_POINTS,
  centre: NODI_RULES.CENTRE_POINTS,
  par: NODI_RULES.PAR_BONUS,
  wins: NODI_RULES.ROUNDS_TO_WIN,
  rounds: NODI_RULES.ROUNDS,
  clock: NODI_RULES.CLOCK_MS / MS_PER_S,
  timeouts: NODI_RULES.TIMEOUTS_FOR_BOT,
};

function Body({ text }: { text: string }) {
  return <div className="flex flex-col gap-2 text-sm leading-relaxed">{text.split('\n').map((p) => <p key={p}>{p}</p>)}</div>;
}

/** NODI-6 the animated example: bots play the opening of a round on a real river, over and over. */
function Demo() {
  const river = useRef<RiverApi>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let state = demoStart();
    const next = () => {
      if (!alive || !river.current) return;
      const step = demoStep(state);
      if (!step) {
        state = demoStart();
        river.current.show(state, 0);
        timer = setTimeout(next, PAUSE_MS);
        return;
      }
      river.current.play(step.seat, step.move, true, () => {
        state = step.next;
        river.current?.show(state, 0);
        timer = setTimeout(next, PAUSE_MS);
      });
    };
    river.current?.show(state, 0);
    timer = setTimeout(next, PAUSE_MS);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return <RiverBoard ref={river} flat label={t('nodi.howto.demo')} className="mx-auto max-w-72" />;
}

/** NODI-6 how to play Nodi Par (bn + en), with an animated example. */
export function NodiHowTo() {
  useLang();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h2 className="text-xl font-bold">{t('nodi.howto.title')}</h2>
      <Demo />
      <p className="text-center text-xs text-muted-foreground">{t('nodi.howto.demo')}</p>
      {SECTIONS.map((id) => (
        <Card key={id} className="gap-2 p-4">
          <h3 className="text-lg font-semibold">{t(`nodi.howto.${id}.title`)}</h3>
          <Body text={t(`nodi.howto.${id}.body`, VARS)} />
        </Card>
      ))}
      <Button asChild size="lg"><Link to={nodiPath('play')}>{t('home.play')}</Link></Button>
    </div>
  );
}
