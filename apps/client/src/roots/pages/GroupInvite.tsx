import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { GROUP_MAX_MEMBERS, type GroupInvitePreview } from '@carrom/protocol';
import { AddaError } from '@/components/AddaParts';
import { SignInGate } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { cleanCode } from '@/schemas/joinCode';
import { joinGroup, previewInvite, type AddaFailure } from '@/store/addaSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function JoinCard({ code }: { code: string }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [preview, setPreview] = useState<GroupInvitePreview | null>(null);
  const [failure, setFailure] = useState<AddaFailure | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void dispatch(previewInvite(code)).then((r) => {
      if (previewInvite.fulfilled.match(r)) setPreview(r.payload);
      else setFailure(r.payload ?? { status: 0, error: '' });
    });
  }, [dispatch, code, userId]);

  if (preview?.member) return <Navigate to={`/groups/${preview.id}`} replace />;
  const join = async () => {
    setBusy(true);
    const r = await dispatch(joinGroup(code));
    setBusy(false);
    if (joinGroup.fulfilled.match(r)) void navigate(`/groups/${r.payload.group.id}`, { replace: true });
    else setFailure(r.payload ?? { status: 0, error: '' });
  };
  return (
    <Card className="items-center gap-3 p-6 text-center">
      {preview && (
        <>
          <CardTitle className="text-lg">{preview.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('adda.groups.members', { n: preview.members, max: GROUP_MAX_MEMBERS })}</p>
          {preview.locked
            ? <p className="text-sm">{t('adda.group.locked')}</p>
            : <Button className="w-full" onClick={() => void join()} disabled={busy}>{t('adda.invite.join')}</Button>}
        </>
      )}
      {!preview && !failure && <p className="text-muted-foreground">{t('auth.loading')}</p>}
      <AddaError error={failure?.status === 404 ? { status: 404, error: t('adda.invite.notFound') } : failure} />
      {failure && <Button asChild variant="outline"><Link to="/groups">{t('adda.groups.page')}</Link></Button>}
    </Card>
  );
}

/** ADDA-2 `/a/:code`: a group invite link. Opens on the web; sign in (a guest is fine), then join. */
export function GroupInvite() {
  useLang();
  const code = cleanCode(useParams().code ?? '');
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">{t('adda.invite.title')}</h2>
      <SignInGate next={`/a/${code}`}><JoinCard code={code} /></SignInGate>
    </div>
  );
}
