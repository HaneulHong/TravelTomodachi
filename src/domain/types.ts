/**
 * 도메인 타입.
 *
 * 설계 원칙 두 가지가 여기에 박혀 있다.
 *
 * 1. 시간은 절대 UTC로 변환해서 저장하지 않는다.
 *    `localTime`은 벽시계 시간('09:00')이고, 타임존은 `TripDay`에 붙는다.
 *    이유: "오전 9시 조식"은 현지 9시여야 한다. UTC로 저장하면 일정을
 *    하루 미루거나 도시를 바꿀 때 시간이 엉뚱하게 이동한다.
 *
 * 2. 순서는 정수 인덱스가 아니라 fractional index 문자열이다.
 *    두 사람이 동시에 순서를 바꿔도 충돌하지 않고, 재정렬할 때
 *    전체 행을 업데이트하지 않아도 된다. (실시간 공동 편집 전제)
 */

export type Region = 'KR' | 'GLOBAL';

export type TransportMode = 'walk' | 'transit' | 'car';

/** 도시간 이동(항공/기차)은 API로 풀지 않고 사용자가 직접 입력한다. */
export type ItemKind = 'place' | 'flight' | 'train';

export interface Coord {
  lat: number;
  lng: number;
}

export interface Member {
  id: string;
  name: string;
  /** 아바타에 표시할 한 글자 */
  initial: string;
  color: string;
}

export interface TripDay {
  /** 'YYYY-MM-DD' */
  date: string;
  /** IANA 타임존. day 단위로 부여한다. */
  timezone: string;
  /** '방콕' 같은 그 날의 거점 도시 */
  cityLabel: string;
}

/** 앞 항목에서 이 항목까지의 이동 */
export interface Leg {
  mode: TransportMode;
  minutes: number;
  /**
   * 사용자가 직접 고친 값인지.
   * true면 길찾기 API 결과로 덮어쓰지 않는다. — 이걸 안 지키면
   * 현지에서 손으로 적어둔 시간이 새로고침 때마다 날아간다.
   */
  isManual: boolean;
  /** 해당 지역에 대중교통 데이터가 없어 mode를 강제로 바꿨을 때 */
  fellBackFrom?: TransportMode;
}

export interface Item {
  id: string;
  tripId: string;
  /** 'YYYY-MM-DD' — 어느 날짜에 속하는지 */
  date: string;
  /** fractional index. 같은 날짜 안에서 정렬 기준. */
  sortKey: string;
  kind: ItemKind;
  title: string;
  placeName?: string;
  coord?: Coord;
  /** 벽시계 시간 'HH:mm'. 타임존은 이 항목이 속한 TripDay가 가진다. */
  localTime?: string;
  /** 머무는 시간(분) */
  durationMin?: number;
  description?: string;
  /** 앞 항목에서 여기까지의 이동. 그 날의 첫 항목은 없다. */
  leg?: Leg;
  /** kind가 'flight' | 'train'일 때의 편명 등 */
  carrierCode?: string;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  ownerId: string;
  /** 친구 초대용 코드 */
  inviteCode: string;
  coverEmoji: string;
  members: Member[];
  days: TripDay[];
}

export interface ChecklistItem {
  id: string;
  tripId: string;
  title: string;
  checked: boolean;
  assigneeId?: string;
}

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  walk: '도보',
  transit: '대중교통',
  car: '차량',
};

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  place: '방문',
  flight: '항공',
  train: '기차',
};
