/**
 * 오프라인용 사본 — 마지막으로 불러온 여행 데이터와 계정.
 *
 * 여행지에서 제일 아쉬운 순간은 데이터가 안 터지는데 오늘 일정을 못 여는 때다.
 * 그래서 불러올 때마다 기기에 사본을 남기고, 켤 때는 사본을 먼저 보여준 뒤
 * 서버에서 새로 받는다. 서버가 안 되면 사본으로 버틴다.
 *
 * 사용자별로 따로 둔다 — 한 기기에서 다른 사람이 로그인하면 앞사람 여행이 보이면
 * 안 된다. 로그아웃하면 지운다(clearOfflineCache).
 *
 * 저장소가 막혀 있거나(사생활 보호 모드) 가득 차도 앱은 그대로 돌아야 하므로
 * 모든 읽기·쓰기를 감싼다. 사본이 없으면 오프라인 지원이 없던 때와 같다.
 */

import type { TripSnapshot } from './tripRepository';

const PREFIX = 'tt.offline.';
const SNAPSHOT_KEY = (userId: string) => `${PREFIX}trips.${userId}`;
const ACCOUNT_KEY = `${PREFIX}account`;

/** 모양이 바뀌면 올린다 — 옛 사본은 버리고 새로 받는다 */
const VERSION = 1;

interface Stored<T> {
  v: number;
  savedAt: string;
  data: T;
}

function read<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    return parsed.v === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T): void {
  try {
    const stored: Stored<T> = { v: VERSION, savedAt: new Date().toISOString(), data };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // 가득 찼거나 막혔다 — 이번엔 사본 없이 간다
  }
}

export function saveSnapshot(userId: string, snapshot: TripSnapshot): void {
  write(SNAPSHOT_KEY(userId), snapshot);
}

export function loadSnapshot(userId: string): TripSnapshot | null {
  return read<TripSnapshot>(SNAPSHOT_KEY(userId))?.data ?? null;
}

/** 계정 사본은 하나만 — 이 기기에서 마지막으로 로그인한 사람 */
export function saveAccount<T extends { id: string }>(account: T): void {
  write(ACCOUNT_KEY, account);
}

export function loadAccount<T extends { id: string }>(userId?: string): T | null {
  const data = read<T>(ACCOUNT_KEY)?.data ?? null;
  if (!data) return null;
  return userId === undefined || data.id === userId ? data : null;
}

/** 로그아웃 — 이 기기에 남은 여행 사본과 계정을 모두 지운다 */
export function clearOfflineCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // 지울 수 없으면 읽을 수도 없다
  }
}

/**
 * 네트워크 탓인 실패인지. 오프라인이면 사본으로 버티고, 그 밖의 실패(권한 등)는
 * 그대로 알린다 — 권한이 없어진 여행을 사본으로 계속 보여주면 안 된다.
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true; // fetch 실패
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /fetch|network|RetryableFetch|Load failed|timed? ?out/i.test(text);
}
