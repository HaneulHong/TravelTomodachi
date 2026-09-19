/**
 * 시간 유틸.
 *
 * 규칙: 저장은 date + localTime(벽시계) + timezone. UTC 변환 없음.
 * 여기 있는 함수들은 전부 "표시"와 "타임존 비교"만 한다.
 * 벽시계 시간을 실제 순간(instant)으로 바꾸는 일은 항공편 알림 같은
 * 기능이 생길 때에나 필요하고, 그때도 이 파일 안에서만 한다.
 */

import type { TripDay } from './types';

/** '2026-11-03' → '11월 3일 (화)' */
export function formatDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(d);
}

/** '2026-11-03' → '11.3' (날짜 칩처럼 좁은 자리용) */
export function formatDateShort(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}.${Number(d)}`;
}

/** '2026-11-03' → '화' */
export function formatWeekday(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' }).format(d);
}

/** 'Asia/Bangkok' → 'GMT+7' */
export function tzShortLabel(timezone: string, onDate?: string): string {
  const d = onDate ? new Date(`${onDate}T12:00:00Z`) : new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(d);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone;
  } catch {
    return timezone;
  }
}

/** 타임존의 UTC 오프셋(분). 'Asia/Seoul' → 540 */
export function tzOffsetMinutes(timezone: string, onDate?: string): number {
  const label = tzShortLabel(timezone, onDate); // 'GMT+9' | 'GMT+5:30' | 'GMT'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(label);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const hours = Number(m[2]);
  const mins = Number(m[3] ?? '0');
  return sign * (hours * 60 + mins);
}

/**
 * 어제와 오늘의 타임존이 다른지. 다르면 UI에서 경고를 띄운다.
 * 전세계 여행에서 제일 조용하게 사람을 물어뜯는 버그가 여기서 나온다.
 */
export function timezoneShift(
  prev: TripDay | undefined,
  cur: TripDay | undefined,
): { changed: boolean; deltaMinutes: number } {
  if (!prev || !cur || prev.timezone === cur.timezone) {
    return { changed: false, deltaMinutes: 0 };
  }
  const delta = tzOffsetMinutes(cur.timezone, cur.date) - tzOffsetMinutes(prev.timezone, prev.date);
  return { changed: true, deltaMinutes: delta };
}

/** 540 → '+9시간', -180 → '-3시간', 90 → '+1시간 30분' */
export function formatOffsetDelta(minutes: number): string {
  if (minutes === 0) return '동일';
  const sign = minutes > 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}분`;
  if (m === 0) return `${sign}${h}시간`;
  return `${sign}${h}시간 ${m}분`;
}

/** 95 → '1시간 35분', 40 → '40분' */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** '09:00' + 90분 → '10:30'. 자정을 넘기면 24시간으로 감싼다. */
export function addMinutesToWallClock(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h ?? 0) * 60 + (m ?? 0) + Math.round(minutes)) % 1440 + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 여행 시작일 기준 며칠째인지. 1-based. */
export function dayNumber(startDate: string, date: string): number {
  const a = Date.parse(`${startDate}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  return Math.floor((b - a) / 86_400_000) + 1;
}

/** 여행 전체 일수 */
export function tripLengthDays(startDate: string, endDate: string): number {
  return dayNumber(startDate, endDate);
}

/** 오늘(사용자 기기 기준)로부터 여행 시작까지 며칠. 음수면 이미 시작. */
export function daysUntil(date: string, today = new Date()): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const d = Date.parse(`${date}T00:00:00Z`);
  return Math.round((d - t) / 86_400_000);
}
