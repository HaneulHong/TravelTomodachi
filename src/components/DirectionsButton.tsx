/**
 * "길찾기 · 카카오맵" — 누르면 휴대폰의 지도 앱이 목적지가 찍힌 채로 열린다.
 * 어느 앱인지 버튼에 적는다 — 누르기 전에 어디로 넘어가는지 알 수 있게.
 * 주소 만들기는 providers/directions.ts.
 */

import type { MouseEvent } from 'react';
import { NavigateIcon } from '@/components/icons';
import type { TransportMode } from '@/domain/types';
import { useT } from '@/i18n';
import { platform } from '@/platform';
import { directionsApp, directionsUrl, type DirectionsTarget } from '@/providers';

interface Props {
  target: DirectionsTarget;
  /** 앞 일정에서 오는 수단 — 구글 지도에 그대로 넘긴다 */
  mode?: TransportMode;
  /** 오늘 카드처럼 작게 */
  compact?: boolean;
}

export function DirectionsButton({ target, mode, compact = false }: Props) {
  const t = useT();
  const url = directionsUrl(target, mode);
  if (!url) return null;
  const appName = directionsApp(target) === 'kakao' ? t.directions.kakao : t.directions.google;

  const open = (e: MouseEvent): void => {
    // 오늘 카드는 카드 전체가 눌리는 자리다 — 카드로 번지지 않게
    e.stopPropagation();
    platform.openExternal(url);
  };

  return (
    <button
      type="button"
      className={`directions${compact ? ' directions--compact' : ''}`}
      onClick={open}
      aria-label={t.directions.aria(appName, target.name)}
    >
      <NavigateIcon size={compact ? 13 : 15} />
      <span>{t.directions.open}</span>
      {!compact && <span className="directions__app">· {appName}</span>}
    </button>
  );
}
