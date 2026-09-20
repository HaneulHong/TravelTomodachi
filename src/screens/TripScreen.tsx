import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomTabs } from '@/components/BottomTabs';
import { DateStrip } from '@/components/DateStrip';
import { MenuSheet } from '@/components/MenuSheet';
import { TransportChip } from '@/components/TransportChip';
import { AlertIcon, ClockIcon, ListIcon, PinIcon, PlaneIcon, PlusIcon, ShareIcon, TrainIcon } from '@/components/icons';
import { useDayLegs, type LegInfo } from '@/hooks/useDayLegs';
import { useSwipe } from '@/hooks/useSwipe';
import {
  formatDateLabel,
  formatMinutes,
  formatOffsetDelta,
  timezoneShift,
  tzShortLabel,
} from '@/domain/time';
import type { Item } from '@/domain/types';
import { platform } from '@/platform';
import { useTripStore } from '@/store/tripStore';

function KindIcon({ kind }: { kind: Item['kind'] }) {
  if (kind === 'flight') return <PlaneIcon />;
  if (kind === 'train') return <TrainIcon />;
  return null;
}

/** 구간 한 줄. 상태별로 다르게 보여준다 — 특히 '모름'을 숨기지 않는다. */
function LegRow({ info }: { info?: LegInfo }) {
  return (
    <div className="tl-leg">
      <div className="tl-leg__rail">
        <div className="tl-leg__line" />
      </div>
      <div className="tl-leg__body">
        {!info && null}

        {info?.status === 'loading' && <span className="tl-leg__skel" />}

        {info?.status === 'manual' && info.recommended && (
          <TransportChip mode={info.recommended} manual />
        )}

        {info?.status === 'ready' && info.recommended && (
          <>
            <TransportChip
              mode={info.recommended}
              minutes={
                info.results[info.recommended]?.available
                  ? (info.results[info.recommended] as { minutes: number }).minutes
                  : undefined
              }
            />
            {info.transitMissing && (
              <span className="chip chip--warn">
                <AlertIcon size={11} />
                대중교통 정보 없음
              </span>
            )}
          </>
        )}

        {info?.status === 'cross_border' && (
          <span className="chip chip--warn">
            <AlertIcon size={11} />
            국제 구간 · 직접 입력
          </span>
        )}

        {info?.status === 'unavailable' && (
          <span className="chip">이동 정보 없음 · 탭해서 입력</span>
        )}
      </div>
    </div>
  );
}

export function TripScreen() {
  const { tripId = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const trip = useTripStore((s) => s.getTrip(tripId));
  const allItems = useTripStore((s) => s.items);

  const activeDate = search.get('date') ?? trip?.startDate ?? '';
  const dayIndex = trip?.days.findIndex((d) => d.date === activeDate) ?? -1;
  const day = dayIndex >= 0 ? trip?.days[dayIndex] : undefined;
  const prevDay = dayIndex > 0 ? trip?.days[dayIndex - 1] : undefined;

  const items = useMemo(
    () =>
      allItems
        .filter((i) => i.tripId === tripId && i.date === activeDate)
        .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0)),
    [allItems, tripId, activeDate],
  );

  const legs = useDayLegs(items, day?.timezone);

  function goToDay(offset: number) {
    if (!trip || dayIndex < 0) return;
    const next = trip.days[dayIndex + offset];
    if (!next) return;
    setSearch({ date: next.date }, { replace: true });
    platform.vibrate(8);
  }

  // 스케치의 "슬라이드 시 해당 일정의 날짜 변동"
  const swipe = useSwipe({
    onSwipeLeft: () => goToDay(1),
    onSwipeRight: () => goToDay(-1),
  });

  async function onShare() {
    if (!trip) return;
    setMenuOpen(false);
    const result = await platform.share({
      title: trip.name,
      text: `${trip.name} 일정을 함께 봐요`,
      url: `${platform.publicBaseUrl}/#/invite/${trip.inviteCode}`,
    });
    if (result === 'copied') setToast('초대 링크를 복사했습니다');
    else if (result === 'unavailable') setToast(`초대 코드: ${trip.inviteCode}`);
    setTimeout(() => setToast(null), 2400);
  }

  if (!trip || !day) {
    return (
      <div className="app">
        <AppHeader title="일정" back />
        <main className="main">
          <p className="empty">여행을 찾을 수 없습니다.</p>
        </main>
        <BottomTabs />
      </div>
    );
  }

  const shift = timezoneShift(prevDay, day);

  return (
    <div className="app">
      <AppHeader title={trip.name} back onMenu={() => setMenuOpen(true)} />

      <DateStrip
        days={trip.days}
        activeDate={activeDate}
        onSelect={(date) => setSearch({ date }, { replace: true })}
      />

      {/* 가로 스와이프로 날짜 전환. 세로 스크롤은 그대로 동작한다. */}
      <main className="main" {...swipe} style={{ touchAction: 'pan-y' }}>
        <div className="dayhead">
          <div className="dayhead__row">
            <h2 className="dayhead__city">{day.cityLabel}</h2>
            <span className="chip">{tzShortLabel(day.timezone, day.date)}</span>
          </div>
          <div className="dayhead__date">
            {dayIndex + 1}일차 · {formatDateLabel(day.date)}
          </div>
        </div>

        {/* 타임존이 바뀌는 날 경고. 전세계 여행에서 제일 조용히 터지는 부분. */}
        {shift.changed && (
          <div className="section" style={{ paddingTop: 10, paddingBottom: 0 }}>
            <div className="banner">
              <AlertIcon className="banner__icon" />
              <div>
                어제와 시차가 <strong>{formatOffsetDelta(shift.deltaMinutes)}</strong> 있습니다.
                아래 시간은 모두 <strong>{day.cityLabel} 현지 시각</strong>입니다.
              </div>
            </div>
          </div>
        )}

        <div className="timeline">
          {items.length === 0 && <p className="empty">이 날은 아직 비어 있습니다.</p>}

          {items.map((item, i) => (
            <div key={item.id}>
              {i > 0 && <LegRow info={legs.get(item.id)} />}

              <div className="tl-row">
                <div className="tl-time">
                  {item.localTime ?? '—'}
                  {item.durationMin !== undefined && (
                    <span className="tl-time__dur">{formatMinutes(item.durationMin)}</span>
                  )}
                </div>

                <button
                  className="tl-item"
                  onClick={() => navigate(`/trip/${trip.id}/item/${item.id}`)}
                >
                  <div className="tl-item__head">
                    <span className="tl-item__title">{item.title}</span>
                    {item.kind !== 'place' && (
                      <span className={`chip chip--${item.kind === 'flight' ? 'transit' : 'car'}`}>
                        <KindIcon kind={item.kind} />
                        {item.carrierCode ?? (item.kind === 'flight' ? '항공' : '기차')}
                      </span>
                    )}
                  </div>

                  {item.placeName && (
                    <div className="tl-item__place">
                      {item.kind === 'place' ? <PinIcon /> : <ClockIcon />}
                      {item.placeName}
                    </div>
                  )}

                  {item.description && <div className="tl-item__desc">{item.description}</div>}
                </button>
              </div>
            </div>
          ))}

          {/*
            추가 버튼을 목록 끝에 둔다. 띄우는 버튼(FAB)은 마지막 항목을 가려서,
            일정이 꽉 찬 날일수록 방해가 된다.
          */}
          <button
            className="tl-add"
            onClick={() => navigate(`/trip/${trip.id}/item/new?date=${activeDate}`)}
          >
            <PlusIcon size={16} /> 일정 추가
          </button>
        </div>
      </main>

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <button
          className="sheet__item"
          onClick={() => {
            setMenuOpen(false);
            navigate(`/trip/${trip.id}/checklist`);
          }}
        >
          <ListIcon />
          체크리스트
        </button>
        <button className="sheet__item" onClick={onShare}>
          <ShareIcon />
          친구에게 공유
        </button>
      </MenuSheet>

      {toast && <div className="toast">{toast}</div>}

      <BottomTabs tripId={trip.id} date={activeDate} />
    </div>
  );
}
