/**
 * 일정 순서 바꾸기에 쓰는 계산. React·저장소와 무관한 순수 함수.
 */

/**
 * 순서를 바꾼 뒤 **앞 일정이 달라진** 항목들.
 *
 * 직접 입력한 이동 시간(leg)은 "앞 일정에서 여기까지"의 값이다. 순서가 바뀌어
 * 앞 일정이 달라지면 그 값은 다른 구간의 것이 된다 — 호텔→공항에 적어둔 40분이
 * 공항→호텔 앞에 붙어 있으면 틀린 정보를 믿게 된다. 이 목록의 항목은 직접 입력
 * 값을 지워 다시 길찾기로 계산하게 한다.
 *
 * 전에 없던 항목(다른 날에서 옮겨 온 것)도 앞 일정이 새로 생긴 것으로 본다.
 */
export function predecessorsChanged(before: readonly string[], after: readonly string[]): string[] {
  const prevBefore = new Map<string, string | null>();
  before.forEach((id, i) => prevBefore.set(id, i > 0 ? before[i - 1]! : null));

  return after.filter((id, i) => {
    const prev = i > 0 ? after[i - 1]! : null;
    return !prevBefore.has(id) || prevBefore.get(id) !== prev;
  });
}

/**
 * 끌고 있는 항목이 놓일 자리(옮긴 뒤의 최종 인덱스 — keyForMove와 같은 규약).
 *
 * 나머지 항목 중 가운데가 끌고 있는 항목의 가운데보다 위에 있는 개수가 곧 자리다.
 * centers는 끌기 시작할 때 잰 각 항목의 세로 가운데(원래 순서).
 */
export function dropIndex(centers: readonly number[], from: number, draggedCenter: number): number {
  let index = 0;
  centers.forEach((c, i) => {
    if (i !== from && c < draggedCenter) index += 1;
  });
  return index;
}

/** from을 to로 옮긴 뒤의 순서 (splice 규약) */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const [picked] = out.splice(from, 1);
  if (picked === undefined) return out;
  out.splice(to, 0, picked);
  return out;
}

/**
 * 앞 일정보다 이른 시각인지. 순서를 바꾸거나 다른 날에서 옮겨 오면 생긴다.
 *
 * 시각이 없는 일정은 건너뛰고, 앞쪽에서 가장 늦은 시각과 비교한다. 자정을 넘기는
 * 일정(22:00 다음 01:30)도 걸리므로 화면은 고치라고 강요하지 않고 알려만 준다.
 * 시각은 'HH:MM'이라 문자열 비교로 충분하다.
 */
export function timeConflicts(times: readonly (string | undefined)[]): boolean[] {
  let latest: string | undefined;
  return times.map((t) => {
    if (!t) return false;
    const conflict = latest !== undefined && t < latest;
    if (latest === undefined || t > latest) latest = t;
    return conflict;
  });
}

/**
 * 시각순으로 정렬한 순서(id 목록).
 * 시각이 없는 일정은 제자리에 두고, 시각이 있는 일정끼리만 그 자리들 안에서 정렬한다.
 * 같은 시각이면 원래 순서를 지킨다.
 */
export function timeSortedOrder(items: readonly { id: string; localTime?: string }[]): string[] {
  const timed = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => item.localTime)
    .sort((a, b) =>
      a.item.localTime! < b.item.localTime! ? -1 : a.item.localTime! > b.item.localTime! ? 1 : a.i - b.i,
    );
  let next = 0;
  return items.map((item) => (item.localTime ? timed[next++]!.item.id : item.id));
}
