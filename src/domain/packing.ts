/**
 * 준비물 기본 목록 — 여행마다 똑같이 치는 것들(여권·충전기·유심)을 한 번에.
 *
 * 항목 이름은 언어마다 달라 i18n에 있다(t.checklist.templates). 여기는 고르는 규칙만.
 */

import type { TripDay } from './types';

/** 이름 비교용 — 띄어쓰기·대소문자·가운뎃점 차이는 같은 항목으로 본다("보조 배터리" = "보조배터리") */
export function packingKey(title: string): string {
  return title.toLowerCase().replace(/[\s·・,.\-()]/g, '');
}

/** 이미 있는 항목은 뺀 후보 */
export function missingItems(existing: readonly string[], candidates: readonly string[]): string[] {
  const have = new Set(existing.map(packingKey));
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const k = packingKey(c);
    if (have.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * 해외여행인지 — 날짜 중 하나라도 집(기본 서울)과 다른 시간대면.
 * 좌표로 보면 일정을 넣기 전(준비물을 챙기는 때)에는 알 수 없다.
 */
export function isAbroad(days: readonly TripDay[], homeTimezone = 'Asia/Seoul'): boolean {
  return days.some((d) => d.timezone !== homeTimezone);
}
