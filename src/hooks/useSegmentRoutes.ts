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
import { wallClockToInstant } from '@/domain/time';
import type { Coord, Item } from '@/domain/types';
import { fetchRoute } from '@/providers/routeCache';

/** 이 종류만 실제 노선을 찾아본다. */
function wantsRoute(item: Item): boolean {
  return item.kind === 'train' || item.kind === 'bus' || item.kind === 'ferry';
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

          // 실제 노선이 먼저. 없으면 도로를 따라가는 선으로.
          const transit = await fetchRoute(from, to, 'transit', departAt);
          if (transit.available && transit.polyline && transit.polyline.length > 1) {
            found.set(item.id, transit.polyline);
            return;
          }

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
