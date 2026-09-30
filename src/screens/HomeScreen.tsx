import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomTabs } from '@/components/BottomTabs';
import { StartCard } from '@/components/StartCard';
import { TodayCard } from '@/components/TodayCard';
import { defaultDateFor, findToday, splitTrips } from '@/domain/today';
import { GlobeIcon, PlusIcon } from '@/components/icons';
import { daysUntil, formatDateLabel, tripLengthDays } from '@/domain/time';
import { useLocale, useT, type Messages } from '@/i18n';
import { resolveRegion } from '@/providers';
import { useTripStore } from '@/store/tripStore';
import type { Trip } from '@/domain/types';

type Coord = { tripId: string; lat: number; lng: number };

/** 여행이 지나는 지역들 — 국내/해외 뱃지에 쓴다 */
function tripRegions(trip: Trip, coords: Coord[]) {
  const set = new Set(
    coords
      .filter((c) => c.tripId === trip.id)
      .map((c) => resolveRegion({ lat: c.lat, lng: c.lng })),
  );
  return [...set];
}

function countdownLabel(trip: Trip, t: Messages): string {
  const d = daysUntil(trip.startDate);
  if (d > 0) return t.home.dday(d);
  if (d === 0) return t.home.departsToday;
  return daysUntil(trip.endDate) >= 0 ? t.home.ongoing : t.home.past;
}

interface CardProps {
  trip: Trip;
  coords: Coord[];
  /** 다가오는 여행 중 맨 앞 — 크게, D-day를 옆에 크게 */
  hero?: boolean;
  itemCount: number;
}

function TripCard({ trip, coords, hero = false, itemCount }: CardProps) {
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();
  const regions = tripRegions(trip, coords);
  const dayCount = tripLengthDays(trip.startDate, trip.endDate);
  const countdown = countdownLabel(trip, t);

  return (
    <button
      className={`trip-card${hero ? ' trip-card--hero' : ''}`}
      onClick={() => navigate(`/trip/${trip.id}?date=${defaultDateFor(trip)}`)}
    >
      <div className="trip-card__top">
        <span className="trip-card__emoji" aria-hidden>
          {trip.coverEmoji}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* 이름 옆에 두면 좁은 폰(320px)에서 이름이 한 줄에 몇 글자밖에 안 남는다 — 위로 */}
          {hero && <span className="trip-card__countdown">{countdown}</span>}
          <h3 className="trip-card__name">{trip.name}</h3>
          <div className="trip-card__dates">
            {formatDateLabel(trip.startDate, locale)} —{' '}
            {formatDateLabel(trip.endDate, locale)} · {t.home.dayCount(dayCount)}
          </div>
          {hero && (
            <div className="trip-card__stats">{t.home.stats(itemCount, trip.members.length)}</div>
          )}
        </div>
      </div>

      <div className="trip-card__bottom">
        <div className="avatars">
          {trip.members.slice(0, 4).map((m) => (
            <span key={m.id} className="avatar" style={{ background: m.color }} title={m.name}>
              {m.initial}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {regions.length > 1 ? (
            <span className="chip">
              <GlobeIcon size={12} />
              {t.home.bothRegions}
            </span>
          ) : (
            regions.map((r) => (
              <span key={r} className="chip">
                {t.region[r]}
              </span>
            ))
          )}
          {!hero && <span className="chip chip--accent">{countdown}</span>}
        </div>
      </div>
    </button>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const trips = useTripStore((s) => s.trips);
  const items = useTripStore((s) => s.items);
  const loading = useTripStore((s) => s.loading);
  const t = useT();

  const coords = useMemo(
    () =>
      items
        .filter((i) => i.coord)
        .map((i) => ({ tripId: i.tripId, lat: i.coord!.lat, lng: i.coord!.lng })),
    [items],
  );
  const itemCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.tripId, (m.get(i.tripId) ?? 0) + 1);
    return m;
  }, [items]);
  const { upcoming, past } = useMemo(() => splitTrips(trips), [trips]);
  /*
   * 맨 앞 다가오는 여행을 크게. 여행 중이면 위의 오늘 카드가 그 역할을 하므로
   * 같은 여행을 두 번 크게 보여주지 않는다.
   */
  const heroId = findToday(trips) ? null : upcoming[0]?.id;

  const card = (trip: Trip, hero = false) => (
    <TripCard
      key={trip.id}
      trip={trip}
      coords={coords}
      hero={hero}
      itemCount={itemCounts.get(trip.id) ?? 0}
    />
  );

  return (
    <div className="app">
      <AppHeader title={t.home.title} onProfile={() => navigate('/profile')} />

      <main className="main">
        {/* 여행 중일 때만 그려진다 */}
        <div className="section today-section">
          <TodayCard />
        </div>

        {trips.length === 0 ? (
          <section className="section">
            {/* 목록을 받기 전에 "여행이 없다"고 하면 이미 여행이 있는 사람이 놀란다 */}
            {loading ? (
              <p className="empty">{t.common.loading}</p>
            ) : (
              <StartCard title={t.start.title} body={t.start.body} steps />
            )}
          </section>
        ) : (
          <>
            <section className="section">
              {upcoming.length > 0 && <h2 className="section__title">{t.home.upcoming}</h2>}
              {upcoming.map((trip) => card(trip, trip.id === heroId))}

              {/*
                점선으로 둔 이유는 일정 추가 버튼과 같다 — 이건 여행 카드가 아니라
                빈자리다. 실선 카드로 만들면 마지막 여행처럼 읽힌다.
              */}
              <button className="tl-add trip-add" onClick={() => navigate('/trip/new')}>
                <PlusIcon size={16} /> {t.home.newTrip}
              </button>

              {/*
                링크를 못 받고 코드만 전해 들은 경우(전화, 메신저 캡처 등)를 위한 길.
                링크로 오면 이 화면을 거치지 않는다.
              */}
              <button className="btn btn--ghost trip-join" onClick={() => navigate('/invite')}>
                {t.home.joinByCode}
              </button>
            </section>

            {/*
              지난 여행은 접어 둔다 — 다가오는 여행이 아래로 밀리지 않게.
              다가오는 여행이 없으면 펼쳐 둔다(접힌 줄 하나만 남으면 목록이 빈 것처럼 보인다).
            */}
            {past.length > 0 && (
              <section className="section past-trips-section">
                <details className="past-trips" open={upcoming.length === 0}>
                  <summary className="section__title past-trips__summary">
                    {t.home.pastTrips(past.length)}
                  </summary>
                  {past.map((trip) => card(trip))}
                </details>
              </section>
            )}
          </>
        )}
      </main>

      <BottomTabs />
    </div>
  );
}
