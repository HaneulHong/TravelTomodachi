/**
 * 변경 기록 — "민수님이 3일차 「점심」 일정을 고쳤어요".
 *
 * 같이 짜다 보면 "이거 누가 바꿨어?", "점심 일정 어디 갔어?"가 나온다. 일정의
 * "마지막으로 고친 사람"(EditedBy)은 하나뿐이고 지운 일정은 흔적이 없어서 따로 둔다.
 * 기록은 DB 트리거가 쓴다(supabase/activity.sql) — 여기는 읽어서 보여 주기만.
 *
 * 누르면 그 일정·가계부·후보로 간다. 지워진 일정은 갈 곳이 없어 글만.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { isNetworkError } from '@/data/offlineCache';
import { formatDateLabel } from '@/domain/time';
import { memberLabel, type Activity, type Member } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import { useTripStore } from '@/store/tripStore';

type State =
  | { status: 'loading' }
  | { status: 'ready'; list: Activity[] }
  | { status: 'missing' }
  | { status: 'error'; message: string };

/** 기기 시간대 기준 날짜 'YYYY-MM-DD' — 오늘·어제로 묶는다 */
function localDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ActivityScreen() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();
  const trip = useTripStore((s) => s.getTrip(tripId));
  const me = useTripStore((s) => s.currentUserId);
  const items = useTripStore((s) => s.items);
  const loadActivity = useTripStore((s) => s.loadActivity);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    loadActivity(tripId)
      .then((list) => {
        if (alive) setState(list ? { status: 'ready', list } : { status: 'missing' });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setState({
          status: 'error',
          message: isNetworkError(err)
            ? t.activity.offline
            : err instanceof Error
              ? err.message
              : t.common.failed,
        });
      });
    return () => {
      alive = false;
    };
  }, [tripId, loadActivity, t]);

  const members = trip?.members ?? [];
  const memberOf = (id?: string): Member => {
    const m = id ? members.find((x) => x.id === id) : undefined;
    return m ?? { id: id ?? '', name: t.edited.leftMember, initial: '?', color: '#9a9488' };
  };
  const dayNumber = (date?: string): number | null => {
    if (!date || !trip) return null;
    const i = trip.days.findIndex((d) => d.date === date);
    return i >= 0 ? i + 1 : null;
  };
  const timeFmt = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  /** 누를 곳 — 지금도 있는 일정이면 상세, 지출은 가계부, 후보는 후보 목록 */
  const destination = (a: Activity): string | null => {
    if (a.target === 'item') {
      return a.targetId && items.some((i) => i.id === a.targetId)
        ? `/trip/${tripId}/item/${a.targetId}`
        : null;
    }
    if (a.action === 'delete') return null;
    return a.target === 'expense' ? `/trip/${tripId}/expenses` : `/trip/${tripId}/ideas`;
  };

  const today = localDate(new Date().toISOString());
  const yesterday = localDate(new Date(Date.now() - 86_400_000).toISOString());
  const heading = (date: string): string =>
    date === today ? t.activity.today : date === yesterday ? t.activity.yesterday : formatDateLabel(date, locale);

  return (
    <div className="app">
      <AppHeader title={t.activity.title} back />
      <main className="main main--no-tabs">
        {state.status === 'loading' && <p className="empty">{t.common.loading}</p>}
        {state.status === 'missing' && <p className="empty">{t.activity.needsDb}</p>}
        {state.status === 'error' && <p className="empty">{state.message}</p>}
        {state.status === 'ready' && state.list.length === 0 && (
          <p className="empty">{t.activity.empty}</p>
        )}
        {state.status === 'ready' && state.list.length > 0 && (
          <ol className="activity">
            {state.list.map((a, i) => {
              const date = localDate(a.createdAt);
              const newGroup = i === 0 || localDate(state.list[i - 1]!.createdAt) !== date;
              const member = memberOf(a.actorId);
              const who = a.actorId === me ? null : memberLabel(member, members);
              const to = destination(a);
              const body = (
                <>
                  <span className="avatar avatar--sm" style={{ background: member.color }}>
                    {member.initial}
                  </span>
                  <span className="activity__text">
                    {t.activity.line(who, a.target, a.action, a.title ?? '', dayNumber(a.date))}
                    <span className="activity__time">{timeFmt.format(new Date(a.createdAt))}</span>
                  </span>
                </>
              );
              return (
                <li key={a.id}>
                  {newGroup && <h2 className="activity__day">{heading(date)}</h2>}
                  {to ? (
                    <button type="button" className="activity__row" onClick={() => navigate(to)}>
                      {body}
                    </button>
                  ) : (
                    <div className="activity__row activity__row--static">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
