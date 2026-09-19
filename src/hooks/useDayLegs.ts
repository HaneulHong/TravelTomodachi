/**
 * 그 날의 항목 사이 이동 구간을 길찾기 프로바이더로 채운다.
 *
 * 여기가 "대중교통 or 도보 중 더 나은 것" 로직이 사는 곳이고,
 * 동시에 그 로직이 null을 받았을 때를 처리하는 곳이다.
 *
 * 폴백 정책 (확정된 결정):
 *   대중교통 데이터 없음 → 도보·차량만 보여주고 수동 입력을 유도한다.
 *   거리 기반 추정값은 절대 표시하지 않는다. 틀린 숫자를 믿고 일정을
 *   짜다가 현지에서 여행이 깨지는 것보다, 모른다고 말하는 게 낫다.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Coord, Item, TransportMode } from '@/domain/types';
import { getRouteProviderFor, resolveLegRegion } from '@/providers';
import type { RouteResult } from '@/providers';

export interface LegInfo {
  /** 이 구간이 끝나는 항목의 id */
  toItemId: string;
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'manual' | 'cross_border';
  /** 수단별 조회 결과 */
  results: Partial<Record<TransportMode, RouteResult>>;
  /** 추천 수단 — 이용 가능한 것 중 가장 빠른 것 */
  recommended?: TransportMode;
  /** 대중교통 데이터가 없어서 추천에서 빠졌는지 */
  transitMissing: boolean;
}

const MODES: TransportMode[] = ['walk', 'transit', 'car'];

/** 조회 결과 캐시. 실제 구현의 routes 테이블 캐시와 같은 역할. */
const cache = new Map<string, RouteResult>();

function cacheKey(from: Coord, to: Coord, mode: TransportMode): string {
  const r = (n: number) => n.toFixed(5);
  return `${r(from.lat)},${r(from.lng)}|${r(to.lat)},${r(to.lng)}|${mode}`;
}

async function fetchLeg(from: Coord, to: Coord, mode: TransportMode): Promise<RouteResult> {
  const key = cacheKey(from, to, mode);
  const hit = cache.get(key);
  if (hit) return hit;

  const provider = getRouteProviderFor(from);
  const result = await provider.route({ from, to, mode });
  cache.set(key, result);
  return result;
}

function pickRecommended(results: Partial<Record<TransportMode, RouteResult>>):
  | TransportMode
  | undefined {
  let best: { mode: TransportMode; minutes: number } | undefined;
  for (const mode of MODES) {
    const r = results[mode];
    if (!r || !r.available) continue;
    // 도보 20분 이내면 도보를 선호한다 — 환승 대기까지 합치면
    // 대중교통이 명목상 빨라도 실제로는 더 번거롭다.
    const weighted = mode === 'walk' && r.minutes <= 20 ? r.minutes - 5 : r.minutes;
    if (!best || weighted < best.minutes) best = { mode, minutes: weighted };
  }
  return best?.mode;
}

export function useDayLegs(items: Item[]): Map<string, LegInfo> {
  const [legs, setLegs] = useState<Map<string, LegInfo>>(new Map());
  const requestId = useRef(0);

  // 좌표 쌍이 바뀔 때만 다시 조회한다
  const signature = useMemo(
    () =>
      items
        .map((i) => `${i.id}:${i.coord ? `${i.coord.lat},${i.coord.lng}` : '-'}:${i.leg?.isManual ? 'm' : ''}`)
        .join('|'),
    [items],
  );

  useEffect(() => {
    const myRequest = requestId.current + 1;
    requestId.current = myRequest;

    const pairs: { from: Item; to: Item }[] = [];
    for (let i = 1; i < items.length; i += 1) {
      const from = items[i - 1]!;
      const to = items[i]!;
      pairs.push({ from, to });
    }

    // 초기 상태를 먼저 깔아둔다 — 로딩 스켈레톤이 보이게
    const initial = new Map<string, LegInfo>();
    for (const { from, to } of pairs) {
      if (to.leg?.isManual) {
        initial.set(to.id, {
          toItemId: to.id,
          status: 'manual',
          results: {},
          recommended: to.leg.mode,
          transitMissing: false,
        });
        continue;
      }
      const { crossBorder } = resolveLegRegion(from.coord, to.coord);
      if (!from.coord || !to.coord) {
        // 항공편처럼 좌표가 없는 항목이 끼면 조회 자체를 하지 않는다
        initial.set(to.id, {
          toItemId: to.id,
          status: 'unavailable',
          results: {},
          transitMissing: false,
        });
        continue;
      }
      if (crossBorder) {
        initial.set(to.id, {
          toItemId: to.id,
          status: 'cross_border',
          results: {},
          transitMissing: false,
        });
        continue;
      }
      initial.set(to.id, {
        toItemId: to.id,
        status: 'loading',
        results: {},
        transitMissing: false,
      });
    }
    setLegs(initial);

    const pending = pairs.filter(({ from, to }) => {
      if (to.leg?.isManual) return false;
      if (!from.coord || !to.coord) return false;
      return !resolveLegRegion(from.coord, to.coord).crossBorder;
    });

    if (pending.length === 0) return;

    void (async () => {
      const entries = await Promise.all(
        pending.map(async ({ from, to }) => {
          const results: Partial<Record<TransportMode, RouteResult>> = {};
          await Promise.all(
            MODES.map(async (mode) => {
              results[mode] = await fetchLeg(from.coord!, to.coord!, mode);
            }),
          );
          const transitResult = results.transit;
          const transitMissing =
            !!transitResult && !transitResult.available && transitResult.reason === 'no_transit_data';
          const recommended = pickRecommended(results);
          const info: LegInfo = {
            toItemId: to.id,
            status: recommended ? 'ready' : 'unavailable',
            results,
            recommended,
            transitMissing,
          };
          return info;
        }),
      );

      // 늦게 도착한 옛 요청은 버린다
      if (requestId.current !== myRequest) return;

      setLegs((prev) => {
        const next = new Map(prev);
        for (const info of entries) next.set(info.toItemId, info);
        return next;
      });
    })();
    // signature가 좌표·수동여부 변화를 모두 담고 있다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return legs;
}
