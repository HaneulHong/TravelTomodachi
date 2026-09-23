/**
 * 여행 데이터 저장소 추상화.
 *
 * 화면과 스토어는 이 인터페이스만 본다. 뒤에 목이 있든 Supabase가 있든
 * 모른다 — providers/·auth/가 하는 일과 같은 구조다.
 *
 * ── 왜 통째로 읽어오나 ───────────────────────────────────────────
 * load()가 여행·날짜·멤버·항목·체크리스트를 한 번에 가져온다. 화면마다
 * 따로 조회하면 날짜를 넘길 때마다 네트워크를 타서 스와이프가 끊긴다.
 * 여행 하나가 몇 KB라 전부 들고 있어도 부담이 없고, 대신 편집은 낙관적
 * 업데이트로 즉시 반영한다.
 */

import type { ChecklistItem, Coord, Item, ItemKind, Trip, TripDay } from '@/domain/types';

/** 여행을 만들 때 받는 값. id·초대코드·소유자는 서버가 정한다. */
export interface TripDraft {
  name: string;
  startDate: string;
  endDate: string;
  coverEmoji: string;
  days: TripDay[];
}

/** 항목을 만들 때 받는 값. sortKey는 저장소가 계산한다. */
export interface ItemDraft {
  kind?: ItemKind;
  title?: string;
  placeName?: string;
  coord?: Coord;
  toPlaceName?: string;
  toCoord?: Coord;
  localTime?: string;
  durationMin?: number;
  description?: string;
  carrierCode?: string;
}

/** 날짜에서 고칠 수 있는 것. 날짜 자체는 여행 기간이 정한다. */
export type DayPatch = Partial<Pick<TripDay, 'timezone' | 'cityLabel'>>;

export interface TripSnapshot {
  trips: Trip[];
  items: Item[];
  checklist: ChecklistItem[];
}

/**
 * 다른 사람이 만든 변경. 도메인 모양으로 바꿔서 넘긴다 — 스토어가 DB 컬럼명을
 * 알 필요가 없다.
 *
 * 삭제는 id만 온다. RLS가 DELETE 이벤트에는 적용되지 않아서, 지워진 행 전체를
 * 싣게 하면 남의 여행 내용이 모든 구독자에게 간다(supabase/realtime.sql).
 */
export type RemoteChange =
  | { kind: 'item-upsert'; item: Item }
  | { kind: 'item-delete'; id: string }
  | { kind: 'checklist-upsert'; entry: ChecklistItem }
  | { kind: 'checklist-delete'; id: string }
  | { kind: 'day-upsert'; tripId: string; day: TripDay }
  | { kind: 'day-delete'; tripId: string; date: string }
  | { kind: 'trip-update'; trip: Partial<Trip> & { id: string } }
  | { kind: 'trip-delete'; id: string }
  /** 누가 들어오거나 나갔다. 닉네임까지 다시 읽어야 해서 통째로 새로 받는다. */
  | { kind: 'members-changed' };

export interface TripRepository {
  readonly id: string;
  /** 백엔드에 붙어 있는지. 화면에서 "목 데이터" 안내를 띄울지 판단한다. */
  readonly persistent: boolean;

  load(): Promise<TripSnapshot>;

  createTrip(draft: TripDraft): Promise<Trip>;
  /** 초대 코드로 참가. 참가한 여행의 id를 돌려준다. */
  joinTrip(code: string): Promise<string>;

  /*
   * id와 sortKey는 스토어가 만들어서 넘긴다. 서버가 id를 정하면 화면에
   * 먼저 그려둔 항목과 돌아온 항목이 다른 것이 되어, 낙관적 업데이트가
   * "잠깐 보였다가 사라지고 다시 나타나는" 깜빡임이 된다.
   */
  addItem(item: Item): Promise<void>;
  updateItem(itemId: string, patch: Partial<Item>): Promise<void>;
  removeItem(itemId: string): Promise<void>;

  /**
   * 날짜의 타임존·도시를 고친다. 도시를 옮기면 보통 그 뒤 며칠이 같이
   * 바뀌어서 여러 날짜를 한 번에 받는다.
   */
  updateDays(tripId: string, dates: string[], patch: DayPatch): Promise<void>;

  addChecklistItem(entry: ChecklistItem): Promise<void>;
  updateChecklistItem(itemId: string, checked: boolean): Promise<void>;
  removeChecklistItem(itemId: string): Promise<void>;

  /**
   * 다른 사람의 변경을 받는다. 돌려준 함수를 부르면 구독을 끊는다.
   * 목은 혼자 쓰는 저장소라 아무것도 하지 않는다.
   */
  subscribe(onChange: (change: RemoteChange) => void): () => void;
}
