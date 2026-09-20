/**
 * 길찾기 — Valhalla (FOSSGIS 공개 인스턴스, OpenStreetMap 데이터).
 *
 * ── 왜 이걸 골랐나 ────────────────────────────────────────────────
 * 무료이고 키가 필요 없다. 그리고 **한국에서도 자동차·도보가 나온다** —
 * Google이 못 하는 부분이다(측량법상 지도 데이터 국외 반출 제한). OSM 기반
 * 라우팅은 그 제한에 걸리지 않으므로 국내외를 한 프로바이더로 덮는다.
 *
 * ── OSRM 공개 데모를 쓰지 않은 이유 ───────────────────────────────
 * URL에 foot/bike를 넣어도 **driving과 똑같은 값을 돌려준다.** 프로파일이
 * 하나만 올라가 있기 때문이다. 그걸 모르고 쓰면 차량 시간이 "도보 7분"으로
 * 둔갑한다. Valhalla는 같은 구간에서 차량 15분 / 도보 44분으로 제대로 갈린다.
 *
 * ── 대중교통은 여전히 없다 ────────────────────────────────────────
 * 공개 인스턴스에 GTFS가 올라가 있지 않다. 추정값을 만들어 채우지 않고
 * '정보 없음'으로 돌려준다 — 틀린 숫자를 믿고 일정을 짜는 것보다 낫다.
 *
 * ── 남의 서버다 ──────────────────────────────────────────────────
 * 호출은 훅 쪽 캐시(좌표쌍+수단)로 이미 줄어 있다. 트래픽이 늘면 자체
 * 호스팅으로 옮기는 게 맞다(Valhalla는 오픈소스).
 */

import type { TransportMode } from '@/domain/types';
import type { RouteProvider, RouteQuery, RouteResult } from '../types';
import { decodePolyline } from './polyline';

const ENDPOINT = 'https://valhalla1.openstreetmap.de/route';
const SOURCE = 'Valhalla (OSM)';
/** Valhalla의 shape는 정밀도 6이다 (구글 기본값 5가 아니다). */
const SHAPE_PRECISION = 6;

/** 우리 수단 이름 → Valhalla costing. transit은 여기 없다(데이터 없음). */
const COSTING: Partial<Record<TransportMode, string>> = {
  walk: 'pedestrian',
  car: 'auto',
};

interface ValhallaResponse {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: { shape?: string }[];
  };
}

/** 한 번만 다시 시도한다. 더 늘리면 실패한 구간마다 화면이 느려진다. */
async function fetchWithRetry(url: string): Promise<Response> {
  const first = await fetch(url);
  if (first.ok) return first;
  await new Promise((resolve) => setTimeout(resolve, 400));
  return fetch(url);
}

export const valhallaRouteProvider: RouteProvider = {
  id: 'valhalla-osm',
  label: 'Valhalla (OSM)',
  modes: ['walk', 'car'],

  async route({ from, to, mode }: RouteQuery): Promise<RouteResult> {
    const costing = COSTING[mode];
    if (!costing) {
      // 대중교통. 이 인스턴스에는 GTFS가 없다.
      return { available: false, mode, reason: 'no_transit_data', source: SOURCE };
    }

    const body = {
      locations: [
        { lat: from.lat, lon: from.lng },
        { lat: to.lat, lon: to.lng },
      ],
      costing,
      directions_options: { units: 'kilometers' },
    };

    try {
      /*
       * 한 번 더 시도한다. 공개 인스턴스는 같은 구간에서도 수단마다 결과가
       * 갈릴 만큼 간헐적으로 실패한다(도보는 되는데 차량만 안 오는 식).
       * 그 상태로 두면 "차량 정보 없음"이 남아 15시간짜리 도보가 추천으로
       * 올라온다. 한 번의 재시도로 대부분 사라진다.
       */
      const res = await fetchWithRetry(
        `${ENDPOINT}?json=${encodeURIComponent(JSON.stringify(body))}`,
      );
      if (!res.ok) {
        /*
         * 경로를 못 찾는 경우도 여기로 온다(섬과 육지 사이처럼 도로로 이어지지
         * 않는 구간). 실패를 0분으로 뭉개지 않고 '정보 없음'으로 돌린다.
         */
        return { available: false, mode, reason: 'lookup_failed', source: SOURCE };
      }

      const data = (await res.json()) as ValhallaResponse;
      const summary = data.trip?.summary;
      if (!summary || summary.time === undefined || summary.length === undefined) {
        return { available: false, mode, reason: 'lookup_failed', source: SOURCE };
      }

      const shape = data.trip?.legs?.[0]?.shape;

      return {
        available: true,
        mode,
        minutes: Math.max(1, Math.round(summary.time / 60)),
        // units가 kilometers라 km로 온다
        distanceM: Math.round(summary.length * 1000),
        polyline: shape ? decodePolyline(shape, SHAPE_PRECISION) : undefined,
        source: SOURCE,
      };
    } catch {
      // 오프라인이거나 공개 인스턴스가 죽은 경우
      return { available: false, mode, reason: 'lookup_failed', source: SOURCE };
    }
  },
};
