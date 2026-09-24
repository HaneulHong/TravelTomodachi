/**
 * 개발용 여행 데이터 — 메모리.
 *
 * Supabase가 설정되지 않았을 때 쓴다. 목 일정은 예시가 아니라 **어려운
 * 경우를 모아둔 테스트 시나리오**다(README 참고) — 지역 분기, 대중교통
 * 없는 도시, 타임존이 바뀌는 날, 터미널 구간이 전부 들어 있다.
 *
 * 새로고침하면 처음 상태로 돌아간다. 그게 목의 성격이라 감추지 않는다.
 */

import type { ChecklistItem, Expense, Item, Trip } from '@/domain/types';
import { MOCK_CHECKLIST, MOCK_EXPENSES, MOCK_ITEMS, MOCK_TRIPS } from './mockTrips';
import type { TripDraft, TripRepository, TripSnapshot } from './tripRepository';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** 메모리 사본. 스토어가 직접 고치지 않고 여기를 거친다. */
let trips: Trip[] = [...MOCK_TRIPS];
let items: Item[] = [...MOCK_ITEMS];
let checklist: ChecklistItem[] = [...MOCK_CHECKLIST];
let expenses: Expense[] = [...MOCK_EXPENSES];

export const mockTripRepository: TripRepository = {
  id: 'mock-trips',
  persistent: false,

  async load(): Promise<TripSnapshot> {
    return { trips, items, checklist, expenses, expensesAvailable: true };
  },

  async createTrip(draft: TripDraft): Promise<Trip> {
    const trip: Trip = {
      id: nextId('t'),
      name: draft.name,
      startDate: draft.startDate,
      endDate: draft.endDate,
      ownerId: 'u-me',
      inviteCode: 'DEVCODE1',
      coverEmoji: draft.coverEmoji,
      members: [],
      days: draft.days,
    };
    trips = [...trips, trip];
    return trip;
  },

  async joinTrip(): Promise<string> {
    throw new Error('백엔드를 연결해야 초대에 참가할 수 있습니다');
  },

  async removeMember(tripId, userId): Promise<void> {
    trips = trips.map((t) =>
      t.id === tripId ? { ...t, members: t.members.filter((m) => m.id !== userId) } : t,
    );
    // 나 자신이 빠지면 그 여행은 더 이상 안 보인다
    if (userId === 'u-me') trips = trips.filter((t) => t.id !== tripId);
  },

  async deleteTrip(tripId): Promise<void> {
    trips = trips.filter((t) => t.id !== tripId);
    items = items.filter((i) => i.tripId !== tripId);
    checklist = checklist.filter((c) => c.tripId !== tripId);
  },

  async regenerateInviteCode(tripId): Promise<string> {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    trips = trips.map((t) => (t.id === tripId ? { ...t, inviteCode: code } : t));
    return code;
  },

  async addItem(item: Item): Promise<void> {
    items = [...items, item];
  },

  async updateItem(itemId, patch): Promise<void> {
    items = items.map((i) => (i.id === itemId ? { ...i, ...patch } : i));
  },

  async removeItem(itemId): Promise<void> {
    items = items.filter((i) => i.id !== itemId);
  },

  async updateDays(tripId, dates, patch): Promise<void> {
    trips = trips.map((t) =>
      t.id === tripId
        ? { ...t, days: t.days.map((d) => (dates.includes(d.date) ? { ...d, ...patch } : d)) }
        : t,
    );
  },

  async addChecklistItem(entry: ChecklistItem): Promise<void> {
    checklist = [...checklist, entry];
  },

  async updateChecklistItem(itemId, checked): Promise<void> {
    checklist = checklist.map((c) => (c.id === itemId ? { ...c, checked } : c));
  },

  async removeChecklistItem(itemId): Promise<void> {
    checklist = checklist.filter((c) => c.id !== itemId);
  },

  async addExpense(expense): Promise<void> {
    expenses = [...expenses, expense];
  },

  async updateExpense(id, patch): Promise<void> {
    expenses = expenses.map((e) => (e.id === id ? { ...e, ...patch } : e));
  },

  async removeExpense(id): Promise<void> {
    expenses = expenses.filter((e) => e.id !== id);
  },

  // 혼자 쓰는 메모리 저장소라 다른 사람의 변경이 올 일이 없다
  subscribe(): () => void {
    return () => {};
  },
};
