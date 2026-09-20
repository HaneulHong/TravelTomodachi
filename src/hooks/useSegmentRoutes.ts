/**
 * 터미널 구간(기차·버스·배편) 자체의 경로선을 채운다.
 *
 * useDayLegs는 **항목과 항목 사이**를 다룬다. 이 훅은 **항목 하나 안**의
 * 이동을 다룬다 — 출발 터미널에서 도착 터미널까지.
 *
 * ── 무엇을 그리나 ────────────────────────────────────────────────
 * 1. 대중교통 조회를 먼저 한다. 그 지역에 GTFS가 있으면 실제 노선이 온다.
 * 2. 없으면 차량 경로로 떨어진다. 도로를 따라가는 선이라도 직선보다 훨씬
 *    사실에 가깝다 — 시외버스는 실제로 그 길로 가고, 기차도 대체로 나란히
 *    간다. 배편도 OSM에 페리 항로가 있어서 차량 경로가 바다를 건너준다.
 * 3. 둘 다 없으면 undefined. 화면이 직선 점선으로 잇는다.
 *
 * ── 항공은 뺀다 ──────────────────────────────────────────────────
 * 인천 → 방콕에 차량 경로를 그리면 중국·베트남을 관통하는 선이 나온다.
 * 비행기는 실제로 그렇게 가지 않는다. 항공은 직선(대권)이 맞다.
 */

import { useEffect, useRef, useState } from 'react';
import { haversineMeters } from '@/domain/geo';
import { wallClockToInstant } from '@/domain/time';
import type { Coord, Item } from '@/domain/types';
import { fetchRoute } from '@/providers/routeCache';

/** 이 종류만 실제 노선을 찾아본다. */
function wantsRoute(item: Item): boolean {
  return item.kind === 'train' || item.kind === 'bus' || item.kind === 'ferry';
}

/**
 * 이보다 긴 직선 구간이 하나라도 있으면 "그려진 노선"으로 치지 않는다.
 *
 * 왜 필요한가: 대중교통 응답이 늘 경로를 그려주지는 않는다. 제주–목포
 * 여객선은 GTFS에 실려 있어서 시간(270분)은 정확히 오는데, 폴리라인은
 * **점 두 개**(출발항·도착항)뿐이다. 그대로 쓰면 200km를 가로지르는 직선이
 * 실선으로 그려져서 "조회된 실제 항로"처럼 보인다.
 *
 * 점 개수만 세면 안 된다. 양끝 도보 구간에 점이 수십 개 붙어 있어서 총합은
 * 넉넉해 보이지만, 정작 긴 구간이 비어 있기 때문이다. 그래서 이웃한 두 점
 * 사이의 최대 간격을 본다.
 */
const MAX_GAP_M = 20_000;

/** 이웃한 점 사이가 전부 촘촘한지 — 즉 실제로 그려진 선인지. */
function isDrawnRoute(shape: Coord[]): boolean {
  if (shape.length < 2) return false;
  for (let i = 1; i < shape.length; i += 1) {
    if (haversineMeters(shape[i - 1]!, shape[i]!) > MAX_GAP_M) return false;
  }
  return true;
}

export function useSegmentRoutes(
  items: Item[],
  timezone?: string,
): Map<string, Coord[]> {
  const [shapes, setShapes] = useState<Map<string, Coord[]>>(new Map());
  const requestId = useRef(0);

  // 좌표가 바뀔 때만 다시 조회한다
  const signature = items
    .filter(wantsRoute)
    .map(
      (i) =>
        `${i.id}:${i.coord ? `${i.coord.lat},${i.coord.lng}` : '-'}` +
        `>${i.toCoord ? `${i.toCoord.lat},${i.toCoord.lng}` : '-'}:${i.localTime ?? ''}`,
    )
    .join('|');

  useEffect(() => {
    const targets = items.filter((i) => wantsRoute(i) && i.coord && i.toCoord);
    if (targets.length === 0) {
      setShapes(new Map());
      return;
    }

    const myRequest = requestId.current + 1;
    requestId.current = myRequest;

    void (async () => {
      const found = new Map<string, Coord[]>();

      await Promise.all(
        targets.map(async (item) => {
          const from = item.coord!;
          const to = item.toCoord!;
          const departAt =
            timezone && item.localTime
              ? wallClockToInstant(item.date, item.localTime, timezone)
              : undefined;

          // 실제로 그려진 노선이 먼저. 없으면 도로(·항로)를 따라가는 선으로.
          const transit = await fetchRoute(from, to, 'transit', departAt);
          if (transit.available && transit.polyline && isDrawnRoute(transit.polyline)) {
            found.set(item.id, transit.polyline);
            return;
          }

          /*
           * 차량 경로는 OSM의 페리 항로도 탄다. 그래서 배편에서도 바다를
           * 건너는 선이 나온다 — 대중교통이 준 두 점짜리 직선보다 훨씬 낫다.
           */
          const car = await fetchRoute(from, to, 'car', departAt);
          if (car.available && car.polyline && car.polyline.length > 1) {
            found.set(item.id, car.polyline);
          }
        }),
      );

      // 늦게 도착한 옛 요청은 버린다
      if (requestId.current !== myRequest) return;
      setShapes(found);
    })();
    // signature가 좌표·시각 변화를 모두 담고 있다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, timezone]);

  return shapes;
}
