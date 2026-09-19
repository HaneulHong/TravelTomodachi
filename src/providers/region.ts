import type { Coord, Region } from '@/domain/types';

/**
 * 한국 본토 + 제주 + 울릉/독도를 포함하는 대략적 경계 상자.
 *
 * 경계 상자는 일본 쓰시마 일부를 포함할 수 있다. 정밀도가 필요해지면
 * 여기만 역지오코딩 국가코드(ISO 'KR') 기반으로 바꾸면 되고,
 * 호출부는 손대지 않는다 — 그게 이 함수를 따로 둔 이유다.
 */
const KR_BOUNDS = {
  minLat: 32.9,
  maxLat: 38.7,
  minLng: 124.5,
  maxLng: 132.0,
} as const;

export function isInKorea(coord: Coord): boolean {
  return (
    coord.lat >= KR_BOUNDS.minLat &&
    coord.lat <= KR_BOUNDS.maxLat &&
    coord.lng >= KR_BOUNDS.minLng &&
    coord.lng <= KR_BOUNDS.maxLng
  );
}

/** 좌표가 속한 지역. 좌표가 없으면 GLOBAL로 본다. */
export function resolveRegion(coord?: Coord): Region {
  if (!coord) return 'GLOBAL';
  return isInKorea(coord) ? 'KR' : 'GLOBAL';
}

/**
 * 구간(출발→도착)의 지역. 두 좌표가 다른 지역이면 국제 구간이므로
 * 어느 프로바이더도 제대로 답하지 못한다 → 호출부에서 수동 입력으로 넘긴다.
 */
export function resolveLegRegion(
  from?: Coord,
  to?: Coord,
): { region: Region; crossBorder: boolean } {
  const a = resolveRegion(from);
  const b = resolveRegion(to);
  return { region: a, crossBorder: a !== b };
}

export const REGION_LABEL: Record<Region, string> = {
  KR: '국내',
  GLOBAL: '해외',
};
