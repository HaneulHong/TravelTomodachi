/**
 * 여행 데이터 — Supabase.
 *
 * ── 이름이 두 벌인 이유 ──────────────────────────────────────────
 * DB는 snake_case, 도메인 타입은 camelCase다. 그 사이를 이 파일이 혼자
 * 감당한다. 화면이 place_name 같은 컬럼명을 알게 되면, 나중에 컬럼 하나를
 * 바꿀 때 화면까지 따라다녀야 한다.
 *
 * ── 좌표 ─────────────────────────────────────────────────────────
 * DB는 lat/lng 두 컬럼, 도메인은 Coord 객체다. 둘 중 하나만 있으면 좌표가
 * 없는 것으로 본다 — 반쪽짜리 좌표로 지도에 마커를 찍으면 엉뚱한 곳에 뜬다.
 *
 * ── 시각 ─────────────────────────────────────────────────────────
 * Postgres의 time은 '09:00:00'으로 오는데 화면은 'HH:mm'을 쓴다. 초를 잘라서
 * 넘긴다. UTC 변환은 하지 않는다 — 벽시계 시간을 그대로 두는 게 이 앱의
 * 타임존 정책이다(ARCHITECTURE.md).
 */

import { colorOf, initialOf } from '@/auth';
import type {
  ChecklistItem,
  Comment,
  Coord,
  Expense,
  Item,
  ItemKind,
  Member,
  Place,
  PlaceVote,
  TransportMode,
  Trip,
  TripDay,
} from '@/domain/types';
import { getMessages, translateServerError } from '@/i18n/store';
import { getSupabase } from '@/supabase/client';
import type {
  DayPatch,
  RemoteChange,
  TripDraft,
  TripRepository,
  TripSnapshot,
} from './tripRepository';

// ── DB 행 모양 ─────────────────────────────────────────────────────

interface TripRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  owner_id: string;
  invite_code: string;
  cover_emoji: string;
}

interface MemberRow {
  trip_id: string;
  user_id: string;
  role: string;
}

interface DayRow {
  trip_id: string;
  date: string;
  timezone: string;
  city_label: string;
}

interface ItemRow {
  id: string;
  trip_id: string;
  date: string;
  sort_key: string;
  kind: string;
  title: string;
  place_name: string | null;
  lat: number | null;
  lng: number | null;
  to_place_name: string | null;
  to_lat: number | null;
  to_lng: number | null;
  local_time: string | null;
  duration_min: number | null;
  description: string | null;
  carrier_code: string | null;
  leg_mode: string | null;
  leg_minutes: number | null;
  leg_is_manual: boolean;
  /** sharing.sql을 돌리기 전 DB에는 없다 */
  updated_by?: string | null;
  updated_at?: string | null;
  /** expenses.sql을 돌리기 전 DB에는 없다 */
  booking_ref?: string | null;
}

interface PlaceRow {
  id: string;
  trip_id: string;
  name: string;
  place_name: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  created_by: string | null;
  created_at: string | null;
}

interface VoteRow {
  place_id: string;
  trip_id: string;
  user_id: string;
}

interface CommentRow {
  id: string;
  trip_id: string;
  item_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  trip_id: string;
  title: string;
  /** numeric은 문자열로 올 수 있다 — Number()로 받는다 */
  amount: number | string;
  currency: string;
  paid_by: string | null;
  split_among: string[] | null;
  spent_on: string | null;
  created_at: string | null;
  updated_by: string | null;
}

interface ChecklistRow {
  id: string;
  trip_id: string;
  title: string;
  checked: boolean;
  assignee_id: string | null;
}

interface ProfileRow {
  id: string;
  nickname: string;
  /** profile-tag.sql 이전 DB에는 없다 */
  tag?: string | null;
}

// ── 변환 ───────────────────────────────────────────────────────────

/** 둘 다 있을 때만 좌표로 친다. 반쪽이면 없는 것으로 본다. */
function toCoord(lat: number | null, lng: number | null): Coord | undefined {
  return lat !== null && lng !== null ? { lat, lng } : undefined;
}

/** '09:00:00' → '09:00'. 화면은 초를 쓰지 않는다. */
function toWallClock(time: string | null): string | undefined {
  return time ? time.slice(0, 5) : undefined;
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    tripId: row.trip_id,
    date: row.date,
    sortKey: row.sort_key,
    kind: row.kind as ItemKind,
    title: row.title,
    placeName: row.place_name ?? undefined,
    coord: toCoord(row.lat, row.lng),
    toPlaceName: row.to_place_name ?? undefined,
    toCoord: toCoord(row.to_lat, row.to_lng),
    localTime: toWallClock(row.local_time),
    durationMin: row.duration_min ?? undefined,
    description: row.description ?? undefined,
    carrierCode: row.carrier_code ?? undefined,
    bookingRef: row.booking_ref ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    /*
     * 저장된 leg은 사용자가 고른 것뿐이다 — 수단만 골랐거나(isManual=false,
     * 시간은 조회를 따라감) 시간까지 직접 고쳤거나(isManual=true).
     * 길찾기 조회 결과 자체는 캐시라 DB에 넣지 않는다.
     */
    leg:
      row.leg_mode && row.leg_minutes !== null
        ? {
            mode: row.leg_mode as TransportMode,
            minutes: row.leg_minutes,
            isManual: row.leg_is_manual,
          }
        : undefined,
  };
}

/** 도메인 → DB. undefined는 null로 보내야 컬럼이 비워진다. */
function toItemRow(patch: Partial<Item>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if ('kind' in patch) row.kind = patch.kind;
  if ('title' in patch) row.title = patch.title;
  if ('date' in patch) row.date = patch.date;
  if ('sortKey' in patch) row.sort_key = patch.sortKey;
  if ('placeName' in patch) row.place_name = patch.placeName ?? null;
  if ('toPlaceName' in patch) row.to_place_name = patch.toPlaceName ?? null;
  if ('localTime' in patch) row.local_time = patch.localTime ?? null;
  if ('durationMin' in patch) row.duration_min = patch.durationMin ?? null;
  if ('description' in patch) row.description = patch.description ?? null;
  if ('carrierCode' in patch) row.carrier_code = patch.carrierCode ?? null;
  // 칸이 없는 DB(expenses.sql 이전)에 보내면 저장 자체가 실패한다 — 호출부가 값이
  // 있을 때만 넣는다(ItemEditScreen)
  if ('bookingRef' in patch) row.booking_ref = patch.bookingRef ?? null;

  if ('coord' in patch) {
    row.lat = patch.coord?.lat ?? null;
    row.lng = patch.coord?.lng ?? null;
  }
  if ('toCoord' in patch) {
    row.to_lat = patch.toCoord?.lat ?? null;
    row.to_lng = patch.toCoord?.lng ?? null;
  }

  /*
   * 사용자가 고른 수단(과 직접 고친 시간)을 저장한다. 수단만 고른 경우의
   * leg_minutes는 조회가 안 될 때만 보이는 마지막 값이다 — 조회가 되면 화면은
   * 늘 새 조회 시간을 쓴다(domain/legChoice.ts). 비우면(undefined) 자동 추천으로.
   */
  if ('leg' in patch) {
    row.leg_mode = patch.leg?.mode ?? null;
    row.leg_minutes = patch.leg?.minutes ?? null;
    row.leg_is_manual = Boolean(patch.leg?.isManual);
  }

  return row;
}

function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    placeName: row.place_name ?? undefined,
    coord: toCoord(row.lat, row.lng),
    note: row.note ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

function toVote(row: VoteRow): PlaceVote {
  return { placeId: row.place_id, tripId: row.trip_id, userId: row.user_id };
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    tripId: row.trip_id,
    itemId: row.item_id,
    authorId: row.author_id ?? undefined,
    body: row.body,
    createdAt: row.created_at,
  };
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    amount: Number(row.amount),
    currency: row.currency,
    paidBy: row.paid_by ?? undefined,
    splitAmong: row.split_among ?? [],
    spentOn: row.spent_on ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedBy: row.updated_by ?? undefined,
  };
}

function toExpenseRow(patch: Partial<Expense>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('title' in patch) row.title = patch.title;
  if ('amount' in patch) row.amount = patch.amount;
  if ('currency' in patch) row.currency = patch.currency;
  if ('paidBy' in patch) row.paid_by = patch.paidBy ?? null;
  if ('splitAmong' in patch) row.split_among = patch.splitAmong;
  if ('spentOn' in patch) row.spent_on = patch.spentOn ?? null;
  return row;
}

export function createSupabaseTripRepository(): TripRepository {
  const client = getSupabase();

  async function loadMembers(tripIds: string[]): Promise<Map<string, Member[]>> {
    const byTrip = new Map<string, Member[]>();
    if (tripIds.length === 0) return byTrip;

    const { data: rows, error } = await client
      .from('trip_members')
      .select('trip_id,user_id,role')
      .in('trip_id', tripIds);
    if (error) throw new Error(`${getMessages().errors.readMembers}: ${error.message}`);

    const members = (rows ?? []) as MemberRow[];
    const userIds = [...new Set(members.map((m) => m.user_id))];

    /*
     * 프로필은 따로 읽는다. trip_members.user_id가 auth.users를 가리키고
     * profiles.id도 auth.users를 가리켜서, 둘 사이에 직접 외래키가 없다.
     * PostgREST는 외래키가 있어야 중첩 조회를 해주므로 한 번 더 부른다.
     */
    const profilesById = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      // '*'로 읽는다 — tag 칸이 없는 DB(태그 도입 전)에서도 실패하지 않게
      const { data: profiles } = await client.from('profiles').select('*').in('id', userIds);
      for (const p of (profiles ?? []) as ProfileRow[]) profilesById.set(p.id, p);
    }

    for (const m of members) {
      const profile = profilesById.get(m.user_id);
      const name = profile?.nickname ?? getMessages().profile.defaultNickname;
      const list = byTrip.get(m.trip_id) ?? [];
      list.push({
        id: m.user_id,
        name,
        tag: profile?.tag ?? undefined,
        initial: initialOf(name),
        // 색은 사람(id)으로 — 같은 닉네임끼리도 달라야 구분된다
        color: colorOf(m.user_id),
      });
      byTrip.set(m.trip_id, list);
    }
    return byTrip;
  }

  return {
    id: 'supabase-trips',
    persistent: true,

    async load(): Promise<TripSnapshot> {
      const { data: tripRows, error } = await client
        .from('trips')
        .select('id,name,start_date,end_date,owner_id,invite_code,cover_emoji')
        .order('start_date', { ascending: true });
      if (error) throw new Error(`${getMessages().errors.readTrips}: ${error.message}`);

      const trips = (tripRows ?? []) as TripRow[];
      const tripIds = trips.map((t) => t.id);
      if (tripIds.length === 0) {
        return {
          trips: [],
          items: [],
          checklist: [],
          expenses: [],
          expensesAvailable: true,
          places: [],
          votes: [],
          comments: [],
          collabAvailable: true,
        };
      }

      // 남은 것들은 서로 기다릴 이유가 없다
      const [membersByTrip, daysRes, itemsRes, checklistRes, expensesRes, placesRes, votesRes, commentsRes] = await Promise.all([
        loadMembers(tripIds),
        client.from('trip_days').select('*').in('trip_id', tripIds).order('date'),
        client.from('items').select('*').in('trip_id', tripIds).order('sort_key'),
        client.from('checklist').select('*').in('trip_id', tripIds),
        client.from('expenses').select('*').in('trip_id', tripIds).order('created_at'),
        client.from('places').select('*').in('trip_id', tripIds).order('created_at'),
        client.from('place_votes').select('place_id,trip_id,user_id').in('trip_id', tripIds),
        client.from('comments').select('*').in('trip_id', tripIds).order('created_at'),
      ]);
      /*
       * 가계부는 실패해도 나머지를 막지 않는다. expenses.sql을 돌리기 전 DB면
       * 테이블이 없어서 여기서 실패하는데, 그렇다고 일정까지 못 보면 안 된다.
       */
      const expensesAvailable = !expensesRes.error;
      // 후보 장소·댓글도 같다 — collab.sql 이전 DB면 셋 다 실패한다
      const collabAvailable = !placesRes.error && !votesRes.error && !commentsRes.error;

      if (daysRes.error) throw new Error(`${getMessages().errors.readDays}: ${daysRes.error.message}`);
      if (itemsRes.error) throw new Error(`${getMessages().errors.readItems}: ${itemsRes.error.message}`);

      const daysByTrip = new Map<string, TripDay[]>();
      for (const d of (daysRes.data ?? []) as DayRow[]) {
        const list = daysByTrip.get(d.trip_id) ?? [];
        list.push({ date: d.date, timezone: d.timezone, cityLabel: d.city_label });
        daysByTrip.set(d.trip_id, list);
      }

      return {
        trips: trips.map((t) => ({
          id: t.id,
          name: t.name,
          startDate: t.start_date,
          endDate: t.end_date,
          ownerId: t.owner_id,
          inviteCode: t.invite_code,
          coverEmoji: t.cover_emoji,
          members: membersByTrip.get(t.id) ?? [],
          days: daysByTrip.get(t.id) ?? [],
        })),
        items: ((itemsRes.data ?? []) as ItemRow[]).map(toItem),
        checklist: ((checklistRes.data ?? []) as ChecklistRow[]).map((c) => ({
          id: c.id,
          tripId: c.trip_id,
          title: c.title,
          checked: c.checked,
          assigneeId: c.assignee_id ?? undefined,
        })),
        expenses: ((expensesRes.data ?? []) as ExpenseRow[]).map(toExpense),
        expensesAvailable,
        places: collabAvailable ? ((placesRes.data ?? []) as PlaceRow[]).map(toPlace) : [],
        votes: collabAvailable ? ((votesRes.data ?? []) as VoteRow[]).map(toVote) : [],
        comments: collabAvailable ? ((commentsRes.data ?? []) as CommentRow[]).map(toComment) : [],
        collabAvailable,
      };
    },

    async createTrip(draft: TripDraft): Promise<Trip> {
      const { data: userData } = await client.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error(getMessages().errors.needSignIn);

      const { data, error } = await client
        .from('trips')
        .insert({
          name: draft.name,
          start_date: draft.startDate,
          end_date: draft.endDate,
          cover_emoji: draft.coverEmoji,
          owner_id: userId,
        })
        .select('id,name,start_date,end_date,owner_id,invite_code,cover_emoji')
        .single();
      if (error || !data) throw new Error(`${getMessages().errors.createTrip}: ${error?.message}`);

      const row = data as TripRow;

      if (draft.days.length > 0) {
        const { error: dayError } = await client.from('trip_days').insert(
          draft.days.map((d) => ({
            trip_id: row.id,
            date: d.date,
            timezone: d.timezone,
            city_label: d.cityLabel,
          })),
        );
        if (dayError) throw new Error(`${getMessages().errors.createDays}: ${dayError.message}`);
      }

      const membersByTrip = await loadMembers([row.id]);

      return {
        id: row.id,
        name: row.name,
        startDate: row.start_date,
        endDate: row.end_date,
        ownerId: row.owner_id,
        inviteCode: row.invite_code,
        coverEmoji: row.cover_emoji,
        members: membersByTrip.get(row.id) ?? [],
        days: draft.days,
      };
    },

    async joinTrip(code: string): Promise<string> {
      const { data, error } = await client.rpc('join_trip_by_code', { code });
      // DB 함수의 오류는 한국어다(없는 코드 등). 그 사람의 언어로 옮긴다.
      if (error) throw new Error(translateServerError(error.message));
      return data as string;
    },

    async removeMember(tripId: string, userId: string): Promise<void> {
      /*
       * 권한이 없으면 RLS는 오류 없이 0행을 지운다. 그걸 성공으로 알면
       * "나갔는데 여전히 들어가 있는" 상태가 된다. 지운 행 수로 확인한다.
       */
      const { error, count } = await client
        .from('trip_members')
        .delete({ count: 'exact' })
        .eq('trip_id', tripId)
        .eq('user_id', userId);
      if (error) throw new Error(`${getMessages().errors.removeMember}: ${error.message}`);
      if (count === 0) throw new Error(getMessages().errors.removeMemberNone);
    },

    async deleteTrip(tripId: string): Promise<void> {
      const { error, count } = await client
        .from('trips')
        .delete({ count: 'exact' })
        .eq('id', tripId);
      if (error) throw new Error(`${getMessages().errors.deleteTrip}: ${error.message}`);
      if (count === 0) throw new Error(getMessages().errors.deleteTripNotOwner);
    },

    async regenerateInviteCode(tripId: string): Promise<string> {
      // 멤버는 invite_code 칸을 고칠 권한이 없다(sharing.sql). 소유자 확인은 함수가 한다.
      const { data, error } = await client.rpc('regenerate_invite_code', { trip: tripId });
      if (error) throw new Error(translateServerError(error.message));
      return data as string;
    },

    async addItem(item: Item): Promise<void> {
      const { error } = await client.from('items').insert({
        id: item.id,
        trip_id: item.tripId,
        date: item.date,
        sort_key: item.sortKey,
        kind: item.kind,
        title: item.title,
        place_name: item.placeName ?? null,
        lat: item.coord?.lat ?? null,
        lng: item.coord?.lng ?? null,
        to_place_name: item.toPlaceName ?? null,
        to_lat: item.toCoord?.lat ?? null,
        to_lng: item.toCoord?.lng ?? null,
        local_time: item.localTime ?? null,
        duration_min: item.durationMin ?? null,
        description: item.description ?? null,
        carrier_code: item.carrierCode ?? null,
        // 칸이 없는 DB(expenses.sql 이전)에서도 일정 추가가 되도록 값이 있을 때만 보낸다
        ...(item.bookingRef ? { booking_ref: item.bookingRef } : {}),
      });
      if (error) throw new Error(`${getMessages().errors.createItem}: ${error.message}`);
    },

    async updateItem(itemId: string, patch: Partial<Item>): Promise<void> {
      const row = toItemRow(patch);
      if (Object.keys(row).length === 0) return;
      const { error } = await client.from('items').update(row).eq('id', itemId);
      if (error) throw new Error(`${getMessages().errors.updateItem}: ${error.message}`);
    },

    async removeItem(itemId: string): Promise<void> {
      const { error } = await client.from('items').delete().eq('id', itemId);
      if (error) throw new Error(`${getMessages().errors.deleteItem}: ${error.message}`);
    },

    async updateDays(tripId: string, dates: string[], patch: DayPatch): Promise<void> {
      const row: { timezone?: string; city_label?: string } = {};
      if (patch.timezone !== undefined) row.timezone = patch.timezone;
      if (patch.cityLabel !== undefined) row.city_label = patch.cityLabel;
      if (dates.length === 0 || Object.keys(row).length === 0) return;

      const { error } = await client
        .from('trip_days')
        .update(row)
        .eq('trip_id', tripId)
        .in('date', dates);
      if (error) throw new Error(`${getMessages().errors.updateDays}: ${error.message}`);
    },

    async addChecklistItem(entry: ChecklistItem): Promise<void> {
      const { error } = await client.from('checklist').insert({
        id: entry.id,
        trip_id: entry.tripId,
        title: entry.title,
        checked: entry.checked,
        assignee_id: entry.assigneeId ?? null,
      });
      if (error) throw new Error(`${getMessages().errors.addChecklist}: ${error.message}`);
    },

    async updateChecklistItem(itemId: string, checked: boolean): Promise<void> {
      const { error } = await client.from('checklist').update({ checked }).eq('id', itemId);
      if (error) throw new Error(`${getMessages().errors.updateChecklist}: ${error.message}`);
    },

    async removeChecklistItem(itemId: string): Promise<void> {
      const { error } = await client.from('checklist').delete().eq('id', itemId);
      if (error) throw new Error(`${getMessages().errors.deleteChecklist}: ${error.message}`);
    },

    async addExpense(expense: Expense): Promise<void> {
      const { error } = await client
        .from('expenses')
        .insert({ id: expense.id, trip_id: expense.tripId, ...toExpenseRow(expense) });
      if (error) throw new Error(`${getMessages().errors.addExpense}: ${error.message}`);
    },

    async updateExpense(id: string, patch: Partial<Expense>): Promise<void> {
      const row = toExpenseRow(patch);
      if (Object.keys(row).length === 0) return;
      const { error } = await client.from('expenses').update(row).eq('id', id);
      if (error) throw new Error(`${getMessages().errors.updateExpense}: ${error.message}`);
    },

    async removeExpense(id: string): Promise<void> {
      const { error } = await client.from('expenses').delete().eq('id', id);
      if (error) throw new Error(`${getMessages().errors.deleteExpense}: ${error.message}`);
    },

    async addPlace(place: Place): Promise<void> {
      const { error } = await client.from('places').insert({
        id: place.id,
        trip_id: place.tripId,
        name: place.name,
        place_name: place.placeName ?? null,
        lat: place.coord?.lat ?? null,
        lng: place.coord?.lng ?? null,
        note: place.note ?? null,
        // created_by는 DB가 auth.uid()로 채운다
      });
      if (error) throw new Error(`${getMessages().errors.addPlace}: ${error.message}`);
    },

    async removePlace(id: string): Promise<void> {
      const { error } = await client.from('places').delete().eq('id', id);
      if (error) throw new Error(`${getMessages().errors.removePlace}: ${error.message}`);
    },

    async setVote(vote: PlaceVote, on: boolean): Promise<void> {
      const { error } = on
        ? await client.from('place_votes').insert({ place_id: vote.placeId, trip_id: vote.tripId })
        : await client
            .from('place_votes')
            .delete()
            .eq('place_id', vote.placeId)
            .eq('user_id', vote.userId);
      if (error) throw new Error(`${getMessages().errors.vote}: ${error.message}`);
    },

    async addComment(comment: Comment): Promise<void> {
      const { error } = await client.from('comments').insert({
        id: comment.id,
        trip_id: comment.tripId,
        item_id: comment.itemId,
        body: comment.body,
        // author_id는 DB가 auth.uid()로 채우고, 남의 이름이면 RLS가 막는다
      });
      if (error) throw new Error(`${getMessages().errors.addComment}: ${error.message}`);
    },

    async removeComment(id: string): Promise<void> {
      const { error } = await client.from('comments').delete().eq('id', id);
      if (error) throw new Error(`${getMessages().errors.deleteComment}: ${error.message}`);
    },

    subscribe(onChange: (change: RemoteChange) => void): () => void {
      /*
       * 테이블별로 필터를 걸지 않는다. 받을 수 있는 행은 RLS가 이미 걸러준다
       * (Postgres Changes는 구독자마다 권한을 확인한다). 여기서 trip_id로 한 번
       * 더 거르려면 여행이 늘 때마다 구독을 다시 맺어야 한다.
       *
       * 단 DELETE에는 RLS가 적용되지 않아 남의 여행의 삭제도 id만 들고 온다.
       * 스토어는 자기가 가진 id일 때만 지우므로 무해하다.
       */
      const channel = client
        .channel('trip-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as { id?: string }).id;
            if (id) onChange({ kind: 'item-delete', id });
            return;
          }
          onChange({ kind: 'item-upsert', item: toItem(p.new as ItemRow) });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist' }, (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as { id?: string }).id;
            if (id) onChange({ kind: 'checklist-delete', id });
            return;
          }
          const row = p.new as ChecklistRow;
          onChange({
            kind: 'checklist-upsert',
            entry: {
              id: row.id,
              tripId: row.trip_id,
              title: row.title,
              checked: row.checked,
              assigneeId: row.assignee_id ?? undefined,
            },
          });
        })
        // 테이블이 아직 없는 DB(expenses.sql 이전)면 이 구독만 조용히 아무것도 안 받는다
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as { id?: string }).id;
            if (id) onChange({ kind: 'expense-delete', id });
            return;
          }
          onChange({ kind: 'expense-upsert', expense: toExpense(p.new as ExpenseRow) });
        })
        // 아래 셋도 collab.sql 이전 DB면 조용히 아무것도 안 받는다
        .on('postgres_changes', { event: '*', schema: 'public', table: 'places' }, (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as { id?: string }).id;
            if (id) onChange({ kind: 'place-delete', id });
            return;
          }
          onChange({ kind: 'place-upsert', place: toPlace(p.new as PlaceRow) });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'place_votes' }, (p) => {
          // 기본키가 (place_id, user_id)라 삭제에도 이 둘은 온다
          if (p.eventType === 'DELETE') {
            const old = p.old as Partial<VoteRow>;
            if (old.place_id && old.user_id) {
              onChange({ kind: 'vote-remove', placeId: old.place_id, userId: old.user_id });
            }
            return;
          }
          onChange({ kind: 'vote-add', vote: toVote(p.new as VoteRow) });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as { id?: string }).id;
            if (id) onChange({ kind: 'comment-delete', id });
            return;
          }
          onChange({ kind: 'comment-add', comment: toComment(p.new as CommentRow) });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_days' }, (p) => {
          // 기본키가 (trip_id, date)라 삭제에도 이 둘은 들어온다
          if (p.eventType === 'DELETE') {
            const old = p.old as Partial<DayRow>;
            if (old.trip_id && old.date) {
              onChange({ kind: 'day-delete', tripId: old.trip_id, date: old.date });
            }
            return;
          }
          const row = p.new as DayRow;
          onChange({
            kind: 'day-upsert',
            tripId: row.trip_id,
            day: { date: row.date, timezone: row.timezone, cityLabel: row.city_label },
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as { id?: string }).id;
            if (id) onChange({ kind: 'trip-delete', id });
            return;
          }
          // 새 여행(INSERT)은 멤버십이 같이 생기므로 members-changed가 따라온다
          if (p.eventType !== 'UPDATE') return;
          const row = p.new as TripRow;
          onChange({
            kind: 'trip-update',
            trip: {
              id: row.id,
              name: row.name,
              startDate: row.start_date,
              endDate: row.end_date,
              coverEmoji: row.cover_emoji,
              // 소유자가 코드를 바꾸면 다른 멤버의 공유 링크도 바로 새 코드가 된다
              inviteCode: row.invite_code,
            },
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members' }, (p) => {
          // 기본키가 (trip_id, user_id)라 삭제 이벤트에도 이 둘은 들어온다
          const row = (p.eventType === 'DELETE' ? p.old : p.new) as Partial<MemberRow>;
          onChange({ kind: 'members-changed', tripId: row.trip_id, userId: row.user_id });
        })
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
