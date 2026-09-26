/**
 * 보내지 못한 변경 — 오프라인에서 고친 것을 기기에 모아 뒀다가 연결되면 보낸다.
 *
 * 전에는 인터넷이 끊긴 채 고치면 저장이 실패해 되돌아갔다. 해외 지하철·데이터 없는
 * 곳에서 일정을 고치는 게 여행 중 가장 흔한 순간인데 그때 고친 게 사라졌다.
 *
 * 흐름 (store/tripStore.ts의 send):
 *   1) 화면은 전처럼 바로 바뀐다(낙관적 업데이트)
 *   2) 보내다가 **네트워크 탓으로** 실패하면 되돌리지 않고 여기 쌓는다
 *   3) 이미 쌓인 게 있으면 새 변경도 뒤에 쌓는다 — 순서가 바뀌면 "추가 → 수정"이
 *      "수정 → 추가"가 되어 수정이 사라진다
 *   4) 연결되면(online 이벤트, 앱을 다시 열 때) 쌓인 순서대로 보낸다
 *
 * 네트워크가 아닌 실패(권한이 없어졌다, 지워진 일정에 댓글 등)는 그 변경을 버리고
 * 알린다. 서버 것을 다시 받아 화면을 맞춘다.
 *
 * 같은 칸을 그사이 친구가 고쳤으면 나중에 보낸 쪽(내 것)이 남는다. 칸 단위로만
 * 보내므로(patch) 다른 칸을 고친 건 그대로다.
 *
 * 사용자별로 둔다. 로그아웃하면 사본과 함께 지워진다(clearOfflineCache, 같은 접두어).
 */

import type { TripRepository } from './tripRepository';

/** 오프라인에서도 쌓아 둘 수 있는 변경. 여행 만들기·참가·삭제는 서버가 있어야 한다. */
export type OutboxMethod =
  | 'addItem'
  | 'updateItem'
  | 'removeItem'
  | 'updateDays'
  | 'addChecklistItem'
  | 'updateChecklistItem'
  | 'removeChecklistItem'
  | 'addExpense'
  | 'updateExpense'
  | 'removeExpense'
  | 'addPlace'
  | 'removePlace'
  | 'setVote'
  | 'addComment'
  | 'removeComment';

export type OutboxArgs<M extends OutboxMethod> = Parameters<TripRepository[M]>;

export interface OutboxOp {
  method: OutboxMethod;
  /** JSON으로 저장된 인자 (encodeArgs) */
  args: unknown[];
  /** 쌓은 시각 — 화면에 "몇 분 전부터"를 보일 때 */
  at: string;
}

const KEY = (userId: string) => `tt.offline.outbox.${userId}`;
const VERSION = 1;

/**
 * 고친 칸만 보내는 변경(patch)에서 "지웠다"는 undefined로 온다. JSON은 undefined 칸을
 * 버려서, 그대로 저장하면 "이동 시간 지우기"가 "아무것도 안 바꿈"이 된다.
 * 저장소가 이 두 가지는 `'칸' in patch`로 보고 없으면 null로 쓰므로(toItemRow ·
 * toExpenseRow) undefined를 null로 바꿔 칸을 남긴다.
 * 날짜 변경(updateDays)은 반대로 undefined를 "안 바꿈"으로 읽으니 건드리지 않는다.
 */
const KEEP_EMPTY: ReadonlySet<OutboxMethod> = new Set(['updateItem', 'updateExpense']);

export function encodeArgs(method: OutboxMethod, args: unknown[]): unknown[] {
  const text = KEEP_EMPTY.has(method)
    ? JSON.stringify(args, (_k, v: unknown) => (v === undefined ? null : v))
    : JSON.stringify(args);
  return JSON.parse(text) as unknown[];
}

/**
 * 보낸 줄 몰랐는데 사실 서버에 들어갔던 경우 — 응답만 끊겼다. 다시 보내면 "이미 있다"로
 * 실패한다. 추가·표 넣기는 id가 같으니 이미 된 것으로 본다.
 */
export function alreadyApplied(method: OutboxMethod, err: unknown): boolean {
  if (!(method.startsWith('add') || method === 'setVote')) return false;
  const text = err instanceof Error ? err.message : String(err);
  return /duplicate key|already exists|23505/i.test(text);
}

interface Stored {
  v: number;
  ops: OutboxOp[];
}

export function readOutbox(userId: string): OutboxOp[] {
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    return parsed.v === VERSION && Array.isArray(parsed.ops) ? parsed.ops : [];
  } catch {
    return [];
  }
}

function writeOutbox(userId: string, ops: OutboxOp[]): void {
  try {
    if (ops.length === 0) localStorage.removeItem(KEY(userId));
    else localStorage.setItem(KEY(userId), JSON.stringify({ v: VERSION, ops } satisfies Stored));
  } catch {
    // 저장소가 막혔다 — 메모리에 있는 동안만 버틴다(아래 memory)
  }
}

/**
 * 저장소가 막혀 있어도(사생활 보호 모드) 앱을 켜 둔 동안은 쌓아 두게 메모리에도 든다.
 * 읽기는 늘 메모리 먼저.
 */
const memory = new Map<string, OutboxOp[]>();

export function pendingOps(userId: string): OutboxOp[] {
  if (!memory.has(userId)) memory.set(userId, readOutbox(userId));
  return memory.get(userId)!;
}

export function enqueue<M extends OutboxMethod>(userId: string, method: M, args: OutboxArgs<M>): void {
  const ops = [...pendingOps(userId), { method, args: encodeArgs(method, args), at: new Date().toISOString() }];
  memory.set(userId, ops);
  writeOutbox(userId, ops);
}

function dropFirst(userId: string): void {
  const ops = pendingOps(userId).slice(1);
  memory.set(userId, ops);
  writeOutbox(userId, ops);
}

/** 로그아웃 — 메모리에 든 것도 비운다(저장된 건 clearOfflineCache가 지운다) */
export function forgetOutbox(): void {
  memory.clear();
}

export interface FlushResult {
  sent: number;
  /** 서버가 받지 않아 버린 변경 수 (권한·지워진 대상 등) */
  dropped: number;
  /** 버린 이유 중 첫 번째 — 화면에 띄운다 */
  firstError?: string;
  /** 네트워크가 또 끊겨 멈췄는지. 남은 건 다음에 보낸다. */
  stalled: boolean;
}

let flushing: Promise<FlushResult> | null = null;

/**
 * 쌓인 순서대로 보낸다. 동시에 두 번 돌지 않는다(두 번째 부름은 첫 번째를 기다린다).
 * isNetworkError로 네트워크 탓인지 가른다.
 */
export function flushOutbox(
  userId: string,
  repository: TripRepository,
  isNetworkError: (err: unknown) => boolean,
): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { sent: 0, dropped: 0, stalled: false };
    for (;;) {
      const op = pendingOps(userId)[0];
      if (!op) break;
      try {
        const call = repository[op.method] as (...a: unknown[]) => Promise<unknown>;
        await call.apply(repository, op.args);
        result.sent += 1;
      } catch (err: unknown) {
        if (isNetworkError(err)) {
          result.stalled = true;
          break;
        }
        if (alreadyApplied(op.method, err)) {
          result.sent += 1;
        } else {
          result.dropped += 1;
          result.firstError ??= err instanceof Error ? err.message : String(err);
        }
      }
      dropFirst(userId);
    }
    return result;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
