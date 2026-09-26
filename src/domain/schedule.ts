/**
 * 일정 사이 여유 — 앞 일정을 마치고 이동하면 다음 일정 시작에 맞출 수 있는지.
 *
 *   여유 = 다음 시작 − (앞 시작 + 머무는 시간 + 이동 시간)
 *
 * 음수면 그만큼 늦는다. 경로를 이미 계산하고 있으니 "도착 못 하는 일정"을 미리 알려
 * 줄 수 있다 — 여행 당일에 알게 되면 늦다.
 *
 * 모르면 null: 시각이나 머무는 시간이 없거나, 이동 시간을 아직 모르거나, 다음 일정이
 * 앞 일정보다 이른 시각인 경우(순서·시각 어긋남은 따로 경고한다 — domain/order.ts).
 */

import type { Item } from './types';

function toMinutes(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

export function slackMinutes(prev: Item, next: Item, travelMinutes: number | undefined): number | null {
  if (!prev.localTime || !next.localTime || prev.durationMin === undefined) return null;
  if (travelMinutes === undefined) return null;
  const start = toMinutes(prev.localTime);
  const nextStart = toMinutes(next.localTime);
  if (nextStart < start) return null;
  return nextStart - (start + prev.durationMin + travelMinutes);
}
