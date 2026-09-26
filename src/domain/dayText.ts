/**
 * 하루 일정을 메신저용 글로 — 단톡방에 붙여 넣어 앱을 안 쓰는 친구도 보게.
 *
 *   🏙️ 서울 3일 테스트 · 3일차 9월 27일 (일) · 서울
 *
 *   10:00 서울스카이 — 롯데월드타워 (1시간 30분)
 *     ↓ 대중교통 25분
 *   12:30 점심 · 분짜
 *
 * 링크는 넣지 않는다. 여행 링크는 멤버만 열리고, 장소마다 지도 링크를 달면 메신저에서
 * 글보다 주소가 길어진다. 문구·단위는 호출부가 언어에 맞게 넘긴다(labels).
 */

import { isSegmentKind, type Item, type ItemKind, type TransportMode } from './types';

const KIND_EMOJI: Record<ItemKind, string> = {
  place: '',
  flight: '✈️ ',
  train: '🚆 ',
  bus: '🚌 ',
  ferry: '⛴️ ',
};

export interface DayTextInput {
  /** 첫 줄 — "🏙️ 서울 3일 테스트 · 3일차 9월 27일 (일) · 서울" */
  heading: string;
  items: readonly Item[];
  /** 앞 일정에서 이 일정까지 — 화면에 보이는 수단·시간(useDayLegs) */
  legOf(item: Item): { mode: TransportMode; minutes: number } | undefined;
  labels: {
    /** "1시간 30분" */
    minutes(n: number): string;
    mode(m: TransportMode): string;
    /** 일정이 없을 때 */
    empty: string;
  };
}

export function formatDayText({ heading, items, legOf, labels }: DayTextInput): string {
  const lines = [heading, ''];
  if (items.length === 0) {
    lines.push(labels.empty);
    return lines.join('\n');
  }

  items.forEach((item, i) => {
    const leg = i > 0 ? legOf(item) : undefined;
    if (leg) lines.push(`  ↓ ${labels.mode(leg.mode)} ${labels.minutes(leg.minutes)}`);

    let line = `${item.localTime ?? '—'} ${KIND_EMOJI[item.kind]}${item.title}`;
    if (item.carrierCode) line += ` ${item.carrierCode}`;
    // 구간이면 출발 → 도착, 아니면 장소 이름(제목과 같으면 한 번만)
    if (isSegmentKind(item.kind) && (item.placeName || item.toPlaceName)) {
      line += ` — ${item.placeName ?? '?'} → ${item.toPlaceName ?? '?'}`;
    } else if (item.placeName && item.placeName !== item.title) {
      line += ` — ${item.placeName}`;
    }
    if (item.durationMin) line += ` (${labels.minutes(item.durationMin)})`;
    lines.push(line);
  });
  return lines.join('\n');
}
