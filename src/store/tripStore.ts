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
import { getTripRepository } from '@/data';
import { bySortKey, keyBetween, keyForMove } from '@/domain/fractionalIndex';
import type { ChecklistItem, Item, Leg, TransportMode, Trip, TripDay } from '@/domain/types';

const repository = getTripRepository();

/** 낙관적 업데이트를 되돌릴 때 쓰는 이전 상태 */
interface Rollback {
  items?: Item[];
  checklist?: ChecklistItem[];
  trips?: Trip[];
}

interface TripState {
  currentUserId: string;
  trips: Trip[];
  items: Item[];
  checklist: ChecklistItem[];

  /** 첫 로드가 끝났는지. 끝나기 전에 "여행이 없습니다"를 띄우면 안 된다. */
  loading: boolean;
  /** 저장에 실패한 이유. 화면이 띄우고 사용자가 닫는다. */
  error: string | null;

  load(userId: string): Promise<void>;
  clearError(): void;

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
  moveItem(tripId: string, date: string, from: number, to: number): void;
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

  toggleChecklistItem(itemId: string): void;
  addChecklistItem(tripId: string, title: string): void;
  removeChecklistItem(itemId: string): void;
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
        error: err instanceof Error ? err.message : '저장하지 못했습니다',
      }));
    });
  }

  return {
    currentUserId: '',
    trips: [],
    items: [],
    checklist: [],
    loading: true,
    error: null,

    load: async (userId) => {
      set({ loading: true, currentUserId: userId });
      try {
        const snapshot = await repository.load();
        set({ ...snapshot, loading: false, error: null });
      } catch (err: unknown) {
        set({
          loading: false,
          error: err instanceof Error ? err.message : '여행을 읽지 못했습니다',
        });
      }
    },

    clearError: () => set({ error: null }),

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
        items: state.items.map((item) => (item.id === itemId ? { ...item, leg } : item)),
      }));
      rollbackOn(repository.updateItem(itemId, { leg }), previous);
    },

    clearManualLeg: (itemId) => {
      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === itemId ? { ...item, leg: undefined } : item,
        ),
      }));
      rollbackOn(repository.updateItem(itemId, { leg: undefined }), previous);
    },

    updateItem: (itemId, patch) => {
      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      }));
      rollbackOn(repository.updateItem(itemId, patch), previous);
    },

    moveItem: (tripId, date, from, to) => {
      const dayItems = get().getDayItems(tripId, date);
      const target = dayItems[from];
      if (!target || from === to) return;
      const newKey = keyForMove(dayItems, from, to);

      const previous = { items: get().items };
      set((state) => ({
        items: state.items.map((item) =>
          item.id === target.id ? { ...item, sortKey: newKey } : item,
        ),
      }));
      rollbackOn(repository.updateItem(target.id, { sortKey: newKey }), previous);
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
        title: draft.title ?? '새 일정',
        placeName: draft.placeName,
        coord: draft.coord,
        toPlaceName: draft.toPlaceName,
        toCoord: draft.toCoord,
        localTime: draft.localTime,
        durationMin: draft.durationMin,
        description: draft.description,
        carrierCode: draft.carrierCode,
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
  };
});
