/**
 * 시간 유틸.
 *
 * 규칙: 저장은 date + localTime(벽시계) + timezone. UTC 변환 없음.
 * 여기 있는 함수들은 전부 "표시"와 "타임존 비교"만 한다.
 * 예외는 wallClockToInstant 하나다. 대중교통 조회는 "그 순간"의 시간표를
 * 봐야 해서 외부 API에 넘길 때만 변환한다. 변환은 이 파일 안에서만 한다.
 */

import { INTL_TAG, type Locale } from '../i18n/locales';
import type { TripDay } from './types';

/*
 * 언어는 인자로 받는다. 기본값 'ko'는 테스트와 예전 호출부를 위한 것 —
 * 화면에서는 useLocale()이 준 값을 넘긴다.
 */

/** 시간 단위 이름. Intl.DurationFormat은 아직 브라우저마다 달라서 직접 둔다. */
const UNIT: Record<Locale, { h: string; m: string; join: string; same: string }> = {
  ko: { h: '시간', m: '분', join: ' ', same: '동일' },
  en: { h: 'h', m: 'm', join: ' ', same: 'none' },
  ja: { h: '時間', m: '分', join: '', same: 'なし' },
};

/** '2026-11-03' → '11월 3일 (화)' · 'Tue, Nov 3' · '11月3日(火)' */
export function formatDateLabel(date: string, locale: Locale = 'ko'): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    // 영어는 월 이름이 길어(September) 좁은 폰에서 줄이 넘친다
    month: locale === 'en' ? 'short' : 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(d);
}

/** 월·일만. '11월 3일' · 'Nov 3' · '11月3日' */
function formatMonthDay(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    month: locale === 'en' ? 'short' : 'long',
    day: 'numeric',
  }).format(d);
}

const RELATIVE_NOW: Record<Locale, string> = { ko: '방금', en: 'just now', ja: 'たった今' };

/**
 * 고친 시각을 "얼마 전"으로. 누가 언제 바꿨는지 볼 때 쓴다.
 * 일주일이 넘으면 날짜로 쓴다 — '23일 전'은 언제인지 다시 세어봐야 한다.
 * 기기 시계가 조금 틀려 미래 시각이 오면 '방금'으로 본다.
 */
export function formatRelative(
  iso: string,
  now: number = Date.now(),
  locale: Locale = 'ko',
): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const min = Math.floor((now - then) / 60_000);
  if (min < 1) return RELATIVE_NOW[locale];
  const rtf = new Intl.RelativeTimeFormat(INTL_TAG[locale], { numeric: 'always', style: 'short' });
  if (min < 60) return rtf.format(-min, 'minute');
  const hours = Math.floor(min / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return formatMonthDay(new Date(then), locale);
}

/** '2026-11-03' → '11.3' (날짜 칩처럼 좁은 자리용) */
export function formatDateShort(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}.${Number(d)}`;
}

/** '2026-11-03' → '화' · 'Tue' · '火' */
export function formatWeekday(date: string, locale: Locale = 'ko'): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat(INTL_TAG[locale], { weekday: 'short', timeZone: 'UTC' }).format(d);
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
 * 벽시계 시간을 실제 시점(ISO)으로 바꾼다.
 *
 * 대중교통 조회에 필요하다. "11월 6일 09:00"은 어느 도시냐에 따라 서로 다른
 * 순간이고, 버스 시간표는 그 순간을 기준으로 갈린다. 저장은 벽시계로 하되
 * (ARCHITECTURE.md의 타임존 결정) 외부 API에 넘길 때만 여기서 변환한다.
 */
export function wallClockToInstant(date: string, hhmm: string, timezone: string): string {
  // 일단 UTC로 읽은 뒤 그 지역의 오프셋만큼 되돌린다.
  const asUtc = Date.parse(`${date}T${hhmm}:00Z`);
  if (Number.isNaN(asUtc)) return new Date().toISOString();
  return new Date(asUtc - tzOffsetMinutes(timezone, date) * 60_000).toISOString();
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

/**
 * 이 날 바로 뒤로 이어지는, 같은 도시·타임존인 날짜들.
 *
 * 도시를 옮기는 날을 고칠 때 보통 그 뒤 며칠도 같이 바뀌어야 한다. 그렇다고
 * "여행 끝까지"를 다 바꾸면 이미 따로 정해 둔 다음 도시까지 덮어버린다.
 * 그래서 지금과 똑같은 설정이 끊기지 않고 이어지는 날까지만 모은다.
 * 날짜는 정렬돼 있다고 가정한다(여행의 days는 항상 날짜순).
 */
export function followingSameDays(days: TripDay[], date: string): string[] {
  const i = days.findIndex((d) => d.date === date);
  const base = days[i];
  if (!base) return [];
  const out: string[] = [];
  for (const d of days.slice(i + 1)) {
    if (d.timezone !== base.timezone || d.cityLabel !== base.cityLabel) break;
    out.push(d.date);
  }
  return out;
}

/** 시·분을 그 언어로. 1시간 35분 · 1h 35m · 1時間35分 */
function hoursMinutes(h: number, m: number, locale: Locale): string {
  const u = UNIT[locale];
  if (h === 0) return `${m}${u.m}`;
  if (m === 0) return `${h}${u.h}`;
  return `${h}${u.h}${u.join}${m}${u.m}`;
}

/** 540 → '+9시간', -180 → '-3시간', 90 → '+1시간 30분' */
export function formatOffsetDelta(minutes: number, locale: Locale = 'ko'): string {
  if (minutes === 0) return UNIT[locale].same;
  const sign = minutes > 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return sign + hoursMinutes(Math.floor(abs / 60), abs % 60, locale);
}

/** 95 → '1시간 35분', 40 → '40분' */
export function formatMinutes(minutes: number, locale: Locale = 'ko'): string {
  const safe = Math.max(0, Math.round(minutes));
  return hoursMinutes(Math.floor(safe / 60), safe % 60, locale);
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
