/**
 * 프로바이더 팩토리 — 지역에 따라 구현체를 고른다.
 *
 * 화면 코드는 여기만 호출하고, 어떤 서비스가 뒤에 있는지 모른다.
 * 국내 대중교통 API를 Tmap에서 TAGO로 바꾸더라도 이 파일 안에서 끝난다.
 */

import type { Coord, Region } from '@/domain/types';
import { resolveRegion } from './region';
import { mockGlobalRouteProvider, mockKoreaRouteProvider } from './mock/mockRouteProvider';
import { mockPlaceProvider } from './mock/mockPlaceProvider';
import { createGooglePlaceProvider } from './places/googlePlaceProvider';
import type { PlaceProvider, RouteProvider } from './types';

export * from './types';
export * from './region';
export * from './maps';

/** 지도와 같은 키를 쓴다. Google Cloud의 키는 프로젝트 단위라 켜둔 API에 모두 통한다. */
const GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

export function getRouteProvider(region: Region): RouteProvider {
  return region === 'KR' ? mockKoreaRouteProvider : mockGlobalRouteProvider;
}

export function getRouteProviderFor(coord?: Coord): RouteProvider {
  return getRouteProvider(resolveRegion(coord));
}

/**
 * 장소 검색은 지역을 나누지 않는다.
 *
 * 길찾기와 달리 Google 장소 검색은 한국에서도 정상 동작한다(측량법 제한은
 * 지도 데이터 반출에 걸리는 것이라 검색·좌표 조회는 해당하지 않는다).
 * "경복궁", "제주시 연동 카페" 모두 한글로 잘 나온다. 굳이 국내만 카카오로
 * 갈라두면 코드 경로가 둘이 되고, 두 API의 응답 모양이 달라 버그만 는다.
 *
 * 키가 없으면 목으로 떨어진다 — 키 없이도 화면은 돌아가야 한다.
 */
const googlePlaces = GOOGLE_PLACES_KEY
  ? createGooglePlaceProvider(GOOGLE_PLACES_KEY)
  : null;

export function getPlaceProvider(_region: Region): PlaceProvider {
  return googlePlaces ?? mockPlaceProvider;
}
