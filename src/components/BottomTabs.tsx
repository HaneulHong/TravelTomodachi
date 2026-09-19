import { NavLink } from 'react-router-dom';
import { CalendarIcon, HomeIcon, MapIcon } from './icons';

interface Props {
  /** 일정·지도 탭이 가리킬 여행. 없으면 두 탭은 비활성. */
  tripId?: string;
  /** 일정 탭이 돌아갈 날짜 */
  date?: string;
}

/** 스케치 하단의 홈 / 일정 / 지도 탭바 */
export function BottomTabs({ tripId, date }: Props) {
  const tripPath = tripId
    ? `/trip/${tripId}${date ? `?date=${date}` : ''}`
    : '/';
  const mapPath = tripId ? `/trip/${tripId}/map${date ? `?date=${date}` : ''}` : '/';

  return (
    <nav className="tabs" aria-label="주요 화면">
      <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' tab--active' : ''}`}>
        <HomeIcon className="tab__icon" />
        홈
      </NavLink>

      <NavLink
        to={tripPath}
        className={({ isActive }) =>
          `tab${isActive && tripId ? ' tab--active' : ''}`
        }
        aria-disabled={!tripId}
      >
        <CalendarIcon className="tab__icon" />
        일정
      </NavLink>

      <NavLink
        to={mapPath}
        className={({ isActive }) => `tab${isActive && tripId ? ' tab--active' : ''}`}
        aria-disabled={!tripId}
      >
        <MapIcon className="tab__icon" />
        지도
      </NavLink>
    </nav>
  );
}
