/**
 * "길찾기" — 휴대폰의 지도 앱으로 목적지를 넘긴다.
 *
 * 길 안내를 앱 안에 만들지 않는 이유: 현지에서 실제로 쓰는 건 카카오맵·구글 지도의
 * 실시간 경로(환승·출구·도보)다. 우리는 목적지를 정확히 찍어서 넘기기만 한다.
 *
 *   국내 — 카카오맵. 구글은 국내 도보·자동차 길찾기를 하지 않는다.
 *   해외 — 구글 지도. 공식 "Maps URLs"라 키도 요금도 없다.
 *          https://developers.google.com/maps/documentation/urls/get-started
 *
 * 둘 다 https 주소다. 폰에 앱이 있으면 앱이 열리고, 없으면 웹 지도가 열린다.
 * 출발지는 넣지 않는다 — 두 앱 모두 비워 두면 "내 위치"에서 출발한다.
 */

import type { Coord, TransportMode } from '@/domain/types';
import { isInKorea } from './region';

export type DirectionsApp = 'kakao' | 'google';

export interface DirectionsTarget {
  /** 장소 이름(없으면 일정 제목) — 좌표가 없을 때는 이걸로 검색한다 */
  name: string;
  coord?: Coord;
}

const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** 어느 앱으로 열지. 좌표가 없으면 이름 글자로 짐작한다(한글이면 국내일 가능성이 크다). */
export function directionsApp(target: DirectionsTarget): DirectionsApp {
  if (target.coord) return isInKorea(target.coord) ? 'kakao' : 'google';
  return HANGUL.test(target.name) ? 'kakao' : 'google';
}

const GOOGLE_MODE: Record<TransportMode, string> = {
  walk: 'walking',
  transit: 'transit',
  car: 'driving',
};

/**
 * 길찾기 주소. 이름도 좌표도 없으면 null.
 * mode는 구글에만 들어간다(카카오 공유 주소는 수단을 받지 않는다 — 앱에서 고른다).
 */
export function directionsUrl(
  target: DirectionsTarget,
  mode: TransportMode = 'transit',
  app: DirectionsApp = directionsApp(target),
): string | null {
  const name = target.name.trim();
  const c = target.coord;
  if (!c && name.length === 0) return null;

  if (app === 'kakao') {
    // /link/to/이름,위도,경도 — 이름 안의 쉼표는 구분자와 헷갈리니 뺀다
    if (c) {
      const label = encodeURIComponent((name || '목적지').replace(/,/g, ' '));
      return `https://map.kakao.com/link/to/${label},${c.lat},${c.lng}`;
    }
    return `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;
  }

  const params = new URLSearchParams({
    api: '1',
    destination: c ? `${c.lat},${c.lng}` : name,
    travelmode: GOOGLE_MODE[mode],
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
