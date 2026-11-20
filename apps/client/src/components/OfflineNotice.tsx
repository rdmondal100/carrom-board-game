import { WifiOff } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n/t';

/** APP-9: shown instead of an online screen while there is no network. */
export function OfflineNotice() {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center" data-testid="offline">
      <WifiOff className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-bold">{t('offline.title')}</h1>
      <p className="text-muted-foreground">{t('offline.body')}</p>
      <div className="flex gap-2">
        <Button asChild><Link to="/local/setup?vs=bot">{t('offline.bot')}</Link></Button>
        <Button asChild variant="outline"><Link to="/local/setup">{t('offline.local')}</Link></Button>
      </div>
    </div>
  );
}
