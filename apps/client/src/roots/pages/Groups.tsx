import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { GROUP_MAX_MEMBERS } from '@carrom/protocol';
import { AddaError } from '@/components/AddaParts';
import { Field } from '@/components/AuthForm';
import { SignInGate } from '@/components/OnlineParts';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { groupCodeSchema, groupNameSchema, type GroupCodeForm, type GroupNameForm } from '@/schemas/adda';
import { createGroup, fetchGroups } from '@/store/addaSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

function CreateGroup() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<GroupNameForm>({
    resolver: zodResolver(groupNameSchema), defaultValues: { name: '' },
  });
  const onSubmit = async (v: GroupNameForm) => {
    const r = await dispatch(createGroup(v.name));
    if (createGroup.fulfilled.match(r)) void navigate(`/groups/${r.payload.group.id}`);
  };
  return (
    <form className="flex items-end gap-2" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex-1"><Field label={t('adda.groups.newName')} autoComplete="off" error={errors.name} {...register('name')} /></div>
      <Button type="submit" disabled={isSubmitting}>{t('adda.groups.create')}</Button>
    </form>
  );
}

function JoinGroup() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<GroupCodeForm>({
    resolver: zodResolver(groupCodeSchema), defaultValues: { code: '' },
  });
  return (
    <form className="flex items-end gap-2" noValidate
      onSubmit={handleSubmit((v) => void navigate(`/a/${groupCodeSchema.parse(v).code}`))}>
      <div className="flex-1"><Field label={t('adda.groups.joinCode')} autoComplete="off" autoCapitalize="characters" error={errors.code} {...register('code')} /></div>
      <Button type="submit" variant="outline">{t('adda.join')}</Button>
    </form>
  );
}

function GroupsBody() {
  const dispatch = useAppDispatch();
  const { groups, error } = useAppSelector((s) => s.adda);
  useEffect(() => { void dispatch(fetchGroups()); }, [dispatch]);
  return (
    <div className="flex flex-col gap-4">
      <AddaError error={error} />
      {groups === null && !error && <p className="text-center text-muted-foreground">{t('auth.loading')}</p>}
      {groups?.length === 0 && <p className="text-center text-sm text-muted-foreground">{t('adda.groups.none')}</p>}
      <ul className="flex flex-col gap-2">
        {groups?.map((g) => (
          <li key={g.id}>
            <Link to={`/groups/${g.id}`} className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3 hover:bg-accent">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{g.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t('adda.groups.members', { n: g.members, max: GROUP_MAX_MEMBERS })}
                  {g.role === 'owner' ? ` · ${t('adda.groups.owner')}` : ''}
                </span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <Card className="gap-3">
        <CardTitle>{t('adda.groups.newTitle')}</CardTitle>
        <CreateGroup />
        <JoinGroup />
      </Card>
    </div>
  );
}

/** ADDA-2 `/groups`: your groups, make one, or join by code / pasted invite link. */
export function Groups() {
  useLang();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{t('adda.groups.page')}</h2>
        <Button asChild variant="outline" size="sm"><Link to="/friends"><UserPlus className="size-4" />{t('adda.friends.page')}</Link></Button>
      </div>
      <SignInGate next="/groups"><GroupsBody /></SignInGate>
    </div>
  );
}
