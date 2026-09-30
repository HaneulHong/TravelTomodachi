/**
 * 여행 밖에서 일정·지도 탭을 눌렀을 때 (/schedule, /map).
 *
 * 볼 여행이 있으면 그 여행으로 바로 넘긴다(BottomTabs의 tabTrip — 보던 여행 → 지금 여행).
 * 탭은 대개 여행 주소를 직접 가리키므로 여기 오는 건 여행이 없거나, 여행 목록을 받기 전에
 * 누른 경우다. 여행이 없으면 탭을 막는 대신 왜 비었는지와 할 일을 보여준다.
 */

import { Navigate, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { BottomTabs, tabTrip } from '@/components/BottomTabs';
import { StartCard } from '@/components/StartCard';
import { defaultDateFor } from '@/domain/today';
import { useT } from '@/i18n';
import { useTripStore } from '@/store/tripStore';

export function TabFallbackScreen({ kind }: { kind: 'schedule' | 'map' }) {
  const t = useT();
  const navigate = useNavigate();
  const trips = useTripStore((s) => s.trips);
  const loading = useTripStore((s) => s.loading);

  const trip = tabTrip(trips);
  if (trip) {
    const query = `?date=${defaultDateFor(trip)}`;
    const to = kind === 'map' ? `/trip/${trip.id}/map${query}` : `/trip/${trip.id}${query}`;
    return <Navigate to={to} replace />;
  }

  return (
    <div className="app">
      <AppHeader
        title={kind === 'map' ? t.map.title : t.trip.title}
        onHelp={() => navigate('/guide')}
      />
      <main className="main">
        {loading ? (
          <p className="empty">{t.common.loading}</p>
        ) : (
          <div className="section">
            <StartCard
              title={t.start.noTrip}
              body={kind === 'map' ? t.start.mapBody : t.start.scheduleBody}
            />
          </div>
        )}
      </main>
      <BottomTabs />
    </div>
  );
}
