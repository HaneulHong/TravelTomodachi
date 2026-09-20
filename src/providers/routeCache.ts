/**
 * 길찾기 조회 캐시.
 *
 * 훅 안에 두지 않고 꺼낸 이유: 구간 사이 이동(useDayLegs)과 터미널 구간
 * 자체(useSegmentRoutes)가 같은 좌표쌍을 물어볼 수 있다. 캐시가 둘로 나뉘면
 * 같은 요청이 두 번 나간다 — 남의 공개 서버를 쓰는 처지에 그럴 이유가 없다.
 *
 * 실제 구현에서는 이 자리가 Supabase의 routes 테이블이 된다.
 */

import type { Coord, TransportMode } from '@/domain/types';
import { getRouteProviderFor } from './index';
import type { RouteResult } from './types';

const cache = new Map<string, RouteResult>();

function cacheKey(from: Coord, to: Coord, mode: TransportMode, departAt?: string): string {
  const r = (n: number) => n.toFixed(5);
  // 출발 시각도 키에 넣는다. 같은 구간이라도 새벽과 출근길의 대중교통 결과가
  // 다르기 때문에, 시각을 빼면 먼저 조회한 시간대 결과가 하루 종일 재사용된다.
  return `${r(from.lat)},${r(from.lng)}|${r(to.lat)},${r(to.lng)}|${mode}|${departAt ?? ''}`;
}

export async function fetchRoute(
  from: Coord,
  to: Coord,
  mode: TransportMode,
  departAt?: string,
): Promise<RouteResult> {
  const key = cacheKey(from, to, mode, departAt);
  const hit = cache.get(key);
  if (hit) return hit;

  const provider = getRouteProviderFor(from);
  const result = await provider.route({ from, to, mode, departAt });
  cache.set(key, result);
  return result;
}
