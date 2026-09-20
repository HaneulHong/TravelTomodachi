import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomTabs } from '@/components/BottomTabs';
import { GlobeIcon } from '@/components/icons';
import { daysUntil, formatDateLabel, tripLengthDays } from '@/domain/time';
import { REGION_LABEL, resolveRegion } from '@/providers';
import { useAuthStore } from '@/store/authStore';
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

function countdownLabel(startDate: string): string {
  const d = daysUntil(startDate);
  if (d > 0) return `D-${d}`;
  if (d === 0) return '오늘 출발';
  return '진행 중 · 지난 여행';
}

export function HomeScreen() {
  const account = useAuthStore((a) => a.account);
  const navigate = useNavigate();
  const trips = useTripStore((s) => s.trips);
  const items = useTripStore((s) => s.items);

  const coords = items
    .filter((i) => i.coord)
    .map((i) => ({ tripId: i.tripId, lat: i.coord!.lat, lng: i.coord!.lng }));

  return (
    <div className="app">
      <AppHeader
        title="홈"
        action={{ label: account?.initial ?? '?', onClick: () => navigate('/profile') }}
      />

      <main className="main">
        <section className="section">
          <h2 className="section__title">일정 리스트</h2>

          {trips.length === 0 && <p className="empty">아직 여행이 없습니다.</p>}

          {trips.map((trip) => {
            const regions = tripRegions(trip, coords);
            const dayCount = tripLengthDays(trip.startDate, trip.endDate);
            return (
              <button
                key={trip.id}
                className="trip-card"
                onClick={() => navigate(`/trip/${trip.id}?date=${trip.startDate}`)}
              >
                <div className="trip-card__top">
                  <span className="trip-card__emoji" aria-hidden>
                    {trip.coverEmoji}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 className="trip-card__name">{trip.name}</h3>
                    <div className="trip-card__dates">
                      {formatDateLabel(trip.startDate)} — {formatDateLabel(trip.endDate)} ·{' '}
                      {dayCount}일
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
                        국내 + 해외
                      </span>
                    ) : (
                      regions.map((r) => (
                        <span key={r} className="chip">
                          {REGION_LABEL[r]}
                        </span>
                      ))
                    )}
                    <span className="chip chip--accent">{countdownLabel(trip.startDate)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      </main>

      <BottomTabs />
    </div>
  );
}
