/**
 * 여행 중 "오늘" — 지금 어느 여행의 몇째 날이고, 다음 일정은 무엇인지.
 *
 * 오늘은 **그 날 도시의 현지 날짜**로 판단한다. 한국 밤 11시에 방콕은 밤 9시라
 * 같은 순간에도 날짜가 다를 수 있다. 기기 시계의 타임존(여행 중엔 자동으로 바뀌기도,
 * 안 바뀌기도 한다)에 기대지 않고 일정에 적힌 타임존으로 센다.
 */

import type { Item, Trip, TripDay } from './types';

/** 그 타임존의 지금 날짜·시각. { date: '2026-11-04', time: '14:05' } */
export function localNow(timezone: string, now: Date = new Date()): { date: string; time: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
  } catch {
    const iso = now.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
}

export interface TodayInTrip {
  trip: Trip;
  day: TripDay;
  /** 0부터 — 화면은 +1 해서 'N일차' */
  dayIndex: number;
  /** 그 도시의 지금 시각 'HH:MM' */
  localTime: string;
}

/**
 * 지금 진행 중인 여행의 오늘. 날마다 자기 타임존의 오늘과 맞춰 본다.
 * 여러 여행이 겹치면 먼저 시작한 쪽.
 */
export function findToday(trips: readonly Trip[], now: Date = new Date()): TodayInTrip | null {
  const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const trip of sorted) {
    for (let i = 0; i < trip.days.length; i += 1) {
      const day = trip.days[i]!;
      const local = localNow(day.timezone, now);
      if (local.date === day.date) return { trip, day, dayIndex: i, localTime: local.time };
    }
  }
  return null;
}

/**
 * 다음 일정 — 지금 시각 이후에 시작하는 첫 일정. 시각이 없는 일정은 건너뛴다.
 * 다 지났으면 null. 순서가 아니라 시각으로 고른다(순서와 시각이 어긋날 수 있다).
 */
export function nextItem(items: readonly Item[], nowTime: string): Item | null {
  let best: Item | null = null;
  for (const it of items) {
    if (!it.localTime || it.localTime <= nowTime) continue;
    if (!best || it.localTime < best.localTime!) best = it;
  }
  return best;
}

/** '14:05'에서 '15:30'까지 몇 분 */
export function minutesUntil(from: string, to: string): number {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(to) - m(from);
}

/** 여행을 열 때 보여줄 날 — 여행 중이면 오늘, 아니면 첫날 */
export function defaultDateFor(trip: Trip, now: Date = new Date()): string {
  return findToday([trip], now)?.day.date ?? trip.startDate;
}
