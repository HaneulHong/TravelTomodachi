/**
 * 외부 지도/길찾기 서비스 추상화.
 *
 * 왜 인터페이스가 세 개인가: 전세계를 대상으로 하면 경로만 갈리는 게 아니다.
 *
 *   지역      경로                              장소검색      지도 타일
 *   ───────────────────────────────────────────────────────────────────
 *   GLOBAL   Google Directions                 Google Places  Google Maps JS
 *   KR       카카오모빌리티(차량·도보)         카카오 로컬    카카오맵 JS
 *            Tmap / 공공데이터 TAGO(대중교통)
 *
 * 한국이 예외인 이유: Google은 한국 내 자동차·도보 길찾기를 제공하지 않는다
 * (측량법상 지도 데이터 국외 반출 제한). 대중교통만 된다.
 *
 * 그리고 GLOBAL이라고 다 되는 것도 아니다. Google 대중교통은 교통 당국이
 * GTFS 피드를 제공하는 도시만 커버한다 — 동남아·인도·아프리카·남미에
 * 상당한 공백이 있다. 그래서 RouteResult는 "없음"을 1급 결과로 다룬다.
 */

import type { Coord, TransportMode } from '@/domain/types';

export interface RouteQuery {
  from: Coord;
  to: Coord;
  mode: TransportMode;
  /**
   * 출발 시점(ISO). 대중교통에만 의미가 있다 — 버스·지하철 시간표는 그
   * 순간을 기준으로 갈리고, 주지 않으면 "지금"이 되어 몇 달 뒤 일정에
   * 엉뚱한 결과가 나온다. 도보·차량은 무시한다.
   */
  departAt?: string;
}

export interface RouteFound {
  available: true;
  mode: TransportMode;
  minutes: number;
  distanceM: number;
  /** 지도에 그릴 경로선. 목 구현에서는 비어 있다. */
  polyline?: Coord[];
  /** 'Google Directions' 같은 표시용 출처 */
  source: string;
}

export type RouteUnavailableReason =
  /** 이 지역에 대중교통 데이터 자체가 없다 (GTFS 피드 미제공) */
  | 'no_transit_data'
  /** 해당 지역에서 이 프로바이더가 이 수단을 제공하지 않는다 (예: 한국 내 Google 차량) */
  | 'mode_not_supported_here'
  /** 좌표가 없어서 조회 자체가 불가 */
  | 'missing_coordinates'
  /**
   * 조회는 시도했으나 결과를 받지 못했다 (네트워크 실패, 도로로 이어지지
   * 않는 구간 등). 0분으로 뭉개지 않고 이 상태로 남긴다.
   */
  | 'lookup_failed';

export interface RouteUnavailable {
  available: false;
  mode: TransportMode;
  reason: RouteUnavailableReason;
  source: string;
}

export type RouteResult = RouteFound | RouteUnavailable;

export interface RouteProvider {
  readonly id: string;
  readonly label: string;
  /** 이 프로바이더가 원리상 다룰 수 있는 수단. 실제 가용성은 route()가 판단. */
  readonly modes: readonly TransportMode[];
  route(query: RouteQuery): Promise<RouteResult>;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  /**
   * 자동완성 단계에서는 없을 수 있다.
   *
   * Google은 후보 목록에 좌표를 주지 않는다 — 좌표는 상세 조회에서 나오고,
   * 그게 별도 과금이다. 목록에 뜬 10개를 전부 조회하면 9개는 버리는 돈이
   * 되므로, 고른 하나만 resolve()로 채운다.
   */
  coord?: Coord;
}

export interface PlaceProvider {
  readonly id: string;
  readonly label: string;
  search(query: string, near?: Coord): Promise<Place[]>;
  /** 후보를 고른 뒤 좌표를 채워 돌려준다. 이미 있으면 그대로 돌려준다. */
  resolve(place: Place): Promise<Place>;
}

// 지도 렌더러는 './maps'로 옮겼다. SDK를 실제로 붙이면서 명령형 핸들
// (mount / setStops / fit / destroy)이 필요해졌고, 지역 판정 규칙도
// 길찾기와 달라졌기 때문이다. — providers/maps/index.ts 주석 참고
