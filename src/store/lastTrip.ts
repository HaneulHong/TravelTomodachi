/**
 * 이번에 앱을 켠 동안 마지막으로 본 여행.
 *
 * 여행을 보다가 홈에 들렀다 일정 탭을 누르면 보던 여행으로 돌아가야 한다 —
 * 다가오는 여행으로 가 버리면 탭이 엉뚱한 곳을 연다. 기기에 저장하지 않는다
 * (앱을 새로 켜면 domain/today.ts의 focusTrip이 고른다).
 */

let last: string | null = null;

export function rememberTrip(tripId: string): void {
  last = tripId;
}

export function lastTripId(): string | null {
  return last;
}
