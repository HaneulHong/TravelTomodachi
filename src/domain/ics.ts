/**
 * 캘린더 파일(.ics) 만들기 — 구글·애플·아웃룩 캘린더로 가져갈 수 있게.
 *
 * ── 시간 ───────────────────────────────────────────────────────────
 * 일정은 벽시계 시간 + 그 날의 타임존으로 저장돼 있다. 캘린더에는 **UTC 시각**으로
 * 넣는다(…Z). TZID로 넣으려면 파일 안에 타임존 정의(VTIMEZONE)를 통째로 써야 하고,
 * 빠뜨리면 캘린더 앱마다 다르게 해석한다. UTC면 어디서 열어도 같은 순간이다 —
 * "방콕 09:00"은 서울 캘린더에서 11:00으로 제대로 보인다.
 *
 * 시각이 없는 일정은 그 날의 종일 일정으로 넣는다.
 */

import { wallClockToInstant } from './time';
import type { Item, Trip } from './types';

export interface IcsText {
  /** 예약 번호 줄 앞에 붙는 말 (화면 언어) */
  bookingLabel: string;
}

/** 머무는 시간이 없으면 이만큼으로 잡는다 */
const DEFAULT_MINUTES = 60;

/** RFC 5545 글자 이스케이프 — 역슬래시·쉼표·세미콜론·줄바꿈 */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** 한 줄은 75바이트를 넘기지 않는다 — 넘으면 다음 줄을 공백으로 시작해 잇는다 */
function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > 75) {
      out.push(cur);
      cur = ` ${ch}`;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.join('\r\n');
}

/** '2026-11-04T02:00:00.000Z' → '20261104T020000Z' */
function utcStamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** '2026-11-04' → '20261104' */
function dateStamp(date: string): string {
  return date.replace(/-/g, '');
}

function nextDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function buildIcs(trip: Trip, items: readonly Item[], text: IcsText, now = new Date()): string {
  const tzOf = new Map(trip.days.map((d) => [d.date, d.timezone]));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TravelTomodachi//KO',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(trip.name)}`,
  ];
  const stamp = utcStamp(now.toISOString());

  for (const item of items) {
    if (item.tripId !== trip.id) continue;
    const tz = tzOf.get(item.date) ?? 'UTC';
    lines.push('BEGIN:VEVENT', `UID:${item.id}@traveltomodachi`, `DTSTAMP:${stamp}`);

    if (item.localTime) {
      const start = wallClockToInstant(item.date, item.localTime, tz);
      const end = new Date(
        Date.parse(start) + (item.durationMin ?? DEFAULT_MINUTES) * 60_000,
      ).toISOString();
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(item.date)}`, `DTEND;VALUE=DATE:${dateStamp(nextDate(item.date))}`);
    }

    lines.push(`SUMMARY:${esc(item.title)}`);
    const where = item.toPlaceName ? `${item.placeName ?? ''} → ${item.toPlaceName}` : item.placeName;
    if (where) lines.push(`LOCATION:${esc(where)}`);
    const notes = [
      item.carrierCode,
      item.bookingRef ? `${text.bookingLabel}: ${item.bookingRef}` : undefined,
      item.description,
    ].filter(Boolean);
    if (notes.length) lines.push(`DESCRIPTION:${esc(notes.join('\n'))}`);
    if (item.coord) lines.push(`GEO:${item.coord.lat};${item.coord.lng}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  // 줄 끝은 CRLF가 표준이다
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
