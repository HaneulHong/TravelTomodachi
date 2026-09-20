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
import { addMinutesToWallClock, wallClockToInstant } from '@/domain/time';
import type { Coord, Item, TransportMode } from '@/domain/types';
import { resolveLegRegion } from '@/providers';
import { fetchRoute } from '@/providers/routeCache';
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

/**
 * 이보다 긴 도보는 추천하지 않는다.
 *
 * 다른 수단 조회가 실패하면 도보만 남는데, 그대로 두면 "도보 15시간 7분"이
 * 추천으로 올라온다. 사실이긴 해도 일정으로는 쓸모가 없고, 추천이라는 말이
 * 붙는 순간 오해를 부른다. 이럴 때는 추천을 비워 '이동 정보 없음 · 탭해서
 * 입력'으로 떨어뜨리는 게 이 앱의 원래 폴백 정책과도 맞는다.
 * (값 자체는 수단 비교 칸에 그대로 보여준다 — 숨기지는 않는다.)
 */
const WALK_RECOMMEND_LIMIT_MIN = 120;

/**
 * 앞 항목이 우리를 내려준 곳.
 *
 * 구간 항목(기차·버스·배편)은 출발 터미널이 아니라 **도착 터미널**에서
 * 다음 일정이 시작된다. coord만 보면 "부산역에서 내렸는데 서울역부터 걷는"
 * 경로가 나온다.
 */
function arrivalOf(item: Item): Coord | undefined {
  return item.toCoord ?? item.coord;
}

/**
 * 이 구간을 언제 출발하는지. 앞 항목에 머무는 시간이 있으면 그만큼 더한다.
 * 시각이나 타임존을 모르면 undefined — 프로바이더가 "지금"으로 처리한다.
 */
function departureOf(from: Item, timezone?: string): string | undefined {
  if (!timezone || !from.localTime) return undefined;
  const leaveAt = from.durationMin
    ? addMinutesToWallClock(from.localTime, from.durationMin)
    : from.localTime;
  return wallClockToInstant(from.date, leaveAt, timezone);
}

function pickRecommended(results: Partial<Record<TransportMode, RouteResult>>):
  | TransportMode
  | undefined {
  let best: { mode: TransportMode; minutes: number } | undefined;
  for (const mode of MODES) {
    const r = results[mode];
    if (!r || !r.available) continue;
    if (mode === 'walk' && r.minutes > WALK_RECOMMEND_LIMIT_MIN) continue;
    // 도보 20분 이내면 도보를 선호한다 — 환승 대기까지 합치면
    // 대중교통이 명목상 빨라도 실제로는 더 번거롭다.
    const weighted = mode === 'walk' && r.minutes <= 20 ? r.minutes - 5 : r.minutes;
    if (!best || weighted < best.minutes) best = { mode, minutes: weighted };
  }
  return best?.mode;
}

export function useDayLegs(items: Item[], timezone?: string): Map<string, LegInfo> {
  const [legs, setLegs] = useState<Map<string, LegInfo>>(new Map());
  const requestId = useRef(0);

  // 좌표 쌍이 바뀔 때만 다시 조회한다
  const signature = useMemo(
    () =>
      items
        .map(
          (i) =>
            `${i.id}:${i.coord ? `${i.coord.lat},${i.coord.lng}` : '-'}` +
            `>${i.toCoord ? `${i.toCoord.lat},${i.toCoord.lng}` : '-'}` +
            `:${i.leg?.isManual ? 'm' : ''}`,
        )
        .join('|') + `#${timezone ?? ''}`,
    [items, timezone],
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
      const fromCoord = arrivalOf(from);
      const { crossBorder } = resolveLegRegion(fromCoord, to.coord);
      if (!fromCoord || !to.coord) {
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
      if (!arrivalOf(from) || !to.coord) return false;
      return !resolveLegRegion(arrivalOf(from), to.coord).crossBorder;
    });

    if (pending.length === 0) return;

    void (async () => {
      const entries = await Promise.all(
        pending.map(async ({ from, to }) => {
          const results: Partial<Record<TransportMode, RouteResult>> = {};
          await Promise.all(
            MODES.map(async (mode) => {
              results[mode] = await fetchRoute(
                arrivalOf(from)!,
                to.coord!,
                mode,
                departureOf(from, timezone),
              );
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
