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
import { effectiveLeg, recommendMode, type ModeMinutes } from '@/domain/legChoice';
import { addMinutesToWallClock, wallClockToInstant } from '@/domain/time';
import type { Coord, Item, TransportMode } from '@/domain/types';
import { resolveLegRegion } from '@/providers';
import { fetchRoute } from '@/providers/routeCache';
import type { RouteResult } from '@/providers';

export interface LegInfo {
  /** 이 구간이 끝나는 항목의 id */
  toItemId: string;
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'manual' | 'cross_border';
  /** 수단별 조회 결과 — 직접 입력한 구간도 비교용으로 조회한다 */
  results: Partial<Record<TransportMode, RouteResult>>;
  /** 조회 결과만 보고 고른 추천 수단 */
  recommended?: TransportMode;
  /** 화면에 보일 수단 — 사용자가 고른 게 있으면 그것, 없으면 추천 */
  mode?: TransportMode;
  /** 화면에 보일 시간(분). 모르면 비어 있다. */
  minutes?: number;
  /** 대중교통 데이터가 없어서 추천에서 빠졌는지 */
  transitMissing: boolean;
  /**
   * 앞뒤 일정 중에 장소(좌표)가 없어서 계산을 못 하는지. 이때는 "직접 입력"보다
   * "장소를 넣으면 계산된다"가 맞는 안내다 — 새 일정을 장소 없이 만들면 늘 이 상태다.
   */
  missingPlace?: boolean;
}

const MODES: TransportMode[] = ['walk', 'transit', 'car'];

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

function minutesOf(results: Partial<Record<TransportMode, RouteResult>>): ModeMinutes {
  const out: ModeMinutes = {};
  for (const mode of MODES) {
    const r = results[mode];
    if (r?.available) out[mode] = r.minutes;
  }
  return out;
}

/** 조회 결과와 사용자의 선택을 합쳐 구간 하나의 표시 상태를 만든다. */
function toInfo(
  to: Item,
  results: Partial<Record<TransportMode, RouteResult>>,
  loading: boolean,
): LegInfo {
  const byMode = minutesOf(results);
  const shown = effectiveLeg(to.leg, byMode);
  const transit = results.transit;
  const status: LegInfo['status'] = shown.manual
    ? 'manual'
    : shown.mode && shown.minutes !== undefined
      ? 'ready'
      : loading
        ? 'loading'
        : 'unavailable';
  return {
    toItemId: to.id,
    status,
    results,
    recommended: recommendMode(byMode),
    mode: shown.mode,
    minutes: shown.minutes,
    transitMissing: !!transit && !transit.available && transit.reason === 'no_transit_data',
  };
}

export function useDayLegs(items: Item[], timezone?: string): Map<string, LegInfo> {
  /** 조회 결과만 들고 있는다. 사용자의 선택은 매 렌더 items에서 다시 읽는다. */
  const [fetched, setFetched] = useState<Map<string, Partial<Record<TransportMode, RouteResult>>>>(
    new Map(),
  );
  const requestId = useRef(0);

  // 좌표 쌍이나 출발 시각이 바뀔 때만 다시 조회한다.
  // 시각을 빼면 일정 시간을 바꿔도 예전 시간대의 대중교통 결과가 그대로 남는다.
  // 수단 선택·직접 입력은 조회와 무관하므로 여기 넣지 않는다 — 고를 때마다 다시
  // 조회하면 결과가 '조회 중'으로 깜빡이고 남의 서버에 요청만 는다.
  const signature = useMemo(
    () =>
      items
        .map(
          (i) =>
            `${i.id}:${i.coord ? `${i.coord.lat},${i.coord.lng}` : '-'}` +
            `>${i.toCoord ? `${i.toCoord.lat},${i.toCoord.lng}` : '-'}` +
            `:${i.date}@${i.localTime ?? ''}+${i.durationMin ?? ''}`,
        )
        .join('|') + `#${timezone ?? ''}`,
    [items, timezone],
  );

  useEffect(() => {
    const myRequest = requestId.current + 1;
    requestId.current = myRequest;
    setFetched(new Map());

    const pending: { from: Item; to: Item }[] = [];
    for (let i = 1; i < items.length; i += 1) {
      const from = items[i - 1]!;
      const to = items[i]!;
      const fromCoord = arrivalOf(from);
      if (!fromCoord || !to.coord) continue;
      if (resolveLegRegion(fromCoord, to.coord).crossBorder) continue;
      pending.push({ from, to });
    }
    if (pending.length === 0) return;

    for (const { from, to } of pending) {
      void (async () => {
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
        // 늦게 도착한 옛 요청은 버린다
        if (requestId.current !== myRequest) return;
        // 구간마다 도착하는 대로 채운다 — 가장 느린 구간을 기다리지 않는다
        setFetched((prev) => new Map(prev).set(to.id, results));
      })();
    }
    // signature가 좌표·시각 변화를 모두 담고 있다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return useMemo(() => {
    const legs = new Map<string, LegInfo>();
    for (let i = 1; i < items.length; i += 1) {
      const from = items[i - 1]!;
      const to = items[i]!;
      const fromCoord = arrivalOf(from);
      const { crossBorder } = resolveLegRegion(fromCoord, to.coord);
      const canQuery = !!fromCoord && !!to.coord && !crossBorder;
      const results = fetched.get(to.id);

      if (crossBorder && !to.leg?.isManual) {
        legs.set(to.id, { toItemId: to.id, status: 'cross_border', results: {}, transitMissing: false });
        continue;
      }
      // 조회할 수 없는 구간(좌표 없음·국경)도 직접 입력한 값은 보여준다
      const info = toInfo(to, results ?? {}, canQuery && !results);
      // 항공편은 원래 좌표가 없을 수 있다 — 장소를 넣으라고 할 대상이 아니다
      if ((!fromCoord && from.kind !== 'flight') || (!to.coord && to.kind !== 'flight')) {
        info.missingPlace = true;
      }
      legs.set(to.id, info);
    }
    return legs;
  }, [items, fetched]);
}
