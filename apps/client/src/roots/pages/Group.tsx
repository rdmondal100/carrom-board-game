import { useEffect } from 'react';
import { Lock, LockOpen, Share2, UserMinus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { GROUP_MAX_MEMBERS, type GroupPlayers, type GroupView } from '@carrom/protocol';
import { AddaError, GamePicker, PlayerRow, PresenceLine } from '@/components/AddaParts';
import { GroupLeaderboard, GroupMatches, ReportButton } from '@/components/GroupParts';
import { LoungeVoice } from '@/components/LoungeVoice';
import { SignInGate } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { useAppName } from '@/games/appName';
import { gamePath } from '@/games/types';
import { t, useLang } from '@/i18n/t';
import { groupInviteUrl, shareLink } from '@/lib/adda';
import { fetchGroup, leaveGroup, removeMember, startGroupRoom, updateGroup } from '@/store/addaSlice';
import { joinByCode } from '@/store/roomSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function Invite({ view }: { view: GroupView }) {
  const dispatch = useAppDispatch();
  const app = useAppName();
  const { group } = view;
  const owner = group.role === 'owner';
  const share = async () => {
    const r = await shareLink(groupInviteUrl(group.code), app, t('adda.group.shareText', { group: group.name, app }));
    if (r === 'copied') toast(t('lobby.copied'));
  };
  return (
    <Card className="gap-2">
      <CardTitle>{t('adda.group.invite')}</CardTitle>
      {group.invitesLocked
        ? <p className="text-sm text-muted-foreground">{t('adda.group.locked')}</p>
        : <code className="truncate rounded-md bg-muted px-3 py-2 text-sm">{groupInviteUrl(group.code)}</code>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void share()} disabled={group.invitesLocked}><Share2 className="size-4" />{t('lobby.share')}</Button>
        {owner && (
          <Button variant="outline" onClick={() => void dispatch(updateGroup({ id: group.id, invitesLocked: !group.invitesLocked }))}>
            {group.invitesLocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
            {group.invitesLocked ? t('adda.group.unlock') : t('adda.group.lock')}
          </Button>
        )}
      </div>
    </Card>
  );
}

function GroupBody({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const me = useAppSelector((s) => s.auth.user?.id);
  const { group: view, error, loading } = useAppSelector((s) => s.adda);
  const joining = useAppSelector((s) => s.room.connecting);
  useEffect(() => { void dispatch(fetchGroup(id)); }, [dispatch, id]);

  if (!view || view.group.id !== id) {
    return error ? <AddaError error={error} /> : <p className="text-center text-muted-foreground">{t('auth.loading')}</p>;
  }
  const owner = view.group.role === 'owner';

  // ADDA-3 make the room, tell online members (server), then sit in it.
  const start = async (gameId: string, players: GroupPlayers) => {
    const r = await dispatch(startGroupRoom({ id, gameId, players }));
    if (!startGroupRoom.fulfilled.match(r)) return;
    const j = await dispatch(joinByCode(r.payload.code));
    if (joinByCode.fulfilled.match(j)) void navigate(gamePath(r.payload.gameId, 'online/lobby'));
  };
  const leave = async () => {
    if (!window.confirm(t('adda.group.leaveConfirm', { group: view.group.name }))) return;
    const r = await dispatch(leaveGroup(id));
    if (leaveGroup.fulfilled.match(r)) void navigate('/groups', { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <AddaError error={error} />
      <Card className="gap-2">
        <CardTitle>{t('adda.group.start')}</CardTitle>
        <GamePicker label={t('adda.group.startGo')} busy={loading || joining} onPick={(g, n) => void start(g, n)} />
      </Card>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t('adda.groups.members', { n: view.members.length, max: GROUP_MAX_MEMBERS })}
        </h3>
        <ul className="flex flex-col gap-1">
          {view.members.map((m) => (
            <PlayerRow key={m.id} name={m.name} avatar={m.avatar}
              sub={<span className="flex gap-2"><PresenceLine presence={m.presence} />
                {m.role === 'owner' && <span className="text-xs text-amber-400">{t('adda.groups.owner')}</span>}</span>}>
              {m.id !== me && <ReportButton groupId={id} userId={m.id} name={m.name} />}
              {owner && m.id !== me && (
                <Button size="icon" variant="ghost" aria-label={t('adda.group.remove', { name: m.name })}
                  onClick={() => { if (window.confirm(t('adda.group.removeConfirm', { name: m.name }))) void dispatch(removeMember({ id, userId: m.id })).then(() => dispatch(fetchGroup(id))); }}>
                  <UserMinus className="size-4" />
                </Button>
              )}
            </PlayerRow>
          ))}
        </ul>
      </section>

      <LoungeVoice groupId={id} />
      <Invite view={view} />
      <GroupLeaderboard groupId={id} />
      <GroupMatches matches={view.matches} />

      <div className="flex justify-between gap-2">
        <ReportButton groupId={id} name={view.group.name} />
        <Button variant="outline" onClick={() => void leave()}>{t('adda.group.leave')}</Button>
      </div>
    </div>
  );
}

/** ADDA-3 `/groups/:id`: start a room in any game, members and status, voice lounge, invite, leaderboard, recent games. */
export function Group() {
  useLang();
  const id = useParams().id ?? '';
  const name = useAppSelector((s) => (s.adda.group?.group.id === id ? s.adda.group.group.name : ''));
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-xl font-bold">{name || t('adda.groups.page')}</h2>
        <Button asChild variant="ghost" size="sm"><Link to="/groups">{t('online.back')}</Link></Button>
      </div>
      <SignInGate next={`/groups/${id}`}><GroupBody id={id} /></SignInGate>
    </div>
  );
}
