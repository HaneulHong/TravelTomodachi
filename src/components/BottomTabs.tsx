import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { defaultDateFor, focusTrip } from '@/domain/today';
import type { Trip } from '@/domain/types';
import { useT } from '@/i18n';
import { lastTripId, rememberTrip } from '@/store/lastTrip';
import { useTripStore } from '@/store/tripStore';
import { CalendarIcon, HomeIcon, MapIcon } from './icons';

interface Props {
  /** 일정·지도 탭이 가리킬 여행. 없으면 이번에 마지막으로 본 여행 → 지금 여행(focusTrip). */
  tripId?: string;
  /** 일정 탭이 돌아갈 날짜 */
  date?: string;
}

/** 여행 밖(홈 등)에서 탭이 열 여행 — 보던 여행이 아직 있으면 그것, 아니면 지금 여행 */
export function tabTrip(trips: readonly Trip[]): Trip | null {
  const last = lastTripId();
  return trips.find((t) => t.id === last) ?? focusTrip(trips);
}

/**
 * 스케치 하단의 홈 / 일정 / 지도 탭바.
 *
 * 일정·지도 탭은 늘 눌린다. 예전엔 여행 밖에서 두 탭이 홈을 가리켜, 멀쩡해 보이는데
 * 눌러도 아무 일이 없었다. 이제 여행 밖에서는 지금 여행으로 가고, 여행이 하나도 없으면
 * 왜 비었는지와 할 일을 알려 주는 화면(/schedule, /map — TabFallbackScreen)으로 간다.
 */
export function BottomTabs({ tripId, date }: Props) {
  const t = useT();
  const { pathname } = useLocation();
  const trips = useTripStore((s) => s.trips);

  useEffect(() => {
    if (tripId) rememberTrip(tripId);
  }, [tripId]);

  const target = tripId ? null : tabTrip(trips);
  const id = tripId ?? target?.id;
  const day = tripId ? date : target && defaultDateFor(target);
  const query = day ? `?date=${day}` : '';
  const tripPath = id ? `/trip/${id}${query}` : '/schedule';
  const mapPath = id ? `/trip/${id}/map${query}` : '/map';

  // /trip/:id는 지도(/trip/:id/map)의 앞부분이라 NavLink가 둘 다 켠다 — 지도에선 일정을 끈다
  const onMap = pathname === '/map' || /^\/trip\/[^/]+\/map$/.test(pathname);

  return (
    <nav className="tabs" aria-label={t.common.mainNav}>
      <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' tab--active' : ''}`}>
        <HomeIcon className="tab__icon" />
        {t.tabs.home}
      </NavLink>

      <NavLink
        to={tripPath}
        className={({ isActive }) => `tab${isActive && !onMap ? ' tab--active' : ''}`}
      >
        <CalendarIcon className="tab__icon" />
        {t.tabs.schedule}
      </NavLink>

      <NavLink to={mapPath} className={({ isActive }) => `tab${isActive ? ' tab--active' : ''}`}>
        <MapIcon className="tab__icon" />
        {t.tabs.map}
      </NavLink>
    </nav>
  );
}
