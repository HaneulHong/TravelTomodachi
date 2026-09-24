/**
 * 동선 최적화 — 하루 일정을 이동 거리가 가장 짧은 순서로.
 *
 * 길찾기 서버에 묻지 않고 **직선거리**로 계산한다. 장소 쌍마다 경로를 물으면
 * 요청이 수십 개가 되어 무료 서버의 제한에 걸린다. 직선거리는 강·바다를 돌아가는
 * 길에서 틀릴 수 있어서 화면은 "제안"으로 보여 주고 사람이 적용한다.
 *
 * ── 옮기지 않는 일정(고정점) ─────────────────────────────────────
 *   그 날 첫 일정 — 보통 숙소·공항처럼 하루가 시작되는 곳
 *   구간 일정(항공·기차·버스·배) — 시각에 묶여 있다
 *   좌표가 없는 일정 — 어디인지 모르니 거리를 잴 수 없다
 * 고정점 사이의 방문 일정끼리만 순서를 바꾼다. 앞 고정점에서 출발해 다음 고정점에
 * 도착하는 경로(마지막 구간이면 끝이 열린 경로)를 짧게 만든다.
 */

import { haversineMeters } from './geo';
import type { Coord, ItemKind } from './types';

export interface RoutePoint {
  id: string;
  kind: ItemKind;
  coord?: Coord;
  /** 구간 일정이면 도착 지점 — 다음 일정은 여기서 출발한다 */
  toCoord?: Coord;
}

export interface OptimizeResult {
  /** 새 순서(id). 바뀌지 않았으면 원래 순서 그대로. */
  order: string[];
  /** 직선거리 합(m) */
  before: number;
  after: number;
}

/** 이 개수까지는 모든 순서를 다 본다(8! = 40,320). 넘으면 가까운 곳부터 + 2-opt. */
const EXACT_LIMIT = 8;

function pathLength(start: Coord | undefined, pts: readonly Coord[], end: Coord | undefined): number {
  let sum = 0;
  let prev = start;
  for (const p of pts) {
    if (prev) sum += haversineMeters(prev, p);
    prev = p;
  }
  if (prev && end) sum += haversineMeters(prev, end);
  return sum;
}

function* permutations(n: number): Generator<number[]> {
  const a = [...Array(n).keys()];
  const c = new Array<number>(n).fill(0);
  yield a.slice();
  let i = 0;
  while (i < n) {
    if (c[i]! < i) {
      const j = i % 2 === 0 ? 0 : c[i]!;
      [a[j], a[i]] = [a[i]!, a[j]!];
      yield a.slice();
      c[i]! += 1;
      i = 0;
    } else {
      c[i] = 0;
      i += 1;
    }
  }
}

/** 한 구간(고정점 사이) 안의 최단 순서. 인덱스 배열을 돌려준다. */
function bestOrder(start: Coord | undefined, pts: readonly Coord[], end: Coord | undefined): number[] {
  const n = pts.length;
  if (n <= 1) return [...Array(n).keys()];

  if (n <= EXACT_LIMIT) {
    let best = [...Array(n).keys()];
    let bestLen = pathLength(start, best.map((i) => pts[i]!), end);
    for (const perm of permutations(n)) {
      const len = pathLength(start, perm.map((i) => pts[i]!), end);
      // 거의 같으면 원래 순서를 지킨다 — 의미 없는 뒤섞임을 막는다
      if (len < bestLen - 1) {
        best = perm;
        bestLen = len;
      }
    }
    return best;
  }

  // 많으면: 가까운 곳부터 고른 뒤 2-opt로 꼬인 곳을 푼다
  const left = new Set([...Array(n).keys()]);
  const order: number[] = [];
  let cur = start ?? pts[0]!;
  while (left.size) {
    let pick = -1;
    let d = Infinity;
    for (const i of left) {
      const di = haversineMeters(cur, pts[i]!);
      if (di < d) [pick, d] = [i, di];
    }
    order.push(pick);
    left.delete(pick);
    cur = pts[pick]!;
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i += 1) {
      for (let k = i + 1; k < n; k += 1) {
        const cand = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        if (
          pathLength(start, cand.map((x) => pts[x]!), end) <
          pathLength(start, order.map((x) => pts[x]!), end) - 1
        ) {
          order.splice(0, n, ...cand);
          improved = true;
        }
      }
    }
  }
  return order;
}

/** 전체 경로 길이 — 구간 일정은 출발지까지 와서 도착지로 건너간다(그 사이는 세지 않는다) */
function totalLength(points: readonly RoutePoint[]): number {
  let sum = 0;
  let prev: Coord | undefined;
  for (const p of points) {
    if (p.coord && prev) sum += haversineMeters(prev, p.coord);
    prev = p.toCoord ?? p.coord ?? prev;
  }
  return sum;
}

export function optimizeDay(points: readonly RoutePoint[]): OptimizeResult {
  const movable = (p: RoutePoint, i: number) => i > 0 && p.kind === 'place' && Boolean(p.coord);
  const out: RoutePoint[] = [];

  let i = 0;
  while (i < points.length) {
    if (!movable(points[i]!, i)) {
      out.push(points[i]!);
      i += 1;
      continue;
    }
    // 연달아 옮길 수 있는 일정 묶음
    const run: RoutePoint[] = [];
    while (i < points.length && movable(points[i]!, i)) run.push(points[i++]!);
    const before = out[out.length - 1];
    const start = before?.toCoord ?? before?.coord;
    const end = points[i]?.coord;
    const order = bestOrder(start, run.map((p) => p.coord!), end);
    out.push(...order.map((k) => run[k]!));
  }

  return { order: out.map((p) => p.id), before: totalLength(points), after: totalLength(out) };
}
