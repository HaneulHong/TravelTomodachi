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
import { decodePolyline } from './polyline';

const BASE = 'https://api.transitous.org/api';
/**
 * 새 버전부터 차례로 시도한다. 없는 버전이면 404가 오고 다음으로 넘어간다.
 *
 * ── v1을 쓰면 안 되는 이유 ────────────────────────────────────────
 * v1은 경로선을 정밀도 7로 인코딩하는데, MOTIS 문서에 "|경도| > 107.37이면
 * 정의되지 않음(오버플로)"이라고 적혀 있다. 한국(126~130)·일본(129~146)이
 * 정확히 그 범위다. 경로선이 엉뚱하게 그려지거나 아예 버려지던 원인이다.
 * v2부터 정밀도 6이라 문제가 없다.
 *
 * v4부터 displayName이 생겼다 — 화면에 보일 노선 이름('2호선', '472')은
 * 그걸 먼저 쓴다. routeShortName은 원천 데이터에 있을 때만 채워진다.
 */
const VERSIONS = ['v6', 'v5', 'v4', 'v2'] as const;
let versionIndex = 0;

const SOURCE = 'Transitous (OSM·GTFS)';
/** 응답이 precision을 안 줄 때의 기본값 — v2 이후는 6이다. */
const DEFAULT_PRECISION = 6;

/**
 * 정류장까지 걸어갈 수 있는 최대 시간(초). 기본값 15분은 여행자에게 짧다 —
 * 숙소·관광지에서 역까지 15분 넘게 걸리는 경우가 흔하고, 그러면 노선이
 * 있어도 "대중교통 없음"이 된다. 서버 설정이 더 작으면 서버 값으로 잘린다.
 */
const MAX_ACCESS_SEC = 1800;
/**
 * 출발 시각 뒤로 얼마 동안의 출발편까지 볼지(초). 기본값 15분이면 배차가
 * 30분인 버스, 하루 몇 편인 기차는 그 창에 안 걸려서 통째로 빠진다.
 */
const SEARCH_WINDOW_SEC = 2 * 3600;

/**
 * 이 직선거리보다 가까운데 대중교통 여정이 없으면 "데이터가 없는 지역"이
 * 아니라 "걸어가는 게 나은 거리"로 본다. 명동 호텔 → 명동교자(200m)에
 * "이 지역은 대중교통 데이터가 없습니다"를 띄우던 문제를 막는다.
 */
const SHORT_HOP_M = 2000;

/** 대중교통이 아닌 수단 — 이것만으로 된 여정은 대중교통 결과가 아니다. */
const STREET_MODES = new Set([
  'WALK',
  'BIKE',
  'RENTAL',
  'CAR',
  'HGV',
  'CAR_PARKING',
  'CAR_DROPOFF',
  'ODM',
  'RIDE_SHARING',
  'FLEX',
]);

interface MotisGeometry {
  points?: string;
  /** 인코딩 정밀도. 응답이 알려주므로 박아두지 않는다. */
  precision?: number;
}

export interface MotisLeg {
  mode?: string;
  duration?: number;
  distance?: number;
  legGeometry?: MotisGeometry;
  /** v4+: 화면용 노선 이름 */
  displayName?: string;
  /** '251' 같은 노선 번호 */
  routeShortName?: string;
  /** '제주도(제주연안)[제주]-목포(연안)[목포]' 같은 긴 이름 */
  routeLongName?: string;
  /** 열차 번호 같은 편 이름 ('KTX 012') */
  tripShortName?: string;
}

export interface MotisItinerary {
  duration?: number;
  startTime?: string;
  endTime?: string;
  transfers?: number;
  legs?: MotisLeg[];
}

export interface MotisPlan {
  itineraries?: MotisItinerary[];
}

function lengthOf(line: Coord[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i += 1) {
    total += haversineMeters(line[i - 1]!, line[i]!);
  }
  return total;
}

function isTransitLeg(leg: MotisLeg): boolean {
  return !!leg.mode && !STREET_MODES.has(leg.mode) && !leg.mode.startsWith('DEBUG_');
}

function timeOf(iso: string | undefined): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : Infinity;
}

/**
 * 여정 중 무엇을 고를지 — **가장 일찍 도착하는 것**.
 *
 * 전에는 대중교통이 낀 첫 번째 여정을 그대로 썼다. MOTIS는 출발 시각 순으로
 * 주기 때문에, 첫 번째가 "지금 바로 출발하지만 세 번 갈아타고 늦게 도착하는"
 * 여정인 경우가 많았다. 도착이 같으면 덜 갈아타는 쪽, 그다음 짧은 쪽.
 */
function pickBest(itineraries: MotisItinerary[]): MotisItinerary | undefined {
  let best: MotisItinerary | undefined;
  for (const it of itineraries) {
    if (it.duration === undefined) continue;
    if (!(it.legs ?? []).some(isTransitLeg)) continue;
    if (!best) {
      best = it;
      continue;
    }
    const a = timeOf(it.endTime);
    const b = timeOf(best.endTime);
    if (a !== b) {
      if (a < b) best = it;
      continue;
    }
    const ta = it.transfers ?? 0;
    const tb = best.transfers ?? 0;
    if (ta !== tb) {
      if (ta < tb) best = it;
      continue;
    }
    if (it.duration < best.duration!) best = it;
  }
  return best;
}

/**
 * 몇 분이 걸린다고 보여줄지.
 *
 * 출발 시각을 알면 **그때부터 도착까지**다. 다음 버스가 40분 뒤라면 그 기다림도
 * 일정에서는 이동 시간이다 — 탑승 시간만 보여주면 다음 일정에 늦는다.
 * 출발 시각을 모르면("지금") 여정 자체의 소요 시간.
 */
function minutesOf(it: MotisItinerary, departAt: string | undefined): number {
  let sec = it.duration!;
  const leave = departAt ? Date.parse(departAt) : NaN;
  const arrive = timeOf(it.endTime);
  if (Number.isFinite(leave) && Number.isFinite(arrive)) {
    sec = Math.max(sec, (arrive - leave) / 1000);
  }
  return Math.max(1, Math.round(sec / 60));
}

/** 응답 해석 — fetch와 떼어 두어 테스트에서 가짜 응답으로 돌린다. */
export function parsePlan(data: MotisPlan, query: RouteQuery): RouteResult {
  const { from, to, mode, departAt } = query;
  const best = pickBest(data.itineraries ?? []);

  if (!best) {
    /*
     * 걷기만 하는 여정은 대중교통 결과가 아니다. 그대로 채택하면 "대중교통
     * 40분"이 실은 도보 40분인 채로 표시되고, 도보 칸과 값이 겹친다.
     *
     * 없는 이유는 둘 중 하나다. 가까우면 걸어가는 게 나아서, 멀면 이 지역에
     * 대중교통 피드가 없어서(하노이처럼). 앞의 것에 "데이터 없는 지역" 경고를
     * 띄우면 서울 한복판에서도 경고가 뜬다.
     */
    const reason = haversineMeters(from, to) < SHORT_HOP_M ? 'no_transit_route' : 'no_transit_data';
    return { available: false, mode, reason, source: SOURCE };
  }

  const line: Coord[] = [];
  const lines: string[] = [];
  let distance = 0;
  for (const leg of best.legs ?? []) {
    // 도보는 노선이 아니다. 이름이 있는 구간만 모은다.
    if (isTransitLeg(leg)) {
      const name =
        leg.displayName || leg.routeShortName || leg.routeLongName || leg.tripShortName;
      // 같은 노선을 이어 타는 경우(연장 운행) 두 번 적지 않는다
      if (name && lines[lines.length - 1] !== name) lines.push(name);
    }
    const encoded = leg.legGeometry?.points;
    const shape = encoded
      ? decodePolyline(encoded, leg.legGeometry?.precision ?? DEFAULT_PRECISION)
      : [];
    line.push(...shape);
    // 대중교통 구간은 distance가 비어 오는 경우가 있어 좌표로 직접 잰다.
    distance += leg.distance ?? lengthOf(shape);
  }

  return {
    available: true,
    mode,
    minutes: minutesOf(best, departAt),
    distanceM: Math.round(distance),
    polyline: line.length > 1 ? line : undefined,
    lines: lines.length > 0 ? lines : undefined,
    source: SOURCE,
  };
}

export const transitousRouteProvider: RouteProvider = {
  id: 'transitous',
  label: 'Transitous',
  modes: ['transit'],

  async route(query: RouteQuery): Promise<RouteResult> {
    const { from, to, mode, departAt } = query;
    if (mode !== 'transit') {
      return { available: false, mode, reason: 'mode_not_supported_here', source: SOURCE };
    }

    const params = new URLSearchParams({
      fromPlace: `${from.lat},${from.lng}`,
      toPlace: `${to.lat},${to.lng}`,
      searchWindow: String(SEARCH_WINDOW_SEC),
      maxPreTransitTime: String(MAX_ACCESS_SEC),
      maxPostTransitTime: String(MAX_ACCESS_SEC),
    });
    // 시각을 주지 않으면 "지금" 기준이 된다. 몇 달 뒤 일정이면 엉뚱한 결과다.
    if (departAt) params.set('time', departAt);

    try {
      while (versionIndex < VERSIONS.length) {
        const res = await fetch(`${BASE}/${VERSIONS[versionIndex]}/plan?${params.toString()}`);
        // 서버가 아직 이 버전을 모른다 — 한 단계 낮춰서 다시
        if (res.status === 404 && versionIndex < VERSIONS.length - 1) {
          versionIndex += 1;
          continue;
        }
        if (!res.ok) {
          return { available: false, mode, reason: 'lookup_failed', source: SOURCE };
        }
        return parsePlan((await res.json()) as MotisPlan, query);
      }
      return { available: false, mode, reason: 'lookup_failed', source: SOURCE };
    } catch {
      return { available: false, mode, reason: 'lookup_failed', source: SOURCE };
    }
  },
};
