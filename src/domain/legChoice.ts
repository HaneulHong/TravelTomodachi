/**
 * 구간의 이동 수단·시간을 무엇으로 보여줄지.
 *
 * 세 가지 상태가 있다.
 *   1. 아무것도 안 고름   → 추천 수단, 그 수단의 조회 시간
 *   2. 수단만 고름        → 고른 수단, 그 수단의 **조회 시간** (조회가 바뀌면 따라간다)
 *   3. 시간을 직접 고침   → 고른 수단, 적어 둔 시간 (조회로 덮어쓰지 않는다)
 *
 * 전에는 수단을 누르기만 해도 3번이 되어, 조회 결과가 더는 반영되지 않았다.
 * 누를 때의 숫자(대개 처음 추천된 차량 시간)가 박제되고, 수단 비교 칸도
 * '조회 중'에 멈춰 있었다.
 */

import type { Leg, TransportMode } from './types';

/** 수단별 조회 결과에서 여기 필요한 것만 */
export type ModeMinutes = Partial<Record<TransportMode, number | undefined>>;

/**
 * 이보다 긴 도보는 추천하지 않는다.
 *
 * 다른 수단 조회가 실패하면 도보만 남는데, 그대로 두면 "도보 15시간 7분"이
 * 추천으로 올라온다. 이럴 때는 추천을 비워 '이동 정보 없음 · 탭해서 입력'으로
 * 떨어뜨린다. (값 자체는 수단 비교 칸에 그대로 보여준다.)
 */
export const WALK_RECOMMEND_LIMIT_MIN = 120;

/** 이 안쪽이면 대중교통이 조금 빨라도 도보를 고른다 — 갈아타고 기다리는 번거로움 */
const WALK_PREFERRED_MIN = 20;
const WALK_BONUS_MIN = 5;

/**
 * 자동 추천. 여행자는 대개 차가 없다 — **도보·대중교통 중에서** 고르고,
 * 둘 다 없을 때만 차량(택시)을 추천한다.
 *
 * 전에는 셋 중 가장 빠른 걸 골라서 도심에서도 거의 늘 차량이 추천됐다
 * (명동 → 경복궁: 도보 36분, 대중교통 25분, 차량 11분 → 차량).
 */
export function recommendMode(minutes: ModeMinutes): TransportMode | undefined {
  let best: { mode: TransportMode; score: number } | undefined;
  const walk = minutes.walk;
  if (walk !== undefined && walk <= WALK_RECOMMEND_LIMIT_MIN) {
    best = { mode: 'walk', score: walk <= WALK_PREFERRED_MIN ? walk - WALK_BONUS_MIN : walk };
  }
  const transit = minutes.transit;
  if (transit !== undefined && (!best || transit < best.score)) {
    best = { mode: 'transit', score: transit };
  }
  if (best) return best.mode;
  return minutes.car !== undefined ? 'car' : undefined;
}

/** 화면에 보일 수단과 시간. 시간을 모르면 minutes가 비어 있다. */
export function effectiveLeg(
  leg: Leg | undefined,
  minutes: ModeMinutes,
): { mode?: TransportMode; minutes?: number; manual: boolean } {
  if (leg?.isManual) return { mode: leg.mode, minutes: leg.minutes, manual: true };
  if (leg) {
    // 수단만 고른 경우 — 조회 시간을 따라가고, 조회가 안 되면 고를 때의 시간
    return { mode: leg.mode, minutes: minutes[leg.mode] ?? leg.minutes, manual: false };
  }
  const mode = recommendMode(minutes);
  return { mode, minutes: mode ? minutes[mode] : undefined, manual: false };
}
