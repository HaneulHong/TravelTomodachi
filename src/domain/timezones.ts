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

export interface ZoneOption {
  id: string;
  label: string;
}

export const TIMEZONES: readonly ZoneOption[] = [
  { id: 'Asia/Seoul', label: '서울' },
  { id: 'Asia/Tokyo', label: '도쿄' },
  { id: 'Asia/Shanghai', label: '상하이' },
  { id: 'Asia/Taipei', label: '타이베이' },
  { id: 'Asia/Hong_Kong', label: '홍콩' },
  { id: 'Asia/Bangkok', label: '방콕' },
  { id: 'Asia/Ho_Chi_Minh', label: '호치민' },
  { id: 'Asia/Singapore', label: '싱가포르' },
  { id: 'Asia/Jakarta', label: '자카르타' },
  { id: 'Asia/Kolkata', label: '인도' },
  { id: 'Asia/Dubai', label: '두바이' },
  { id: 'Europe/London', label: '런던' },
  { id: 'Europe/Paris', label: '파리' },
  { id: 'Europe/Berlin', label: '베를린' },
  { id: 'America/New_York', label: '뉴욕' },
  { id: 'America/Los_Angeles', label: '로스앤젤레스' },
  { id: 'Australia/Sydney', label: '시드니' },
  { id: 'Pacific/Auckland', label: '오클랜드' },
];

/** 목록에 있으면 한글 도시 이름, 없으면 IANA 이름의 마지막 부분 */
export function zoneLabel(id: string): string {
  const known = TIMEZONES.find((z) => z.id === id);
  if (known) return known.label;
  return id.split('/').pop()?.replace(/_/g, ' ') ?? id;
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
export function zoneOptions(...extra: string[]): ZoneOption[] {
  const out: ZoneOption[] = [];
  for (const id of extra) {
    if (!TIMEZONES.some((z) => z.id === id) && !out.some((z) => z.id === id)) {
      out.push({ id, label: zoneLabel(id) });
    }
  }
  return [...out, ...TIMEZONES];
}
