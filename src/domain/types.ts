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

/**
 * 일정 항목의 종류.
 *
 * place를 뺀 나머지는 **구간 항목**이다 — 한 지점에 머무는 게 아니라 터미널
 * 에서 터미널로 이동하는 한 줄이다. 그래서 출발 좌표(coord)와 함께 도착
 * 좌표(toCoord)를 가질 수 있고, 지도에는 점이 아니라 선으로 그려진다.
 *
 * 편·시각은 사용자가 직접 넣는다. 항공·선박 시간표는 무료로 조회할 방법이
 * 마땅치 않고, 기차·광역버스도 예매 사이트를 거쳐야 정확하기 때문이다.
 */
export type ItemKind = 'place' | 'flight' | 'train' | 'bus' | 'ferry';

/** 구간 항목인지 — 터미널에서 터미널로 이동하는 종류인가. */
export function isSegmentKind(kind: ItemKind): boolean {
  return kind !== 'place';
}

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
  /** 같은 닉네임끼리 구분하는 4자리 번호. 없을 수 있다(태그 도입 전 DB). */
  tag?: string;
}

/**
 * 멤버 이름표. 같은 여행에 같은 닉네임이 있을 때만 번호를 붙인다.
 * 늘 붙이면 "여행자#0421님이 고침"처럼 읽기 번거롭고, 안 붙이면 둘을 못 가른다.
 */
export function memberLabel(member: Member, members: readonly Member[]): string {
  const clash = members.some((m) => m.id !== member.id && m.name === member.name);
  return clash && member.tag ? `${member.name}#${member.tag}` : member.name;
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
  /** kind가 'place'가 아닐 때의 편명·노선명 등 */
  carrierCode?: string;
  /**
   * 구간 항목의 도착 지점. 출발은 coord가 맡는다.
   *
   * 이게 있어야 지도에 선을 그릴 수 있다. 없으면 출발 터미널만 점으로 찍히고
   * 다음 일정까지 어떻게 갔는지가 지도에서 사라진다.
   */
  toCoord?: Coord;
  toPlaceName?: string;
  /**
   * 마지막으로 고친 사람(멤버 id)과 시각(ISO). 같이 짜는 일정에서 "이거
   * 누가 바꿨어?"에 답한다. DB 트리거가 채우므로 앱이 보내지 않는다.
   */
  updatedBy?: string;
  updatedAt?: string;
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
  bus: '버스',
  ferry: '배편',
};

/** 편명 칸에 무엇을 적는지. 종류마다 부르는 이름이 다르다. */
export const CARRIER_LABEL: Record<ItemKind, string> = {
  place: '',
  flight: '편명',
  train: '열차편',
  bus: '버스 노선',
  ferry: '항로 · 선박',
};

export const CARRIER_PLACEHOLDER: Record<ItemKind, string> = {
  place: '',
  flight: '예: KE1201',
  train: '예: KTX 101',
  bus: '예: 동서울 → 속초 시외버스',
  ferry: '예: 목포 → 제주 퀸메리호',
};
