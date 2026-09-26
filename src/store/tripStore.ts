/**
 * 앱 상태.
 *
 * 저장소(data/)에서 한 번 읽어와 메모리에 들고 있고, 편집은 **낙관적
 * 업데이트**로 처리한다:
 *
 *   1) 로컬 상태를 먼저 바꿔 화면에 즉시 반영한다
 *   2) 저장소에 보낸다
 *   3) 실패하면 되돌리고 무엇이 실패했는지 남긴다
 *
 * 왜 기다리지 않나: 일정을 짜는 동안은 한 항목을 고치고 바로 다음 항목으로
 * 넘어간다. 저장을 기다리면 그 리듬이 매번 끊긴다. 대신 실패를 숨기지
 * 않는다 — 되돌린 사실과 이유를 화면에 띄운다.
 *
 * sortKey가 fractional index라, 나중에 realtime을 붙여 남의 변경을 병합해도
 * 순서 충돌이 나지 않는다.
 */

import { create } from 'zustand';
import { getTripRepository, type DayPatch, type RemoteChange } from '@/data';
import { isNetworkError, loadSnapshot, saveSnapshot } from '@/data/offlineCache';
import {
  enqueue,
  flushOutbox,
  pendingOps,
  type OutboxArgs,
  type OutboxMethod,
} from '@/data/outbox';
import { bySortKey, keyBetween, keyForMove } from '@/domain/fractionalIndex';
import { moved, predecessorsChanged } from '@/domain/order';
import type {
  ChecklistItem,
  Comment,
  Expense,
  Item,
  Leg,
  Place,
  PlaceVote,
  TransportMode,
  Trip,
  TripDay,
} from '@/domain/types';
import { getMessages } from '@/i18n/store';

const repository = getTripRepository();

/** 낙관적 업데이트를 되돌릴 때 쓰는 이전 상태 */
interface Rollback {
  items?: Item[];
  checklist?: ChecklistItem[];
  trips?: Trip[];
  expenses?: Expense[];
  places?: Place[];
  votes?: PlaceVote[];
  comments?: Comment[];
}

interface TripState {
  currentUserId: string;
  trips: Trip[];
  items: Item[];
  checklist: ChecklistItem[];
  expenses: Expense[];
  /** 가계부 테이블이 있는지 (TripSnapshot.expensesAvailable) */
  expensesAvailable: boolean;
  places: Place[];
  votes: PlaceVote[];
  comments: Comment[];
  /** 후보 장소·댓글 테이블이 있는지 (TripSnapshot.collabAvailable) */
  collabAvailable: boolean;

  /** 첫 로드가 끝났는지. 끝나기 전에 "여행이 없습니다"를 띄우면 안 된다. */
  loading: boolean;
  /** 저장에 실패한 이유. 화면이 띄우고 사용자가 닫는다. */
  error: string | null;
  /**
   * 서버에서 못 받아 기기에 남은 사본을 보여주는 중인지 (data/offlineCache.ts).
   * 켜져 있으면 화면이 "마지막으로 불러온 일정"이라고 알린다.
   */
  fromCache: boolean;
  /**
   * 연결이 없어 아직 못 보낸 변경 수 (data/outbox.ts). 화면이 "연결되면 보냅니다"라고
   * 알린다. 0이면 다 보냈다.
   */
  pending: number;
  /** 쌓인 변경을 보내는 중 */
  syncing: boolean;

  load(userId: string): Promise<void>;
  /** 쌓인 변경을 지금 보낸다(연결이 돌아왔을 때). 다 보내면 서버 것을 다시 받는다. */
  sync(): Promise<void>;
  clearError(): void;
  /**
   * 다른 사람의 변경을 반영한다. 돌려준 함수로 구독을 끊는다.
   * 내 편집도 서버를 한 바퀴 돌아 여기로 돌아오는데, id를 클라이언트에서
   * 만들기 때문에 같은 항목으로 합쳐지고 두 번 생기지 않는다.
   */
  subscribe(): () => void;

  // ── 조회 ────────────────────────────────────────────────────────
  getTrip(tripId: string): Trip | undefined;
  getDay(tripId: string, date: string): TripDay | undefined;
  /** 그 날의 항목을 정렬 키 순으로 */
  getDayItems(tripId: string, date: string): Item[];
  getItem(itemId: string): Item | undefined;
  getChecklist(tripId: string): ChecklistItem[];

  // ── 변경 ────────────────────────────────────────────────────────
  /** 사용자가 이동수단/시간을 직접 지정 → isManual이 켜진다 */
  setLegManually(itemId: string, mode: TransportMode, minutes: number): void;
  /**
   * 이동 수단만 고른다. 시간은 그 수단의 조회 결과를 따라간다(minutes는 조회가
   * 안 될 때 보여줄 마지막 값). 수단을 눌렀다고 시간이 박제되면 안 된다.
   */
  setLegMode(itemId: string, mode: TransportMode, minutes: number): void;
  /** 수동 지정을 해제하고 다시 자동 조회 대상으로 돌린다 */
  clearManualLeg(itemId: string): void;
  updateItem(itemId: string, patch: Partial<Omit<Item, 'id' | 'tripId'>>): void;
  /**
   * 같은 날 안에서 순서를 바꾼다. to는 옮긴 뒤의 최종 인덱스.
   * 앞 일정이 바뀐 항목의 직접 입력 이동 시간은 지운다(domain/order.ts).
   */
  moveItem(tripId: string, date: string, from: number, to: number): void;
  /** 다른 날로 옮긴다. 그 날의 맨 뒤에 붙는다. 벽시계 시간은 그대로. */
  moveItemToDate(itemId: string, date: string): void;
  /** 그 날의 순서를 통째로 정한다(시각순 정렬). ids는 그 날의 항목 전부. */
  setDayOrder(tripId: string, date: string, ids: string[]): void;
  addItem(tripId: string, date: string, draft: Partial<Item>): string;
  removeItem(itemId: string): void;

  createTrip(draft: {
    name: string;
    startDate: string;
    endDate: string;
    coverEmoji: string;
    days: TripDay[];
  }): Promise<string>;
  joinTrip(code: string): Promise<string>;
  /** 이 여행에서 나간다. 소유자는 못 나간다(대신 지운다). */
  leaveTrip(tripId: string): Promise<void>;
  /** 소유자가 다른 멤버를 내보낸다. */
  removeMember(tripId: string, userId: string): Promise<void>;
  /** 여행을 지운다. 소유자만. */
  deleteTrip(tripId: string): Promise<void>;
  /** 초대 코드를 새로 만든다. 소유자만. */
  regenerateInviteCode(tripId: string): Promise<void>;
  /** 날짜들의 타임존·도시를 고친다. 항목의 벽시계 시간은 그대로 둔다. */
  updateDays(tripId: string, dates: string[], patch: DayPatch): void;

  toggleChecklistItem(itemId: string): void;
  addChecklistItem(tripId: string, title: string): void;
  removeChecklistItem(itemId: string): void;

  addExpense(draft: Omit<Expense, 'id' | 'createdAt' | 'updatedBy'>): void;
  updateExpense(id: string, patch: Partial<Omit<Expense, 'id' | 'tripId'>>): void;
  removeExpense(id: string): void;

  addPlace(draft: Omit<Place, 'id' | 'createdBy' | 'createdAt'>): void;
  removePlace(id: string): void;
  /** 내 표를 넣었다 뺐다 */
  toggleVote(placeId: string): void;
  /** 후보를 그 날 일정 맨 뒤에 넣고 후보 목록에서 지운다. 새 일정 id를 돌려준다. */
  placeToItem(placeId: string, date: string): string | null;

  addComment(itemId: string, body: string): void;
  removeComment(id: string): void;
}

/**
 * 새 id.
 *
 * DB가 정하게 두지 않는 이유: 화면에 먼저 그려둔 항목과 서버가 돌려준
 * 항목이 다른 것이 되면, 낙관적 업데이트가 "보였다 사라졌다 다시 나타나는"
 * 깜빡임이 된다. uuid는 클라이언트에서 만들어도 충돌하지 않는다.
 */
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // 아주 오래된 웹뷰용 폴백
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export const useTripStore = create<TripState>()((set, get) => {
  /**
   * 저장소에 보낸다. 네트워크 탓으로 못 보내면 되돌리지 않고 쌓아 둔다(data/outbox.ts).
   * 이미 쌓인 게 있으면 순서를 지키려고 이것도 뒤에 쌓는다.
   * 네트워크가 아닌 실패는 그대로 던져 rollbackOn이 되돌리게 한다.
   */
  function send<M extends OutboxMethod>(method: M, ...args: OutboxArgs<M>): Promise<void> {
    const call = () =>
      (repository[method] as (...a: OutboxArgs<M>) => Promise<unknown>)(...args).then(() => {});
    const userId = get().currentUserId;
    // 목 저장소는 기기 안이라 끊길 일이 없다
    if (!repository.persistent || !userId) return call();
    const hold = (): void => {
      enqueue(userId, method, args);
      set({ pending: pendingOps(userId).length });
    };
    if (pendingOps(userId).length > 0) {
      hold();
      return Promise.resolve();
    }
    return call().catch((err: unknown) => {
      if (!isNetworkError(err)) throw err;
      hold();
    });
  }

  /**
   * 서버 것을 다시 받아 화면을 맞춘다. 못 보낸 변경이 남아 있으면 받지 않는다 —
   * 받으면 내가 고친 게(아직 서버에 없어서) 화면에서 사라졌다가 보낸 뒤에야 돌아온다.
   */
  async function reloadFromServer(): Promise<void> {
    const userId = get().currentUserId;
    if (userId && pendingOps(userId).length > 0) return;
    const snapshot = await repository.load().catch(() => null);
    if (!snapshot) return;
    if (userId && pendingOps(userId).length > 0) return;
    set({ ...snapshot, fromCache: false });
  }

  /** 쌓인 변경을 보낸다. 서버가 받지 않은 건 버리고 알린다. */
  async function flushPending(): Promise<{ sent: number; stalled: boolean }> {
    const userId = get().currentUserId;
    if (!userId || pendingOps(userId).length === 0) return { sent: 0, stalled: false };
    set({ syncing: true });
    const result = await flushOutbox(userId, repository, isNetworkError);
    set({ syncing: false, pending: pendingOps(userId).length });
    if (result.dropped > 0) {
      set({ error: getMessages().offline.dropped(result.dropped, result.firstError ?? '') });
    }
    return result;
  }

  /**
   * 저장이 실패하면 되돌린다.
   *
   * 조용히 되돌리면 사용자는 자기가 고친 게 사라진 걸 나중에야 알아챈다.
   * 이유를 함께 남겨 화면이 띄우게 한다.
   */
  function rollbackOn(promise: Promise<unknown>, previous: Rollback): void {
    void promise.catch((err: unknown) => {
      set((state) => ({
        ...state,
        ...previous,
        error: err instanceof Error ? err.message : getMessages().errors.saveFailed,
      }));
    });
  }

  /** 이 중 직접 입력 이동 시간이 있는 항목만 — 없는 항목까지 쓰면 불필요한 저장이 는다 */
  function staleLegs(ids: string[]): Set<string> {
    const set = new Set(ids);
    return new Set(get().items.filter((i) => set.has(i.id) && i.leg).map((i) => i.id));
  }

  /**
   * 순서·날짜 변경을 한 번에 반영한다. 옮긴 항목의 새 위치와, 앞 일정이 바뀌어
   * 무의미해진 이동 시간 지우기를 같이 적용하고, 하나라도 실패하면 전부 되돌린다.
   */
  function applyReorder(
    moves: Record<string, Pick<Item, 'sortKey'> & Partial<Pick<Item, 'date'>>>,
    clearLeg: Set<string>,
  ): void {
    const previous = { items: get().items };
    const patches = new Map<string, Partial<Item>>();
    for (const [id, patch] of Object.entries(moves)) patches.set(id, { ...patch });
    for (const id of clearLeg) patches.set(id, { ...patches.get(id), leg: undefined });

    set((state) => ({
      items: state.items.map((item) => {
        const patch = patches.get(item.id);
        return patch ? { ...item, ...patch, ...editedNow() } : item;
      }),
    }));
    rollbackOn(
      Promise.all([...patches].map(([id, patch]) => send('updateItem', id, patch))),
      previous,
    );
  }

  /** 여행과 딸린 항목·준비물을 함께 치운다 (DB의 cascade와 맞춘다) */
  function dropTrip(state: TripState, tripId: string): Partial<TripState> {
    return {
      trips: state.trips.filter((t) => t.id !== tripId),
      items: state.items.filter((i) => i.tripId !== tripId),
      checklist: state.checklist.filter((c) => c.tripId !== tripId),
      expenses: state.expenses.filter((e) => e.tripId !== tripId),
      places: state.places.filter((p) => p.tripId !== tripId),
      votes: state.votes.filter((v) => v.tripId !== tripId),
      comments: state.comments.filter((c) => c.tripId !== tripId),
    };
  }

  /** 한 항목을 넣거나 같은 id가 있으면 바꾼다 */
  function upsertById<T extends { id: string }>(list: T[], next: T): T[] {
    const i = list.findIndex((x) => x.id === next.id);
    if (i === -1) return [...list, next];
    const copy = list.slice();
    copy[i] = next;
    return copy;
  }

  /**
   * 내가 고친 항목에 붙일 "누가·언제". DB 트리거도 같은 값을 채우지만,
   * 서버가 돌려줄 때까지 기다리면 방금 고친 항목에 남의 아바타가 잠깐 남는다.
   */
  function editedNow(): Pick<Item, 'updatedBy' | 'updatedAt'> {
    return { updatedBy: get().currentUserId || undefined, updatedAt: new Date().toISOString() };
  }

  function applyRemote(change: RemoteChange): void {
    switch (change.kind) {
      case 'item-upsert':
        set((state) => ({ items: upsertById(state.items, change.item) }));
        return;

      case 'item-delete':
        // 남의 여행의 삭제도 id만 들고 온다 — 내게 없는 id면 아무 일도 없다
        set((state) => ({ items: state.items.filter((i) => i.id !== change.id) }));
        return;

      case 'checklist-upsert':
        set((state) => ({ checklist: upsertById(state.checklist, change.entry) }));
        return;

      case 'checklist-delete':
        set((state) => ({ checklist: state.checklist.filter((c) => c.id !== change.id) }));
        return;

      case 'expense-upsert':
        set((state) => ({ expenses: upsertById(state.expenses, change.expense) }));
        return;

      case 'expense-delete':
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== change.id) }));
        return;

      case 'place-upsert':
        set((state) => ({ places: upsertById(state.places, change.place) }));
        return;

      case 'place-delete':
        set((state) => ({
          places: state.places.filter((p) => p.id !== change.id),
          votes: state.votes.filter((v) => v.placeId !== change.id),
        }));
        return;

      case 'vote-add': {
        const { placeId, userId } = change.vote;
        set((state) =>
          // 내 표는 먼저 그려 두었으니 같은 표가 두 번 들어가지 않게
          state.votes.some((v) => v.placeId === placeId && v.userId === userId)
            ? {}
            : { votes: [...state.votes, change.vote] },
        );
        return;
      }

      case 'vote-remove':
        set((state) => ({
          votes: state.votes.filter(
            (v) => !(v.placeId === change.placeId && v.userId === change.userId),
          ),
        }));
        return;

      case 'comment-add':
        set((state) => ({ comments: upsertById(state.comments, change.comment) }));
        return;

      case 'comment-delete':
        set((state) => ({ comments: state.comments.filter((c) => c.id !== change.id) }));
        return;

      case 'day-upsert':
        set((state) => ({
          trips: state.trips.map((t) => {
            if (t.id !== change.tripId) return t;
            const others = t.days.filter((d) => d.date !== change.day.date);
            // 날짜 순서가 곧 화면의 날짜 칩 순서라 정렬을 지켜야 한다
            const days = [...others, change.day].sort((a, b) => a.date.localeCompare(b.date));
            return { ...t, days };
          }),
        }));
        return;

      case 'day-delete':
        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === change.tripId
              ? { ...t, days: t.days.filter((d) => d.date !== change.date) }
              : t,
          ),
        }));
        return;

      case 'trip-update':
        set((state) => ({
          trips: state.trips.map((t) => (t.id === change.trip.id ? { ...t, ...change.trip } : t)),
        }));
        return;

      case 'trip-delete':
        set((state) => dropTrip(state, change.id));
        return;

      case 'members-changed': {
        /*
         * 누가 들어오거나 나갔다. 닉네임과 새로 보이게 된 여행까지 따라와야
         * 해서 통째로 다시 읽는다.
         * 나간 이벤트는 모든 여행 것이 다 오므로(RLS 미적용) 내 여행이거나
         * 나에 관한 것일 때만 읽는다. 안 거르면 누가 어디서 나갈 때마다 모든
         * 사용자가 전체를 다시 읽는다.
         */
        const { trips, currentUserId } = get();
        const mine =
          !change.tripId ||
          change.userId === currentUserId ||
          trips.some((t) => t.id === change.tripId);
        if (!mine) return;
        void reloadFromServer();
        return;
      }
    }
  }

  return {
    currentUserId: '',
    trips: [],
    items: [],
    checklist: [],
    expenses: [],
    expensesAvailable: true,
    places: [],
    votes: [],
    comments: [],
    collabAvailable: true,
    loading: true,
    error: null,
    fromCache: false,
    pending: 0,
    syncing: false,

    load: async (userId) => {
      /*
       * 사본이 있으면 먼저 보여준다 — 여행지에서 데이터가 느리거나 끊겨도
       * 오늘 일정은 바로 열린다. 서버 것이 오면 그걸로 바꾼다.
       */
      const cached = loadSnapshot(userId);
      set({
        currentUserId: userId,
        loading: !cached,
        ...(cached ?? {}),
        pending: pendingOps(userId).length,
      });
      /*
       * 오프라인에서 고친 게 남았으면 먼저 보낸다. 보내기 전에 서버 것으로 바꾸면
       * 고친 게 화면에서 사라진다. 또 못 보내면(아직 끊김) 사본 + 내 변경을 그대로 둔다.
       */
      const { stalled } = await flushPending();
      if (stalled && cached) {
        set({ loading: false, fromCache: true });
        return;
      }
      try {
        const snapshot = await repository.load();
        set({ ...snapshot, loading: false, error: null, fromCache: false });
        saveSnapshot(userId, snapshot);
      } catch (err: unknown) {
        if (cached && isNetworkError(err)) {
          set({ loading: false, fromCache: true });
          return;
        }
        set({
          loading: false,
          error: err instanceof Error ? err.message : getMessages().errors.readTrips,
        });
      }
    },

    clearError: () => set({ error: null }),

    sync: async () => {
      const { sent, stalled } = await flushPending();
      // 다 보냈으면 서버 것을 받아 친구들이 그사이 고친 것과 맞춘다
      if (sent > 0 && !stalled) await reloadFromServer();
    },

    subscribe: () => repository.subscribe((change) => applyRemote(change)),

    getTrip: (tripId) => get().trips.find((t) => t.id === tripId),

    getDay: (tripId, date) => get().getTrip(tripId)?.days.find((d) => d.date === date),

    getDayItems: (tripId, date) =>
      get()
        .items.filter((i) => i.tripId === tripId && i.date === date)
        .sort(bySortKey),

    getItem: (itemId) => get().items.find((i) => i.id === itemId),

    getChecklist: (tripId) => get().checklist.filter((c) => c.tripId === tripId),

    setLegManually: (itemId, mode, minutes) => {
      const leg: Leg = { mode, minutes: Math.max(0, Math.round(minutes)), isManual: true };
      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, leg, ...editedNow() } : item,
        ),
      }));
      rollbackOn(send('updateItem', itemId, { leg }), previous);
    },

    setLegMode: (itemId, mode, minutes) => {
      const leg: Leg = { mode, minutes: Math.max(0, Math.round(minutes)), isManual: false };
      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, leg, ...editedNow() } : item,
        ),
      }));
      rollbackOn(send('updateItem', itemId, { leg }), previous);
    },

    clearManualLeg: (itemId) => {
      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, leg: undefined, ...editedNow() } : item,
        ),
      }));
      rollbackOn(send('updateItem', itemId, { leg: undefined }), previous);
    },

    updateItem: (itemId, patch) => {
      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, ...patch, ...editedNow() } : item,
        ),
      }));
      rollbackOn(send('updateItem', itemId, patch), previous);
    },

    moveItem: (tripId, date, from, to) => {
      const dayItems = get().getDayItems(tripId, date);
      const target = dayItems[from];
      if (!target || from === to) return;
      const newKey = keyForMove(dayItems, from, to);

      const ids = dayItems.map((i) => i.id);
      const stale = staleLegs(predecessorsChanged(ids, moved(ids, from, to)));
      applyReorder({ [target.id]: { sortKey: newKey } }, stale);
    },

    moveItemToDate: (itemId, date) => {
      const item = get().getItem(itemId);
      if (!item || item.date === date) return;

      const target = get().getDayItems(item.tripId, date);
      const last = target[target.length - 1]?.sortKey ?? null;
      // 떠나는 날: 이 항목 바로 뒤에 있던 일정의 앞 일정이 바뀐다
      const leaving = get()
        .getDayItems(item.tripId, item.date)
        .map((i) => i.id);
      const stale = staleLegs([
        ...predecessorsChanged(leaving, leaving.filter((id) => id !== itemId)),
        itemId,
      ]);
      applyReorder({ [itemId]: { date, sortKey: keyBetween(last, null) } }, stale);
    },

    setDayOrder: (tripId, date, ids) => {
      const before = get().getDayItems(tripId, date).map((i) => i.id);
      if (before.length !== ids.length || before.every((id, i) => id === ids[i])) return;

      // 키를 처음부터 새로 매긴다 — 하루 치라 몇 개 안 되고, 키도 짧아진다
      const moves: Record<string, Pick<Item, 'sortKey'>> = {};
      let key: string | null = null;
      for (const id of ids) {
        key = keyBetween(key, null);
        moves[id] = { sortKey: key };
      }
      applyReorder(moves, staleLegs(predecessorsChanged(before, ids)));
    },

    addItem: (tripId, date, draft) => {
      const dayItems = get().getDayItems(tripId, date);
      const last = dayItems[dayItems.length - 1]?.sortKey ?? null;
      const item: Item = {
        id: draft.id ?? newId(),
        tripId,
        date,
        // 맨 뒤에 추가 — fractional index의 정수부만 증가하므로 키가 짧게 유지된다
        sortKey: keyBetween(last, null),
        kind: draft.kind ?? 'place',
        title: draft.title ?? getMessages().itemEdit.defaultTitle,
        placeName: draft.placeName,
        coord: draft.coord,
        toPlaceName: draft.toPlaceName,
        toCoord: draft.toCoord,
        localTime: draft.localTime,
        durationMin: draft.durationMin,
        description: draft.description,
        carrierCode: draft.carrierCode,
        bookingRef: draft.bookingRef,
        ...editedNow(),
      };

      const previous = { items: get().items };
      set((state) => ({ items: [...state.items, item] }));
      rollbackOn(send('addItem', item), previous);
      return item.id;
    },

    removeItem: (itemId) => {
      const previous = { items: get().items, comments: get().comments };
      // 댓글은 DB가 함께 지운다(외래키 cascade) — 화면도 맞춘다
      set((state) => ({
        items: state.items.filter((i) => i.id !== itemId),
        comments: state.comments.filter((c) => c.itemId !== itemId),
      }));
      rollbackOn(send('removeItem', itemId), previous);
    },

    createTrip: async (draft) => {
      /*
       * 여행 만들기는 기다린다. 초대 코드와 id를 서버가 정하는데, 그걸
       * 모르면 만든 직후 열 화면도 정할 수 없다. 항목 편집과 달리 하루에
       * 몇 번 없는 동작이라 기다려도 리듬이 끊기지 않는다.
       */
      const trip = await repository.createTrip(draft);
      set((state) => ({ trips: [...state.trips, trip] }));
      return trip.id;
    },

    joinTrip: async (code) => {
      const tripId = await repository.joinTrip(code);
      // 참가한 여행의 내용을 아직 모르므로 전체를 다시 읽는다
      const snapshot = await repository.load();
      set({ ...snapshot });
      return tripId;
    },

    /*
     * 나가기·내보내기·삭제는 기다린다. 낙관적으로 먼저 지웠다가 실패해서
     * 여행이 되살아나면, 그 사이 홈으로 이동한 사용자는 무슨 일인지 모른다.
     * 되돌릴 수 없는 동작은 결과를 확인하고 나서 화면을 바꾼다.
     */
    leaveTrip: async (tripId) => {
      await repository.removeMember(tripId, get().currentUserId);
      set((state) => dropTrip(state, tripId));
    },

    removeMember: async (tripId, userId) => {
      await repository.removeMember(tripId, userId);
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id === tripId ? { ...t, members: t.members.filter((m) => m.id !== userId) } : t,
        ),
      }));
    },

    deleteTrip: async (tripId) => {
      await repository.deleteTrip(tripId);
      set((state) => dropTrip(state, tripId));
    },

    regenerateInviteCode: async (tripId) => {
      const inviteCode = await repository.regenerateInviteCode(tripId);
      set((state) => ({
        trips: state.trips.map((t) => (t.id === tripId ? { ...t, inviteCode } : t)),
      }));
    },

    updateDays: (tripId, dates, patch) => {
      if (dates.length === 0) return;
      const previous = { trips: get().trips };
      set((state) => ({
        trips: state.trips.map((t) =>
          t.id === tripId
            ? {
                ...t,
                days: t.days.map((d) => (dates.includes(d.date) ? { ...d, ...patch } : d)),
              }
            : t,
        ),
      }));
      rollbackOn(send('updateDays', tripId, dates, patch), previous);
    },

    toggleChecklistItem: (itemId) => {
      const target = get().checklist.find((c) => c.id === itemId);
      if (!target) return;
      const checked = !target.checked;

      const previous = { checklist: get().checklist };
      set((state) => ({
        checklist: state.checklist.map((c) => (c.id === itemId ? { ...c, checked } : c)),
      }));
      rollbackOn(send('updateChecklistItem', itemId, checked), previous);
    },

    addChecklistItem: (tripId, title) => {
      const entry: ChecklistItem = { id: newId(), tripId, title, checked: false };
      const previous = { checklist: get().checklist };
      set((state) => ({ checklist: [...state.checklist, entry] }));
      rollbackOn(send('addChecklistItem', entry), previous);
    },

    removeChecklistItem: (itemId) => {
      const previous = { checklist: get().checklist };
      set((state) => ({ checklist: state.checklist.filter((c) => c.id !== itemId) }));
      rollbackOn(send('removeChecklistItem', itemId), previous);
    },

    addExpense: (draft) => {
      const expense: Expense = {
        ...draft,
        id: newId(),
        createdAt: new Date().toISOString(),
        updatedBy: get().currentUserId || undefined,
      };
      const previous = { expenses: get().expenses };
      set((state) => ({ expenses: [...state.expenses, expense] }));
      rollbackOn(send('addExpense', expense), previous);
    },

    updateExpense: (id, patch) => {
      const previous = { expenses: get().expenses };
      set((state) => ({
        expenses: state.expenses.map((e) =>
          e.id === id ? { ...e, ...patch, updatedBy: get().currentUserId || e.updatedBy } : e,
        ),
      }));
      rollbackOn(send('updateExpense', id, patch), previous);
    },

    removeExpense: (id) => {
      const previous = { expenses: get().expenses };
      set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
      rollbackOn(send('removeExpense', id), previous);
    },

    addPlace: (draft) => {
      const me = get().currentUserId || undefined;
      const place: Place = { ...draft, id: newId(), createdBy: me, createdAt: new Date().toISOString() };
      const previous = { places: get().places, votes: get().votes };
      // 올린 사람은 당연히 가고 싶다 — 내 표를 하나 넣어 둔다
      const vote: PlaceVote | null = me ? { placeId: place.id, tripId: place.tripId, userId: me } : null;
      set((state) => ({
        places: [...state.places, place],
        votes: vote ? [...state.votes, vote] : state.votes,
      }));
      rollbackOn(
        send('addPlace', place).then(() => (vote ? send('setVote', vote, true) : undefined)),
        previous,
      );
    },

    removePlace: (id) => {
      const previous = { places: get().places, votes: get().votes };
      set((state) => ({
        places: state.places.filter((p) => p.id !== id),
        votes: state.votes.filter((v) => v.placeId !== id),
      }));
      rollbackOn(send('removePlace', id), previous);
    },

    toggleVote: (placeId) => {
      const me = get().currentUserId;
      const place = get().places.find((p) => p.id === placeId);
      if (!me || !place) return;
      const vote: PlaceVote = { placeId, tripId: place.tripId, userId: me };
      const on = !get().votes.some((v) => v.placeId === placeId && v.userId === me);
      const previous = { votes: get().votes };
      set((state) => ({
        votes: on
          ? [...state.votes, vote]
          : state.votes.filter((v) => !(v.placeId === placeId && v.userId === me)),
      }));
      rollbackOn(send('setVote', vote, on), previous);
    },

    placeToItem: (placeId, date) => {
      const place = get().places.find((p) => p.id === placeId);
      if (!place) return null;
      const id = get().addItem(place.tripId, date, {
        kind: 'place',
        title: place.name,
        placeName: place.placeName,
        coord: place.coord,
        description: place.note,
      });
      get().removePlace(placeId);
      return id;
    },

    addComment: (itemId, body) => {
      const item = get().getItem(itemId);
      if (!item) return;
      const comment: Comment = {
        id: newId(),
        tripId: item.tripId,
        itemId,
        authorId: get().currentUserId || undefined,
        body,
        createdAt: new Date().toISOString(),
      };
      const previous = { comments: get().comments };
      set((state) => ({ comments: [...state.comments, comment] }));
      rollbackOn(send('addComment', comment), previous);
    },

    removeComment: (id) => {
      const previous = { comments: get().comments };
      set((state) => ({ comments: state.comments.filter((c) => c.id !== id) }));
      rollbackOn(send('removeComment', id), previous);
    },
  };
});

/*
 * 바뀔 때마다 오프라인 사본을 고친다 — 내 편집, 친구의 실시간 변경 모두.
 * 여행지에서 끊기기 직전까지의 상태가 남아야 한다. 연달아 바뀌는 경우가 많아
 * (끌기, 실시간 이벤트 여러 개) 잠깐 모았다가 한 번에 쓴다.
 */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useTripStore.subscribe((state, prev) => {
  if (!state.currentUserId || state.loading) return;
  if (
    state.trips === prev.trips &&
    state.items === prev.items &&
    state.checklist === prev.checklist &&
    state.expenses === prev.expenses &&
    state.places === prev.places &&
    state.votes === prev.votes &&
    state.comments === prev.comments
  ) {
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = useTripStore.getState();
    if (s.currentUserId) {
      saveSnapshot(s.currentUserId, {
        trips: s.trips,
        items: s.items,
        checklist: s.checklist,
        expenses: s.expenses,
        expensesAvailable: s.expensesAvailable,
        places: s.places,
        votes: s.votes,
        comments: s.comments,
        collabAvailable: s.collabAvailable,
      });
    }
  }, 400);
});

/*
 * 못 보낸 변경을 다시 보내 볼 때. 연결이 돌아온 순간(online)은 App.tsx가 load()를
 * 부르며 보낸다. 여기는 그 밖의 경우 — "online"은 켜져 있는데 실제로는 안 되던 때
 * (약한 와이파이·지하철)와 앱을 다시 앞으로 가져왔을 때.
 */
const RETRY_MS = 20_000;
if (typeof window !== 'undefined') {
  const retry = (): void => {
    const s = useTripStore.getState();
    if (s.pending > 0 && !s.syncing && navigator.onLine) void s.sync();
  };
  setInterval(retry, RETRY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retry();
  });
}
