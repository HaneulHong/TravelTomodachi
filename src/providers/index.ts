/**
 * 프로바이더 팩토리 — 지역에 따라 구현체를 고른다.
 *
 * 화면 코드는 여기만 호출하고, 어떤 서비스가 뒤에 있는지 모른다.
 * 국내 대중교통 API를 Tmap에서 TAGO로 바꾸더라도 이 파일 안에서 끝난다.
 */

import type { Coord, Region } from '@/domain/types';
import { resolveRegion } from './region';
import { valhallaRouteProvider } from './route/valhallaRouteProvider';
import { createPhotonPlaceProvider } from './places/photonPlaceProvider';
import type { PlaceProvider, RouteProvider } from './types';

export * from './types';
export * from './region';
export * from './maps';


/**
 * 길찾기도 지역을 나누지 않는다.
 *
 * 원래 한국을 갈라낸 이유는 Google이 국내 자동차·도보 길찾기를 제공하지 않기
 * 때문이었다. OSM 기반 라우팅(Valhalla)은 그 제한에 걸리지 않아서 국내외를
 * 한 프로바이더로 덮는다. 분기가 사라지면 "국내에서만 나는 버그"도 사라진다.
 */
export function getRouteProvider(_region: Region): RouteProvider {
  return valhallaRouteProvider;
}

export function getRouteProviderFor(coord?: Coord): RouteProvider {
  return getRouteProvider(resolveRegion(coord));
}

/**
 * 장소 검색은 지역을 나누지 않는다.
 *
 * Photon(OpenStreetMap)은 전 세계를 한 엔드포인트로 덮고 키도 필요 없다.
 * 국내만 카카오로 갈라두면 코드 경로가 둘이 되고 응답 모양이 달라 버그만 는다.
 *
 * Google Places를 쓰지 않는 이유는 과금 SKU이기 때문이다. 자동완성은 타이핑
 * 자리라 비용이 가장 빨리 새는 곳이고, 이 앱은 무료로 굴러가야 한다.
 */
const osmPlaces = createPhotonPlaceProvider();

export function getPlaceProvider(_region: Region): PlaceProvider {
  return osmPlaces;
}
