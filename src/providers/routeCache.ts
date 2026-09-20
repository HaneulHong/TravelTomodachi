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

/**
 * 동시에 나가는 요청 수.
 *
 * 날짜를 한 번 넘기면 (수단 3개 × 구간 수)만큼의 조회가 생긴다. 하루에 지점이
 * 다섯이면 12건이 한꺼번에 튀어나가고, 거기에 터미널 구간 조회까지 겹친다.
 * 공개 인스턴스는 그 정도 버스트에 스로틀링으로 답하는데, 브라우저에는 그게
 * CORS 오류로 보인다(차단 응답에는 CORS 헤더가 없기 때문). 실제로 그렇게
 * 막혀서 길찾기가 통째로 '정보 없음'이 된 적이 있다.
 *
 * 3으로 둔 이유: 한 구간의 세 수단이 나란히 나가 화면이 순차로 채워지는 속도는
 * 유지하면서, 버스트는 사라진다.
 */
const MAX_CONCURRENT = 3;

let running = 0;
const waiting: (() => void)[] = [];

/** 자리가 날 때까지 기다린다. 반환값은 자리를 돌려주는 함수. */
async function acquireSlot(): Promise<() => void> {
  if (running >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  running += 1;

  let released = false;
  return () => {
    // 두 번 돌려주면 자리 수가 늘어나 제한이 무의미해진다
    if (released) return;
    released = true;
    running -= 1;
    waiting.shift()?.();
  };
}

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

  const release = await acquireSlot();
  try {
    const provider = getRouteProviderFor(from);
    const result = await provider.route({ from, to, mode, departAt });
    cache.set(key, result);
    return result;
  } finally {
    release();
  }
}
