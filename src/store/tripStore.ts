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
import { bySortKey, keyBetween, keyForMove } from '@/domain/fractionalIndex';
import { moved, predecessorsChanged } from '@/domain/order';
import type {
  ChecklistItem,
  Expense,
  Item,
  Leg,
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
}

interface TripState {
  currentUserId: string;
  trips: Trip[];
  items: Item[];
  checklist: ChecklistItem[];
  expenses: Expense[];
  /** 가계부 테이블이 있는지 (TripSnapshot.expensesAvailable) */
  expensesAvailable: boolean;

  /** 첫 로드가 끝났는지. 끝나기 전에 "여행이 없습니다"를 띄우면 안 된다. */
  loading: boolean;
  /** 저장에 실패한 이유. 화면이 띄우고 사용자가 닫는다. */
  error: string | null;
  /**
   * 서버에서 못 받아 기기에 남은 사본을 보여주는 중인지 (data/offlineCache.ts).
   * 켜져 있으면 화면이 "마지막으로 불러온 일정"이라고 알린다.
   */
  fromCache: boolean;

  load(userId: string): Promise<void>;
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
  /** 길찾기 결과를 반영. 사용자가 손으로 고친 값은 덮어쓰지 않는다. */
  applyRouteResult(itemId: string, leg: Leg): void;
  /** 사용자가 이동수단/시간을 직접 지정 → isManual이 켜진다 */
  setLegManually(itemId: string, mode: TransportMode, minutes: number): void;
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
      Promise.all([...patches].map(([id, patch]) => repository.updateItem(id, patch))),
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
        void repository.load().then((snapshot) => set({ ...snapshot }));
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
    loading: true,
    error: null,
    fromCache: false,

    load: async (userId) => {
      /*
       * 사본이 있으면 먼저 보여준다 — 여행지에서 데이터가 느리거나 끊겨도
       * 오늘 일정은 바로 열린다. 서버 것이 오면 그걸로 바꾼다.
       */
      const cached = loadSnapshot(userId);
      set({ currentUserId: userId, loading: !cached, ...(cached ?? {}) });
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

    subscribe: () => repository.subscribe((change) => applyRemote(change)),

    getTrip: (tripId) => get().trips.find((t) => t.id === tripId),

    getDay: (tripId, date) => get().getTrip(tripId)?.days.find((d) => d.date === date),

    getDayItems: (tripId, date) =>
      get()
        .items.filter((i) => i.tripId === tripId && i.date === date)
        .sort(bySortKey),

    getItem: (itemId) => get().items.find((i) => i.id === itemId),

    getChecklist: (tripId) => get().checklist.filter((c) => c.tripId === tripId),

    applyRouteResult: (itemId, leg) =>
      /*
       * 조회 결과는 캐시다. 저장소에 보내지 않는다 — 다음에 열 때 다시
       * 조회하면 되고, DB에 눌러앉으면 옛날 값이 새 조회를 덮는다.
       */
      set((state) => ({
        items: state.items.map((item) => {
          if (item.id !== itemId) return item;
          // 사용자가 직접 고친 값은 절대 덮지 않는다.
          // 이걸 빼면 현지에서 적어둔 이동시간이 새로고침마다 날아간다.
          if (item.leg?.isManual) return item;
          return { ...item, leg };
        }),
      })),

    setLegManually: (itemId, mode, minutes) => {
      const leg: Leg = { mode, minutes: Math.max(0, Math.round(minutes)), isManual: true };
      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, leg, ...editedNow() } : item,
        ),
      }));
      rollbackOn(repository.updateItem(itemId, { leg }), previous);
    },

    clearManualLeg: (itemId) => {
      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, leg: undefined, ...editedNow() } : item,
        ),
      }));
      rollbackOn(repository.updateItem(itemId, { leg: undefined }), previous);
    },

    updateItem: (itemId, patch) => {
      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, ...patch, ...editedNow() } : item,
        ),
      }));
      rollbackOn(repository.updateItem(itemId, patch), previous);
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
        ...editedNow(),
      };

      const previous = { items: get().items };
      set((state) => ({ items: [...state.items, item] }));
      rollbackOn(repository.addItem(item), previous);
      return item.id;
    },

    removeItem: (itemId) => {
      const previous = { items: get().items };
      set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
      rollbackOn(repository.removeItem(itemId), previous);
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
      rollbackOn(repository.updateDays(tripId, dates, patch), previous);
    },

    toggleChecklistItem: (itemId) => {
      const target = get().checklist.find((c) => c.id === itemId);
      if (!target) return;
      const checked = !target.checked;

      const previous = { checklist: get().checklist };
      set((state) => ({
        checklist: state.checklist.map((c) => (c.id === itemId ? { ...c, checked } : c)),
      }));
      rollbackOn(repository.updateChecklistItem(itemId, checked), previous);
    },

    addChecklistItem: (tripId, title) => {
      const entry: ChecklistItem = { id: newId(), tripId, title, checked: false };
      const previous = { checklist: get().checklist };
      set((state) => ({ checklist: [...state.checklist, entry] }));
      rollbackOn(repository.addChecklistItem(entry), previous);
    },

    removeChecklistItem: (itemId) => {
      const previous = { checklist: get().checklist };
      set((state) => ({ checklist: state.checklist.filter((c) => c.id !== itemId) }));
      rollbackOn(repository.removeChecklistItem(itemId), previous);
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
      rollbackOn(repository.addExpense(expense), previous);
    },

    updateExpense: (id, patch) => {
      const previous = { expenses: get().expenses };
      set((state) => ({
        expenses: state.expenses.map((e) =>
          e.id === id ? { ...e, ...patch, updatedBy: get().currentUserId || e.updatedBy } : e,
        ),
      }));
      rollbackOn(repository.updateExpense(id, patch), previous);
    },

    removeExpense: (id) => {
      const previous = { expenses: get().expenses };
      set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
      rollbackOn(repository.removeExpense(id), previous);
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
    state.expenses === prev.expenses
  ) {
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { currentUserId, trips, items, checklist, expenses, expensesAvailable } =
      useTripStore.getState();
    if (currentUserId) {
      saveSnapshot(currentUserId, { trips, items, checklist, expenses, expensesAvailable });
    }
  }, 400);
});
