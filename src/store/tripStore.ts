/**
 * 앱 상태.
 *
 * 지금은 목 데이터를 메모리에 들고 있다. Supabase를 붙일 때 바꿀 곳은
 * 이 파일 하나이고, 화면 코드는 손대지 않는다. 각 액션이 곧 하나의
 * 낙관적 업데이트(optimistic update) 지점이 된다:
 *
 *   1) 로컬 상태를 먼저 바꾼다 (지금 하는 그대로)
 *   2) supabase.from('items').update(...) 를 보낸다
 *   3) 실패하면 롤백한다
 *   4) 다른 사람의 변경은 realtime 구독(postgres_changes)으로 들어와
 *      applyRemoteChange()로 병합한다
 *
 * sortKey가 fractional index인 덕분에 4번에서 순서 충돌이 나지 않는다.
 */

import { create } from 'zustand';
import { bySortKey, keyBetween, keyForMove } from '@/domain/fractionalIndex';
import type { ChecklistItem, Item, Leg, TransportMode, Trip, TripDay } from '@/domain/types';
import {
  CURRENT_USER_ID,
  MOCK_CHECKLIST,
  MOCK_ITEMS,
  MOCK_TRIPS,
} from '@/data/mockTrips';

interface TripState {
  currentUserId: string;
  trips: Trip[];
  items: Item[];
  checklist: ChecklistItem[];

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

  toggleChecklistItem(itemId: string): void;
  addChecklistItem(tripId: string, title: string): void;
  removeChecklistItem(itemId: string): void;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export const useTripStore = create<TripState>()((set, get) => ({
  currentUserId: CURRENT_USER_ID,
  trips: MOCK_TRIPS,
  items: MOCK_ITEMS,
  checklist: MOCK_CHECKLIST,

  getTrip: (tripId) => get().trips.find((t) => t.id === tripId),

  getDay: (tripId, date) => get().getTrip(tripId)?.days.find((d) => d.date === date),

  getDayItems: (tripId, date) =>
    get()
      .items.filter((i) => i.tripId === tripId && i.date === date)
      .sort(bySortKey),

  getItem: (itemId) => get().items.find((i) => i.id === itemId),

  getChecklist: (tripId) => get().checklist.filter((c) => c.tripId === tripId),

  applyRouteResult: (itemId, leg) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== itemId) return item;
        // 사용자가 직접 고친 값은 절대 덮지 않는다.
        // 이걸 빼면 현지에서 적어둔 이동시간이 새로고침마다 날아간다.
        if (item.leg?.isManual) return item;
        return { ...item, leg };
      }),
    })),

  setLegManually: (itemId, mode, minutes) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? { ...item, leg: { mode, minutes: Math.max(0, Math.round(minutes)), isManual: true } }
          : item,
      ),
    })),

  clearManualLeg: (itemId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, leg: undefined } : item,
      ),
    })),

  updateItem: (itemId, patch) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    })),

  moveItem: (tripId, date, from, to) => {
    const dayItems = get().getDayItems(tripId, date);
    const target = dayItems[from];
    if (!target || from === to) return;
    const newKey = keyForMove(dayItems, from, to);
    set((state) => ({
      items: state.items.map((item) =>
        item.id === target.id ? { ...item, sortKey: newKey } : item,
      ),
    }));
  },

  addItem: (tripId, date, draft) => {
    const dayItems = get().getDayItems(tripId, date);
    const last = dayItems[dayItems.length - 1]?.sortKey ?? null;
    const id = draft.id ?? nextId('i');
    const item: Item = {
      id,
      tripId,
      date,
      // 맨 뒤에 추가 — fractional index의 정수부만 증가하므로 키가 짧게 유지된다
      sortKey: keyBetween(last, null),
      kind: draft.kind ?? 'place',
      title: draft.title ?? '새 일정',
      placeName: draft.placeName,
      coord: draft.coord,
      localTime: draft.localTime,
      durationMin: draft.durationMin,
      description: draft.description,
      carrierCode: draft.carrierCode,
    };
    set((state) => ({ items: [...state.items, item] }));
    return id;
  },

  removeItem: (itemId) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== itemId) })),

  toggleChecklistItem: (itemId) =>
    set((state) => ({
      checklist: state.checklist.map((c) =>
        c.id === itemId ? { ...c, checked: !c.checked } : c,
      ),
    })),

  addChecklistItem: (tripId, title) =>
    set((state) => ({
      checklist: [
        ...state.checklist,
        { id: nextId('c'), tripId, title, checked: false },
      ],
    })),

  removeChecklistItem: (itemId) =>
    set((state) => ({ checklist: state.checklist.filter((c) => c.id !== itemId) })),
}));
