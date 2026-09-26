/**
 * 프로바이더 팩토리 — 지역에 따라 구현체를 고른다.
 *
 * 화면 코드는 여기만 호출하고, 어떤 서비스가 뒤에 있는지 모른다.
 * 국내 대중교통 API를 Tmap에서 TAGO로 바꾸더라도 이 파일 안에서 끝난다.
 */

import type { Coord, Region } from '@/domain/types';
import { resolveRegion } from './region';
import { combinedRouteProvider } from './route';
import {
  createGlobalPlaceProvider,
  createKoreaPlaceProvider,
} from './places/regionPlaceProviders';
import { createKakaoPlaceProvider } from './places/kakaoPlaceProvider';
import { createPhotonPlaceProvider } from './places/photonPlaceProvider';
import type { PlaceProvider, RouteProvider } from './types';

export * from './types';
export * from './region';
export * from './maps';


/**
 * 길찾기도 지역을 나누지 않는다.
 *
 * 원래 한국을 갈라낸 이유는 Google이 국내 자동차·도보 길찾기를 제공하지 않기
 * 때문이었다. OSM 기반 라우팅은 그 제한에 걸리지 않아서 국내외를 한 프로바이더로
 * 덮는다. 분기가 사라지면 "국내에서만 나는 버그"도 사라진다.
 *
 * 수단별로 뒤에 붙는 서비스는 다르다 — route/index.ts 참고.
 */
export function getRouteProvider(_region: Region): RouteProvider {
  return combinedRouteProvider;
}

export function getRouteProviderFor(coord?: Coord): RouteProvider {
  return getRouteProvider(resolveRegion(coord));
}

/**
 * 장소 검색 — 지역별로 따로 (places/regionPlaceProviders.ts).
 * 검색 화면에서 사용자가 국내·해외를 고른다(여행 위치로 미리 골라 둔다).
 *
 *   국내 — 카카오 로컬(무료, 하루 한도를 넘으면 청구가 아니라 막힌다), 안 되면 OpenStreetMap
 *   해외 — Photon(OpenStreetMap) + 한글 이름은 Nominatim(버튼으로만)
 *
 * Google Places를 쓰지 않는 이유: 과금 SKU이고, 약관상 좌표를 30일까지만 저장할 수 있다.
 */
const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAPS_JS_KEY ?? '';
const osmPlaces = createPhotonPlaceProvider();
const regionPlaces: Record<Region, PlaceProvider> = {
  KR: createKoreaPlaceProvider(
    KAKAO_KEY.length > 0 ? createKakaoPlaceProvider(KAKAO_KEY) : null,
    osmPlaces,
  ),
  GLOBAL: createGlobalPlaceProvider(osmPlaces),
};

export function getPlaceProvider(region: Region): PlaceProvider {
  return regionPlaces[region];
}
