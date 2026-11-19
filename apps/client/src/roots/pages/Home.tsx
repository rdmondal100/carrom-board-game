import { BookOpen, Play, Settings } from 'lucide-react';
import { Link } from 'react-router';
import { BoardDiagram } from '@/components/BoardDiagram';
import { Button } from '@/components/ui/button';
import { loadGame } from '@/game/save';
import { t, useLang } from '@/i18n/t';

export function Home() {
  useLang();
  const saved = loadGame() !== null;
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 text-center">
      <BoardDiagram variant="logo" className="w-40" />
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold">{t('app.title')}</h2>
        <p className="text-muted-foreground">{t('home.tagline')}</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        {saved && (
          <Button asChild size="lg" variant="secondary">
            <Link to="/local/play">{t('home.resume')}</Link>
          </Button>
        )}
        <Button asChild size="lg">
          <Link to="/play"><Play />{t('home.play')}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/how-to-play"><BookOpen />{t('nav.howTo')}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/settings"><Settings />{t('nav.settings')}</Link>
        </Button>
      </div>
    </div>
  );
}
