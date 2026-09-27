/**
 * 하루의 양 끝 숙소 — 전날 묵은 곳에서 출발해 이 날 묵는 곳으로 끝난다.
 *
 * 이동 시간 계산(useDayLegs)과 지도의 선이 하루의 양 끝까지 닿게, 일정 목록 앞뒤에
 * 숙소를 가짜 항목으로 끼운 목록(routeItems)을 만든다. 화면은 숙소를 따로 그린다.
 * 일정 화면과 지도 화면이 같이 쓴다.
 */

import { useMemo } from 'react';
import type { Item, Trip, TripDay } from '@/domain/types';

/** 숙소를 일정처럼 — id는 "lodging:날짜"라 실제 일정과 겹치지 않는다 */
function lodgingItem(day: TripDay | undefined, tripId: string, date: string): Item | null {
  if (!day?.lodgingCoord) return null;
  return {
    id: `lodging:${day.date}`,
    tripId,
    date,
    sortKey: '',
    kind: 'place',
    title: day.lodgingName ?? '',
    placeName: day.lodgingName,
    coord: day.lodgingCoord,
  };
}

export function isLodgingId(id: string): boolean {
  return id.startsWith('lodging:');
}

export function useDayLodging(
  trip: Trip | undefined,
  date: string,
  items: Item[],
): {
  /** 전날 숙소(출발) · 이 날 숙소(도착). 좌표가 없으면 null */
  start: Item | null;
  end: Item | null;
  /** 이름만 있고 좌표가 없어도 보여 준다 */
  startName?: string;
  endName?: string;
  /** 앞뒤에 숙소를 끼운 목록 — 이동 시간·지도 선 계산용 */
  routeItems: Item[];
} {
  const index = trip?.days.findIndex((d) => d.date === date) ?? -1;
  const day = index >= 0 ? trip?.days[index] : undefined;
  const prev = index > 0 ? trip?.days[index - 1] : undefined;
  const tripId = trip?.id ?? '';

  // 객체 대신 값으로 비교한다 — 여행이 새로 오면 days 배열이 바뀌어도 숙소는 그대로일 때가 많다
  const start = useMemo(
    () => lodgingItem(prev, tripId, date),
    [prev?.date, prev?.lodgingName, prev?.lodgingCoord?.lat, prev?.lodgingCoord?.lng, tripId, date], // prettier-ignore
  );
  const end = useMemo(
    () => lodgingItem(day, tripId, date),
    [day?.date, day?.lodgingName, day?.lodgingCoord?.lat, day?.lodgingCoord?.lng, tripId, date], // prettier-ignore
  );
  const routeItems = useMemo(
    () => [...(start ? [start] : []), ...items, ...(end && items.length > 0 ? [end] : [])],
    [start, items, end],
  );

  return { start, end, startName: prev?.lodgingName, endName: day?.lodgingName, routeItems };
}
