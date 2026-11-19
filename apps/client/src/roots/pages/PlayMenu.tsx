import type { LucideIcon } from 'lucide-react';
import { Bot, Globe, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { cn } from '@/lib/utils';

interface Mode { id: string; Icon: LucideIcon; to: string | null }

/** UI-1 / BOT-6 / ROOM-11: same device, vs bot, and online private rooms. A null `to` shows "coming soon". */
const MODES: readonly Mode[] = [
  { id: 'local', Icon: Users, to: '/local/setup' },
  { id: 'bot', Icon: Bot, to: '/local/setup?vs=bot' },
  { id: 'online', Icon: Globe, to: '/online' },
];

function ModeCard({ mode }: { mode: Mode }) {
  const soon = mode.to === null;
  const body = (
    <Card className={cn('flex-row items-center gap-4', soon ? 'opacity-50' : 'transition-colors hover:bg-accent')}>
      <mode.Icon className="size-9 shrink-0 text-amber-400" />
      <CardHeader className="flex-1">
        <CardTitle>{t(`play.${mode.id}`)}</CardTitle>
        <CardDescription>{t(`play.${mode.id}Desc`)}</CardDescription>
      </CardHeader>
      {soon && <span className="rounded-full bg-muted px-2 py-1 text-xs">{t('play.soon')}</span>}
    </Card>
  );
  if (soon) return <div aria-disabled="true" data-testid={`mode-${mode.id}`}>{body}</div>;
  return <Link to={mode.to ?? '/'} data-testid={`mode-${mode.id}`} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link>;
}

export function PlayMenu() {
  useLang();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('play.title')}</h2>
      {MODES.map((m) => <ModeCard key={m.id} mode={m} />)}
    </div>
  );
}
