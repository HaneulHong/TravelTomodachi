/**
 * 목 길찾기 프로바이더.
 *
 * 실제 API를 붙이기 전에 UI가 마주칠 모든 경우를 만들어내는 게 목적이다.
 * 특히 "대중교통 데이터가 없는 도시"를 반드시 재현한다 — 실제 서비스에서
 * 이 케이스가 조용히 빠져 있다가 현지에서 터지는 게 제일 흔한 사고다.
 *
 * 실제 구현으로 바꿀 때 이 파일만 교체하면 되고, 화면 코드는 손대지 않는다.
 * 실제 구현에서는 반드시:
 *   - API 키를 클라이언트에 두지 말고 Supabase Edge Function을 프록시로 쓴다
 *   - 결과를 routes 테이블에 캐시한다 (친구 5명이 같은 일정을 봐도 호출 1회)
 */

import { haversineMeters } from '@/domain/geo';
import type { Coord, TransportMode } from '@/domain/types';
import type { RouteProvider, RouteQuery, RouteResult } from '../types';

/** 이동수단별 유효 속도(km/h)와 고정 오버헤드(분) */
const PROFILE: Record<TransportMode, { kmh: number; overheadMin: number }> = {
  // 도보는 신호·계단 때문에 직선거리보다 항상 더 걸린다
  walk: { kmh: 4.4, overheadMin: 2 },
  // 대중교통은 대기·환승 시간이 지배적이다
  transit: { kmh: 21, overheadMin: 7 },
  // 차량은 도심 정체를 감안
  car: { kmh: 26, overheadMin: 4 },
};

/** 직선거리 → 실제 이동거리 보정 계수 */
const DETOUR_FACTOR: Record<TransportMode, number> = {
  walk: 1.35,
  transit: 1.3,
  car: 1.25,
};

/**
 * 대중교통 데이터가 없는 지역 (GTFS 피드 미제공 재현).
 * Google 대중교통은 도시 단위로 커버되며 이런 공백이 실제로 존재한다.
 */
const TRANSIT_DATA_GAPS: { center: Coord; radiusKm: number; label: string }[] = [
  { center: { lat: 21.028, lng: 105.834 }, radiusKm: 70, label: '하노이' },
  { center: { lat: 11.556, lng: 104.928 }, radiusKm: 60, label: '프놈펜' },
  { center: { lat: -8.409, lng: 115.188 }, radiusKm: 80, label: '발리' },
];

function hasTransitData(coord: Coord): boolean {
  return !TRANSIT_DATA_GAPS.some(
    (gap) => haversineMeters(gap.center, coord) / 1000 <= gap.radiusKm,
  );
}

/** 좌표에서 결정적으로 뽑아낸 ±12% 흔들림. 매번 같은 값이 나와야 UI가 안 튄다. */
function jitter(from: Coord, to: Coord): number {
  const seed = Math.abs(
    Math.sin(from.lat * 12.9898 + from.lng * 78.233 + to.lat * 37.719 + to.lng * 4.1414),
  );
  return 0.88 + (seed % 1) * 0.24;
}

function estimate(query: RouteQuery): { minutes: number; distanceM: number } {
  const straight = haversineMeters(query.from, query.to);
  const distanceM = straight * DETOUR_FACTOR[query.mode];
  const profile = PROFILE[query.mode];
  const travelMin = (distanceM / 1000 / profile.kmh) * 60;
  const minutes = Math.max(
    1,
    Math.round((travelMin + profile.overheadMin) * jitter(query.from, query.to)),
  );
  return { minutes, distanceM };
}

/** 네트워크 지연 흉내 — 로딩 상태 UI를 실제로 검증하기 위해 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 해외(GLOBAL) 프로바이더 — 실제로는 Google Directions.
 * 도보·차량은 전세계 대부분 되지만, 대중교통은 도시별로 공백이 있다.
 */
export const mockGlobalRouteProvider: RouteProvider = {
  id: 'mock-google',
  label: 'Google Directions (목)',
  modes: ['walk', 'transit', 'car'],

  async route(query: RouteQuery): Promise<RouteResult> {
    await delay(180);

    if (query.mode === 'transit' && !hasTransitData(query.to)) {
      return {
        available: false,
        mode: 'transit',
        reason: 'no_transit_data',
        source: this.label,
      };
    }

    const { minutes, distanceM } = estimate(query);
    return { available: true, mode: query.mode, minutes, distanceM, source: this.label };
  },
};

/**
 * 국내(KR) 프로바이더.
 *
 * 실제 구현에서는 한 서비스가 아니라 두 개를 합쳐야 한다:
 *   도보·차량 → 카카오모빌리티 (자동차 길찾기는 사용 권한 신청 필요)
 *   대중교통   → Tmap 또는 공공데이터포털 TAGO
 *               (ODsay 무료 플랜은 30회/일이라 실사용 불가)
 * Google은 한국 내 차량·도보를 아예 제공하지 않으므로 여기 올 수 없다.
 */
export const mockKoreaRouteProvider: RouteProvider = {
  id: 'mock-kakao-tmap',
  label: '카카오모빌리티 + Tmap (목)',
  modes: ['walk', 'transit', 'car'],

  async route(query: RouteQuery): Promise<RouteResult> {
    await delay(140);
    // 국내는 대중교통 데이터 공백이 사실상 없다
    const { minutes, distanceM } = estimate(query);
    return { available: true, mode: query.mode, minutes, distanceM, source: this.label };
  },
};
