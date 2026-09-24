import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomTabs } from '@/components/BottomTabs';
import { TodayCard } from '@/components/TodayCard';
import { defaultDateFor } from '@/domain/today';
import { GlobeIcon, PlusIcon } from '@/components/icons';
import { daysUntil, formatDateLabel, tripLengthDays } from '@/domain/time';
import { useLocale, useT, type Messages } from '@/i18n';
import { resolveRegion } from '@/providers';
import { useTripStore } from '@/store/tripStore';
import type { Trip } from '@/domain/types';

/** 여행이 지나는 지역들 — 국내/해외 뱃지에 쓴다 */
function tripRegions(trip: Trip, coords: { tripId: string; lat: number; lng: number }[]) {
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

export function HomeScreen() {
  const navigate = useNavigate();
  const trips = useTripStore((s) => s.trips);
  const items = useTripStore((s) => s.items);
  const t = useT();
  const locale = useLocale();

  const coords = items
    .filter((i) => i.coord)
    .map((i) => ({ tripId: i.tripId, lat: i.coord!.lat, lng: i.coord!.lng }));

  return (
    <div className="app">
      <AppHeader
        title={t.home.title}
        onProfile={() => navigate('/profile')}
      />

      <main className="main">
        {/* 여행 중일 때만 그려진다 */}
        <div className="section today-section">
          <TodayCard />
        </div>

        <section className="section">
          <h2 className="section__title">{t.home.list}</h2>

          {trips.length === 0 && (
            <p className="empty">{t.home.empty}</p>
          )}

          {trips.map((trip) => {
            const regions = tripRegions(trip, coords);
            const dayCount = tripLengthDays(trip.startDate, trip.endDate);
            return (
              <button
                key={trip.id}
                className="trip-card"
                onClick={() => navigate(`/trip/${trip.id}?date=${defaultDateFor(trip)}`)}
              >
                <div className="trip-card__top">
                  <span className="trip-card__emoji" aria-hidden>
                    {trip.coverEmoji}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 className="trip-card__name">{trip.name}</h3>
                    <div className="trip-card__dates">
                      {formatDateLabel(trip.startDate, locale)} —{' '}
                      {formatDateLabel(trip.endDate, locale)} · {t.home.dayCount(dayCount)}
                    </div>
                  </div>
                </div>

                <div className="trip-card__bottom">
                  <div className="avatars">
                    {trip.members.slice(0, 4).map((m) => (
                      <span
                        key={m.id}
                        className="avatar"
                        style={{ background: m.color }}
                        title={m.name}
                      >
                        {m.initial}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                    <span className="chip chip--accent">{countdownLabel(trip, t)}</span>
                  </div>
                </div>
              </button>
            );
          })}

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
      </main>

      <BottomTabs />
    </div>
  );
}
