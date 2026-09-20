/**
 * 대중교통 길찾기 — Transitous (MOTIS 엔진, 전 세계 GTFS 통합).
 *
 * ── TAGO를 못 쓴 이유 ─────────────────────────────────────────────
 * TAGO(국가대중교통정보센터)는 **길찾기 API가 없다.** 정류소·노선·도착정보
 * 같은 원천 데이터만 내려주고, 네이버·카카오가 그걸로 각자 경로 탐색기를
 * 만든다. 두 지점 사이 경로를 받아올 방법이 없어서 이 앱에는 붙일 수 없다.
 * (게다가 data.go.kr 키는 REST 키라 클라이언트에 두면 그대로 노출된다.)
 *
 * ── Transitous가 국내·해외를 한꺼번에 덮는다 ──────────────────────
 * 전 세계 GTFS 피드를 모아 하나의 공개 API로 서비스한다. 무료, 키 불필요.
 * 실제로 확인한 커버리지:
 *   서울·제주 ○   도쿄 ○   방콕 ○   하노이 ✗
 * 하노이가 비어 있는 건 이 앱이 원래 상정한 "대중교통 데이터 없는 도시"
 * 케이스 그대로다 — 추정값을 만들지 않고 '정보 없음'으로 돌려준다.
 *
 * ── 사용 조건 ─────────────────────────────────────────────────────
 * 오픈소스·비상업·가벼운 사용이어야 하고, User-Agent(브라우저면 Referer)와
 * 출처 표시를 요구한다. 브라우저가 Referer를 자동으로 붙이므로 따로 헤더를
 * 넣지 않는다 — fetch에서 User-Agent는 어차피 설정할 수 없다.
 */

import { haversineMeters } from '@/domain/geo';
import type { Coord } from '@/domain/types';
import type { RouteProvider, RouteQuery, RouteResult } from '../types';

const ENDPOINT = 'https://api.transitous.org/api/v1/plan';
const SOURCE = 'Transitous (OSM·GTFS)';

interface MotisGeometry {
  points?: string;
  /** 인코딩 정밀도. 응답이 알려주므로 박아두지 않는다. */
  precision?: number;
}

interface MotisLeg {
  mode?: string;
  duration?: number;
  distance?: number;
  legGeometry?: MotisGeometry;
}

interface MotisItinerary {
  duration?: number;
  legs?: MotisLeg[];
}

/** encoded polyline 해독. 정밀도는 응답이 준 값을 쓴다. */
function decodePolyline(encoded: string, precision: number): Coord[] {
  const factor = 10 ** precision;
  const points: Coord[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}

function lengthOf(line: Coord[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i += 1) {
    total += haversineMeters(line[i - 1]!, line[i]!);
  }
  return total;
}

export const transitousRouteProvider: RouteProvider = {
  id: 'transitous',
  label: 'Transitous',
  modes: ['transit'],

  async route({ from, to, mode, departAt }: RouteQuery): Promise<RouteResult> {
    if (mode !== 'transit') {
      return { available: false, mode, reason: 'mode_not_supported_here', source: SOURCE };
    }

    const params = new URLSearchParams({
      fromPlace: `${from.lat},${from.lng}`,
      toPlace: `${to.lat},${to.lng}`,
    });
    // 시각을 주지 않으면 "지금" 기준이 된다. 몇 달 뒤 일정이면 엉뚱한 결과다.
    if (departAt) params.set('time', departAt);

    try {
      const res = await fetch(`${ENDPOINT}?${params.toString()}`);
      if (!res.ok) {
        return { available: false, mode, reason: 'lookup_failed', source: SOURCE };
      }

      const data = (await res.json()) as { itineraries?: MotisItinerary[] };
      const itineraries = data.itineraries ?? [];

      /*
       * 걷기만 하는 여정은 대중교통 결과가 아니다. 그대로 채택하면 "대중교통
       * 40분"이 실은 도보 40분인 채로 표시되고, 도보 칸과 값이 겹친다.
       */
      const withTransit = itineraries.find((it) =>
        (it.legs ?? []).some((leg) => leg.mode && leg.mode !== 'WALK'),
      );

      if (!withTransit || withTransit.duration === undefined) {
        // 이 지역에 대중교통 피드가 없다 — 앱이 이미 다루는 상태다.
        return { available: false, mode, reason: 'no_transit_data', source: SOURCE };
      }

      const line: Coord[] = [];
      let distance = 0;
      for (const leg of withTransit.legs ?? []) {
        const encoded = leg.legGeometry?.points;
        const shape = encoded
          ? decodePolyline(encoded, leg.legGeometry?.precision ?? 5)
          : [];
        line.push(...shape);
        // 대중교통 구간은 distance가 비어 오는 경우가 있어 좌표로 직접 잰다.
        distance += leg.distance ?? lengthOf(shape);
      }

      return {
        available: true,
        mode,
        minutes: Math.max(1, Math.round(withTransit.duration / 60)),
        distanceM: Math.round(distance),
        polyline: line.length > 1 ? line : undefined,
        source: SOURCE,
      };
    } catch {
      return { available: false, mode, reason: 'lookup_failed', source: SOURCE };
    }
  },
};
