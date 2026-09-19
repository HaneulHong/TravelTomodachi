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
import type { PlaceProvider, RouteProvider } from './types';

export * from './types';
export * from './region';
export * from './maps';

export function getRouteProvider(region: Region): RouteProvider {
  return region === 'KR' ? mockKoreaRouteProvider : mockGlobalRouteProvider;
}

export function getRouteProviderFor(coord?: Coord): RouteProvider {
  return getRouteProvider(resolveRegion(coord));
}

export function getPlaceProvider(_region: Region): PlaceProvider {
  // 실제로는 KR → 카카오 로컬, GLOBAL → Google Places
  return mockPlaceProvider;
}
