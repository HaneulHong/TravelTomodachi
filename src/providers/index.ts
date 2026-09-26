/**
 * 프로바이더 팩토리 — 지역에 따라 구현체를 고른다.
 *
 * 화면 코드는 여기만 호출하고, 어떤 서비스가 뒤에 있는지 모른다.
 * 국내 대중교통 API를 Tmap에서 TAGO로 바꾸더라도 이 파일 안에서 끝난다.
 */

import type { Coord, Region } from '@/domain/types';
import { resolveRegion } from './region';
import { combinedRouteProvider } from './route';
import { createCombinedPlaceProvider } from './places/combinedPlaceProvider';
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
 * 장소 검색 — 국내는 카카오, 해외는 Photon(OpenStreetMap). 둘을 같이 부르고 합친다
 * (places/combinedPlaceProvider.ts). 카카오 키가 없으면 Photon만.
 *
 * 처음에는 Photon 하나로 국내외를 덮었는데, 국내 가게·식당이 잘 안 찾혔다.
 * 지역을 입력 전에 알 수 없어서 region으로 고르지 않고 결과를 합친다.
 *
 * Google Places를 쓰지 않는 이유는 과금 SKU이기 때문이다. 자동완성은 타이핑
 * 자리라 비용이 가장 빨리 새는 곳이고, 이 앱은 무료로 굴러가야 한다.
 * 카카오 로컬은 무료다(하루 한도를 넘으면 청구가 아니라 막힌다).
 */
const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAPS_JS_KEY ?? '';
const places = createCombinedPlaceProvider(
  KAKAO_KEY.length > 0 ? createKakaoPlaceProvider(KAKAO_KEY) : null,
  createPhotonPlaceProvider(),
);

export function getPlaceProvider(_region: Region): PlaceProvider {
  return places;
}
