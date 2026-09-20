/**
 * 길찾기 프로바이더 합성.
 *
 * 수단마다 잘하는 서비스가 다르다. 둘 다 무료이고 키가 없으며 전 세계를
 * 덮는다는 점은 같다.
 *
 *   도보·차량   Valhalla     도로 그래프 기반. 한국에서도 된다.
 *   대중교통    Transitous   전 세계 GTFS 통합. 피드 없는 도시는 '정보 없음'.
 *
 * 화면은 이 하나만 보고, 뒤에 서비스가 둘이라는 걸 모른다. 나중에 한쪽을
 * 자체 호스팅으로 옮겨도 여기만 고치면 된다.
 */

import type { RouteProvider, RouteQuery, RouteResult } from '../types';
import { transitousRouteProvider } from './transitousRouteProvider';
import { valhallaRouteProvider } from './valhallaRouteProvider';

export { transitousRouteProvider } from './transitousRouteProvider';
export { valhallaRouteProvider } from './valhallaRouteProvider';

export const combinedRouteProvider: RouteProvider = {
  id: 'osm-combined',
  label: 'OpenStreetMap 길찾기',
  modes: ['walk', 'car', 'transit'],

  route(query: RouteQuery): Promise<RouteResult> {
    return query.mode === 'transit'
      ? transitousRouteProvider.route(query)
      : valhallaRouteProvider.route(query);
  },
};
