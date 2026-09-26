/**
 * 이 여행을 마지막으로 본 때 — 그 뒤에 친구가 바꾼 일정에 "새로" 표시를 단다.
 *
 * 기기에만 둔다. 서버에 두면 기기마다 본 때가 섞이고, 표 하나를 더 만들 만큼 중요한
 * 정보가 아니다. 접두어가 오프라인 사본과 같아(tt.offline.) 로그아웃하면 함께 지워진다.
 */

const KEY = (userId: string, tripId: string) => `tt.offline.seen.${userId}.${tripId}`;

/** 마지막으로 본 때(ISO). 처음이면 null — 처음 여는 여행에 전부 "새로"를 달면 소음이다. */
export function readSeen(userId: string, tripId: string): string | null {
  try {
    return localStorage.getItem(KEY(userId, tripId));
  } catch {
    return null;
  }
}

export function markSeen(userId: string, tripId: string, at = new Date().toISOString()): void {
  try {
    localStorage.setItem(KEY(userId, tripId), at);
  } catch {
    // 저장소가 막혔다 — 표시만 못 한다
  }
}

/** 남이 내가 마지막으로 본 뒤에 고친(또는 넣은) 일정인지 */
export function changedSince(
  item: { updatedBy?: string; updatedAt?: string },
  me: string,
  seenAt: string | null,
): boolean {
  if (!seenAt || !item.updatedBy || !item.updatedAt) return false;
  return item.updatedBy !== me && item.updatedAt > seenAt;
}
