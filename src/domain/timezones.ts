/**
 * 고를 수 있는 타임존.
 *
 * 여행에서 자주 쓰는 곳만 둔다. 400개짜리 IANA 목록을 다 보여주면 고르는 게
 * 더 일이 된다. 목록에 없는 타임존(기기 타임존, 예전에 저장된 값)은
 * `zoneOptions`가 맨 앞에 끼워 넣어 선택이 사라지지 않게 한다.
 *
 * 라벨은 그 타임존의 대표 도시다. 'Asia/Ho_Chi_Minh'보다 '호치민'이 읽기 쉽고,
 * 날짜의 도시 이름이 비어 있을 때 채워 넣는 기본값으로도 쓴다.
 */

import type { Locale } from '../i18n/locales';

export interface ZoneOption {
  id: string;
  label: string;
}

/** 대표 도시 이름. 언어마다 다르다. */
const ZONES: readonly { id: string; label: Record<Locale, string> }[] = [
  { id: 'Asia/Seoul', label: { ko: '서울', en: 'Seoul', ja: 'ソウル' } },
  { id: 'Asia/Tokyo', label: { ko: '도쿄', en: 'Tokyo', ja: '東京' } },
  { id: 'Asia/Shanghai', label: { ko: '상하이', en: 'Shanghai', ja: '上海' } },
  { id: 'Asia/Taipei', label: { ko: '타이베이', en: 'Taipei', ja: '台北' } },
  { id: 'Asia/Hong_Kong', label: { ko: '홍콩', en: 'Hong Kong', ja: '香港' } },
  { id: 'Asia/Bangkok', label: { ko: '방콕', en: 'Bangkok', ja: 'バンコク' } },
  { id: 'Asia/Ho_Chi_Minh', label: { ko: '호치민', en: 'Ho Chi Minh City', ja: 'ホーチミン' } },
  { id: 'Asia/Singapore', label: { ko: '싱가포르', en: 'Singapore', ja: 'シンガポール' } },
  { id: 'Asia/Jakarta', label: { ko: '자카르타', en: 'Jakarta', ja: 'ジャカルタ' } },
  { id: 'Asia/Kolkata', label: { ko: '인도', en: 'India', ja: 'インド' } },
  { id: 'Asia/Dubai', label: { ko: '두바이', en: 'Dubai', ja: 'ドバイ' } },
  { id: 'Europe/London', label: { ko: '런던', en: 'London', ja: 'ロンドン' } },
  { id: 'Europe/Paris', label: { ko: '파리', en: 'Paris', ja: 'パリ' } },
  { id: 'Europe/Berlin', label: { ko: '베를린', en: 'Berlin', ja: 'ベルリン' } },
  { id: 'America/New_York', label: { ko: '뉴욕', en: 'New York', ja: 'ニューヨーク' } },
  { id: 'America/Los_Angeles', label: { ko: '로스앤젤레스', en: 'Los Angeles', ja: 'ロサンゼルス' } },
  { id: 'Australia/Sydney', label: { ko: '시드니', en: 'Sydney', ja: 'シドニー' } },
  { id: 'Pacific/Auckland', label: { ko: '오클랜드', en: 'Auckland', ja: 'オークランド' } },
];

/** 목록에 있으면 그 언어의 도시 이름, 없으면 IANA 이름의 마지막 부분 */
export function zoneLabel(id: string, locale: Locale = 'ko'): string {
  const known = ZONES.find((z) => z.id === id);
  if (known) return known.label[locale];
  return id.split('/').pop()?.replace(/_/g, ' ') ?? id;
}

/**
 * 어떤 언어로든 이 타임존의 기본 도시 이름인지.
 * 날짜의 도시 이름은 저장되는 값이라, 만든 사람의 언어로 들어가 있다.
 * '방콕'을 영어 화면에서 고쳐도 기본값으로 알아봐야 새 타임존 이름으로 바꿔준다.
 */
export function isDefaultZoneLabel(id: string, label: string): boolean {
  const known = ZONES.find((z) => z.id === id);
  if (!known) return label === zoneLabel(id);
  return Object.values(known.label).includes(label);
}

/** 기기 타임존. 못 읽으면 서울. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  } catch {
    return 'Asia/Seoul';
  }
}

/** 선택지. `extra`가 목록에 없으면 맨 앞에 넣는다. */
export function zoneOptions(locale: Locale, ...extra: string[]): ZoneOption[] {
  const out: ZoneOption[] = [];
  for (const id of extra) {
    if (!ZONES.some((z) => z.id === id) && !out.some((z) => z.id === id)) {
      out.push({ id, label: zoneLabel(id, locale) });
    }
  }
  return [...out, ...ZONES.map((z) => ({ id: z.id, label: z.label[locale] }))];
}
