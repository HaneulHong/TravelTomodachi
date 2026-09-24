/**
 * 목 데이터.
 *
 * 그냥 예시가 아니라, 이 앱이 마주쳐야 하는 어려운 경우를 일부러 모아뒀다:
 *
 *   1일차 서울   — 국내(KR 프로바이더) + 항공편 수동 입력 항목
 *   2~3일차 방콕 — 해외(GLOBAL) + 타임존 -2시간 변경
 *   4일차 하노이 — **대중교통 데이터 없는 도시** + 타임존 동일
 *   5~6일차 도쿄 — 해외 + 타임존 +2시간 변경
 *
 * 이렇게 두면 화면을 넘겨보기만 해도 지역 분기, 폴백, 타임존 경고가
 * 전부 눈에 보인다.
 */

import { firstKey, keyBetween } from '@/domain/fractionalIndex';
import type { ChecklistItem, Expense, Item, Member, Trip } from '@/domain/types';

const MEMBERS: Member[] = [
  { id: 'u-me', name: '나', initial: '나', color: '#4f46e5' },
  { id: 'u-jun', name: '준호', initial: '준', color: '#0d9488' },
  { id: 'u-sera', name: '세라', initial: '세', color: '#db2777' },
  { id: 'u-min', name: '민', initial: '민', color: '#ea580c' },
];

export const MOCK_MEMBERS = MEMBERS;
export const CURRENT_USER_ID = 'u-me';

export const MOCK_TRIPS: Trip[] = [
  {
    id: 't-sea',
    name: '동남아 + 도쿄 6일',
    startDate: '2026-11-03',
    endDate: '2026-11-08',
    ownerId: 'u-me',
    inviteCode: 'TMD-7K2Q',
    coverEmoji: '🏝️',
    members: MEMBERS,
    days: [
      { date: '2026-11-03', timezone: 'Asia/Seoul', cityLabel: '서울 → 방콕' },
      { date: '2026-11-04', timezone: 'Asia/Bangkok', cityLabel: '방콕' },
      { date: '2026-11-05', timezone: 'Asia/Bangkok', cityLabel: '방콕' },
      { date: '2026-11-06', timezone: 'Asia/Ho_Chi_Minh', cityLabel: '하노이' },
      { date: '2026-11-07', timezone: 'Asia/Tokyo', cityLabel: '도쿄' },
      { date: '2026-11-08', timezone: 'Asia/Tokyo', cityLabel: '도쿄' },
    ],
  },
  {
    id: 't-jeju',
    name: '제주 워케이션',
    startDate: '2026-12-14',
    endDate: '2026-12-17',
    ownerId: 'u-me',
    inviteCode: 'TMD-J3ZX',
    coverEmoji: '🍊',
    members: [MEMBERS[0]!, MEMBERS[1]!],
    days: [
      { date: '2026-12-14', timezone: 'Asia/Seoul', cityLabel: '제주시' },
      { date: '2026-12-15', timezone: 'Asia/Seoul', cityLabel: '서귀포' },
      { date: '2026-12-16', timezone: 'Asia/Seoul', cityLabel: '서귀포' },
      { date: '2026-12-17', timezone: 'Asia/Seoul', cityLabel: '제주시' },
    ],
  },
];

/** 날짜별로 정렬 키를 순차 부여하는 헬퍼 */
function withSortKeys(
  rows: Omit<Item, 'sortKey' | 'tripId'>[],
  tripId: string,
): Item[] {
  const lastKeyByDate = new Map<string, string>();
  return rows.map((row) => {
    const prev = lastKeyByDate.get(row.date) ?? null;
    const sortKey = prev === null ? firstKey() : keyBetween(prev, null);
    lastKeyByDate.set(row.date, sortKey);
    return { ...row, tripId, sortKey };
  });
}

const SEA_ITEMS: Omit<Item, 'sortKey' | 'tripId'>[] = [
  // ── 1일차: 서울 (국내 프로바이더) ──────────────────────────────
  {
    id: 'i-1',
    date: '2026-11-03',
    kind: 'place',
    title: '집 → 공항철도',
    placeName: '서울역',
    coord: { lat: 37.5547, lng: 126.9707 },
    localTime: '07:20',
    durationMin: 20,
    description: '직통열차 아니어도 됨. 일반열차가 배차 더 촘촘함.',
  },
  {
    id: 'i-2',
    date: '2026-11-03',
    kind: 'place',
    title: '인천공항 도착 · 체크인',
    placeName: '인천국제공항 제1터미널',
    coord: { lat: 37.4492, lng: 126.4505 },
    localTime: '09:00',
    durationMin: 90,
    description: '세라가 기내용 캐리어 규격 확인 필요. 7kg 제한.',
  },
  {
    // 도시간 이동 = 수동 입력 항목. 어떤 길찾기 API도 이걸 못 채운다.
    id: 'i-3',
    date: '2026-11-03',
    kind: 'flight',
    title: '인천 → 방콕',
    placeName: 'ICN → BKK',
    localTime: '11:05',
    durationMin: 350,
    carrierCode: 'KE651',
    description: '현지 15:55 도착 예정 (시차 -2시간 반영된 현지 시각).',
  },
  {
    id: 'i-4',
    date: '2026-11-03',
    kind: 'place',
    title: '숙소 체크인',
    placeName: '아이콘시암 근처 호텔',
    coord: { lat: 13.7263, lng: 100.5101 },
    localTime: '17:30',
    durationMin: 40,
  },

  // ── 2일차: 방콕 (해외, 대중교통 있음) ──────────────────────────
  {
    id: 'i-5',
    date: '2026-11-04',
    kind: 'place',
    title: '왕궁 · 왓 프라깨우',
    placeName: '왓 프라깨우',
    coord: { lat: 13.7515, lng: 100.4925 },
    localTime: '09:00',
    durationMin: 120,
    description: '반바지·민소매 입장 불가. 얇은 긴바지 챙길 것.',
  },
  {
    id: 'i-6',
    date: '2026-11-04',
    kind: 'place',
    title: '점심 · 팟타이',
    placeName: '팁싸마이',
    coord: { lat: 13.7516, lng: 100.5062 },
    localTime: '12:00',
    durationMin: 60,
  },
  {
    id: 'i-7',
    date: '2026-11-04',
    kind: 'place',
    title: '아이콘시암 · 야경',
    placeName: '아이콘시암',
    coord: { lat: 13.7263, lng: 100.5101 },
    localTime: '18:00',
    durationMin: 150,
    description: '수상 분수쇼 18:30, 20:00.',
  },

  // ── 3일차: 방콕 ────────────────────────────────────────────────
  {
    id: 'i-8',
    date: '2026-11-05',
    kind: 'place',
    title: '짜뚜짝 주말시장',
    placeName: '짜뚜짝 주말시장',
    coord: { lat: 13.7999, lng: 100.5502 },
    localTime: '10:00',
    durationMin: 180,
    description: '준호가 여기서 2시간은 더 있고 싶다고 함. 일정 여유 둘 것.',
  },
  {
    id: 'i-8b',
    date: '2026-11-05',
    kind: 'place',
    title: '왓 아룬 (새벽사원)',
    placeName: '왓 아룬',
    coord: { lat: 13.7439, lng: 100.4885 },
    localTime: '14:30',
    durationMin: 90,
    description: '차오프라야 강 건너편. 선착장에서 배로 건넌다.',
  },
  {
    id: 'i-8c',
    date: '2026-11-05',
    kind: 'place',
    title: '카오산로드 저녁',
    placeName: '카오산로드',
    coord: { lat: 13.7596, lng: 100.4958 },
    localTime: '17:00',
    durationMin: 90,
  },
  {
    id: 'i-9',
    date: '2026-11-05',
    kind: 'flight',
    title: '방콕 → 하노이',
    placeName: 'BKK → HAN',
    localTime: '19:40',
    durationMin: 110,
    carrierCode: 'VJ902',
  },

  // ── 4일차: 하노이 (대중교통 데이터 없음 — 폴백 검증용) ─────────
  {
    id: 'i-10',
    date: '2026-11-06',
    kind: 'place',
    title: '호안끼엠 호수 산책',
    placeName: '호안끼엠 호수',
    coord: { lat: 21.0287, lng: 105.8524 },
    localTime: '08:30',
    durationMin: 60,
  },
  {
    id: 'i-11',
    date: '2026-11-06',
    kind: 'place',
    title: '기찻길 마을 카페',
    placeName: '하노이 기찻길 마을',
    coord: { lat: 21.0313, lng: 105.8447 },
    localTime: '10:00',
    durationMin: 90,
    description: '기차 통과 시간대 확인 필요. 단속으로 닫는 날도 있음.',
  },
  {
    id: 'i-12',
    date: '2026-11-06',
    kind: 'place',
    title: '저녁 · 분짜',
    placeName: '분짜 흐엉리엔',
    coord: { lat: 21.0128, lng: 105.8437 },
    localTime: '18:30',
    durationMin: 60,
    // 이 구간은 그랩 바이크가 정답인데 어떤 API도 모른다 → 수동 입력
  },

  // ── 5일차: 도쿄 ────────────────────────────────────────────────
  {
    id: 'i-13',
    date: '2026-11-07',
    kind: 'flight',
    title: '하노이 → 도쿄 나리타',
    placeName: 'HAN → NRT',
    localTime: '00:20',
    durationMin: 300,
    carrierCode: 'VN384',
    description: '심야 출발. 4일차 밤에 공항으로 이동해야 함.',
  },
  {
    id: 'i-14',
    date: '2026-11-07',
    kind: 'place',
    title: '센소지',
    placeName: '센소지',
    coord: { lat: 35.7148, lng: 139.7967 },
    localTime: '13:00',
    durationMin: 90,
  },
  {
    id: 'i-15b',
    date: '2026-11-07',
    kind: 'place',
    title: '우에노공원',
    placeName: '上野公園',
    coord: { lat: 35.714, lng: 139.7739 },
    localTime: '15:30',
    durationMin: 90,
  },
  {
    id: 'i-15',
    date: '2026-11-07',
    kind: 'place',
    title: 'teamLab Planets',
    placeName: 'teamLab Planets',
    coord: { lat: 35.6487, lng: 139.7899 },
    localTime: '16:00',
    durationMin: 120,
    description: '시간 지정 예약 필수. 무릎까지 걷는 구역 있어서 짧은 바지 권장.',
  },

  // ── 6일차: 도쿄 ────────────────────────────────────────────────
  {
    id: 'i-16',
    date: '2026-11-08',
    kind: 'place',
    title: '시부야 스크램블 교차로',
    placeName: '시부야 스크램블 교차로',
    coord: { lat: 35.6595, lng: 139.7004 },
    localTime: '10:30',
    durationMin: 60,
  },
  {
    id: 'i-16b',
    date: '2026-11-08',
    kind: 'place',
    title: '메이지신궁',
    placeName: '明治神宮',
    coord: { lat: 35.6748, lng: 139.6996 },
    localTime: '12:00',
    durationMin: 75,
    description: '시부야에서 한 정거장. 걸어가도 됨.',
  },
  {
    id: 'i-16c',
    date: '2026-11-08',
    kind: 'place',
    title: '신주쿠교엔 산책',
    placeName: '新宿御苑',
    coord: { lat: 35.6851, lng: 139.7095 },
    localTime: '13:30',
    durationMin: 60,
  },
  {
    id: 'i-17',
    date: '2026-11-08',
    kind: 'place',
    title: '나리타 공항 이동',
    placeName: '나리타국제공항 제2터미널',
    coord: { lat: 35.7719, lng: 140.3929 },
    localTime: '15:00',
    durationMin: 90,
    description: '스카이라이너 예약해두면 편함.',
  },
];

const JEJU_ITEMS: Omit<Item, 'sortKey' | 'tripId'>[] = [
  // ── 1일차: 제주시 안쪽. 짧은 구간이라 도보와 대중교통이 맞붙는다 ──
  {
    id: 'j-1',
    date: '2026-12-14',
    kind: 'flight',
    title: '김포 → 제주',
    placeName: 'GMP → CJU',
    localTime: '08:40',
    durationMin: 70,
    carrierCode: 'KE1201',
  },
  {
    id: 'j-2',
    date: '2026-12-14',
    kind: 'place',
    title: '제주공항 도착',
    placeName: '제주국제공항',
    coord: { lat: 33.5071, lng: 126.4916 },
    localTime: '10:00',
    durationMin: 30,
  },
  {
    id: 'j-3',
    date: '2026-12-14',
    kind: 'place',
    title: '숙소 · 작업 세팅',
    placeName: '제주시 연동',
    coord: { lat: 33.4869, lng: 126.4983 },
    localTime: '11:30',
    durationMin: 150,
    description: '와이파이 속도 먼저 확인. 안 되면 카페로.',
  },
  {
    id: 'j-4',
    date: '2026-12-14',
    kind: 'place',
    title: '저녁 · 동문시장',
    placeName: '동문시장',
    coord: { lat: 33.5122, lng: 126.5276 },
    localTime: '18:00',
    durationMin: 90,
    description: '시장 안은 현금만 받는 집이 아직 있음.',
  },

  // ── 2일차: 서쪽 해안. 대중교통이 띄엄띄엄해 차량이 이길 구간 ──
  {
    id: 'j-5',
    date: '2026-12-15',
    kind: 'place',
    title: '이호테우해변',
    placeName: '이호테우해변',
    coord: { lat: 33.4977, lng: 126.4528 },
    localTime: '09:30',
    durationMin: 60,
  },
  {
    id: 'j-6',
    date: '2026-12-15',
    kind: 'place',
    title: '애월 카페거리',
    placeName: '애월읍',
    coord: { lat: 33.4508, lng: 126.3752 },
    localTime: '11:30',
    durationMin: 90,
  },
  {
    id: 'j-7',
    date: '2026-12-15',
    kind: 'place',
    title: '협재해수욕장',
    placeName: '협재해수욕장',
    coord: { lat: 33.3942, lng: 126.241 },
    localTime: '14:00',
    durationMin: 120,
  },
  {
    id: 'j-8',
    date: '2026-12-15',
    kind: 'place',
    title: '중문 색달해변',
    placeName: '중문 색달해변',
    coord: { lat: 33.2448, lng: 126.4108 },
    localTime: '17:00',
    durationMin: 90,
  },

  // ── 3일차: 섬 동쪽 끝까지. 하루 안에서 가장 긴 국내 구간 ──
  // 구간 항목(버스)은 터미널에서 터미널로 간다 — 지도에 점선 한 토막으로 그려진다.
  {
    id: 'j-8b',
    date: '2026-12-16',
    kind: 'bus',
    title: '시외버스로 이동',
    placeName: '제주버스터미널',
    coord: { lat: 33.4996, lng: 126.5158 },
    toPlaceName: '대정읍 방면 정류장',
    toCoord: { lat: 33.2251, lng: 126.2519 },
    localTime: '08:30',
    durationMin: 80,
    carrierCode: '제주 → 대정 시외버스',
  },
  {
    id: 'j-9',
    date: '2026-12-16',
    kind: 'place',
    title: '오설록 티뮤지엄',
    placeName: '오설록',
    coord: { lat: 33.3052, lng: 126.2905 },
    localTime: '10:00',
    durationMin: 90,
  },
  {
    id: 'j-10',
    date: '2026-12-16',
    kind: 'place',
    title: '성산일출봉',
    placeName: '성산일출봉',
    coord: { lat: 33.4589, lng: 126.9408 },
    localTime: '14:00',
    durationMin: 120,
    description: '정상까지 왕복 한 시간. 바람 심하면 통제됨.',
  },
  {
    id: 'j-11',
    date: '2026-12-16',
    kind: 'place',
    title: '섭지코지',
    placeName: '섭지코지',
    coord: { lat: 33.424, lng: 126.9307 },
    localTime: '16:30',
    durationMin: 90,
  },

  // ── 4일차: 시내에서 공항으로 ──
  {
    id: 'j-12',
    date: '2026-12-17',
    kind: 'place',
    title: '제주민속오일시장',
    placeName: '제주민속오일시장',
    coord: { lat: 33.4932, lng: 126.4753 },
    localTime: '09:30',
    durationMin: 90,
  },
  {
    id: 'j-13',
    date: '2026-12-17',
    kind: 'place',
    title: '용두암 산책',
    placeName: '용두암',
    coord: { lat: 33.516, lng: 126.512 },
    localTime: '11:30',
    durationMin: 45,
  },
  {
    id: 'j-14',
    date: '2026-12-17',
    kind: 'place',
    title: '제주공항 도착',
    placeName: '제주국제공항',
    coord: { lat: 33.5071, lng: 126.4916 },
    localTime: '13:00',
    durationMin: 60,
  },
  {
    id: 'j-14b',
    date: '2026-12-17',
    kind: 'ferry',
    title: '(대안) 배편으로 목포',
    placeName: '제주항 여객터미널',
    coord: { lat: 33.5186, lng: 126.5322 },
    toPlaceName: '목포연안여객선터미널',
    toCoord: { lat: 34.7846, lng: 126.3833 },
    localTime: '13:30',
    durationMin: 270,
    carrierCode: '제주 → 목포 퀸메리호',
    description: '비행기 결항 대비. 차를 싣고 갈 수 있음.',
  },
  {
    id: 'j-15',
    date: '2026-12-17',
    kind: 'flight',
    title: '제주 → 김포',
    placeName: 'CJU → GMP',
    localTime: '14:40',
    durationMin: 70,
    carrierCode: 'KE1218',
  },
];

export const MOCK_ITEMS: Item[] = [
  ...withSortKeys(SEA_ITEMS, 't-sea'),
  ...withSortKeys(JEJU_ITEMS, 't-jeju'),
];

export const MOCK_CHECKLIST: ChecklistItem[] = [
  { id: 'c-1', tripId: 't-sea', title: '여권 유효기간 6개월 이상 확인', checked: true, assigneeId: 'u-me' },
  { id: 'c-2', tripId: 't-sea', title: '베트남 전자비자 신청', checked: false, assigneeId: 'u-jun' },
  { id: 'c-3', tripId: 't-sea', title: '여행자보험 4인 단체로', checked: false, assigneeId: 'u-sera' },
  { id: 'c-4', tripId: 't-sea', title: '방콕 공항 → 숙소 그랩 결제수단 등록', checked: false },
  { id: 'c-5', tripId: 't-sea', title: 'teamLab 시간지정 예약', checked: true, assigneeId: 'u-min' },
  { id: 'c-6', tripId: 't-sea', title: '110V 변환 플러그 (일본 구간)', checked: false },
  { id: 'c-7', tripId: 't-sea', title: '현지 유심 또는 eSIM 3개국 커버 확인', checked: false, assigneeId: 'u-me' },
  { id: 'c-8', tripId: 't-jeju', title: '렌터카 예약', checked: false, assigneeId: 'u-me' },
  { id: 'c-9', tripId: 't-jeju', title: '노트북 충전기', checked: false },
];

/**
 * 가계부 예시 — 통화가 섞인 경우(원·밧·엔)와 일부만 나눈 경우를 넣어 둔다.
 * 정산 화면이 한 통화로 모으는지, 환율이 없을 때 통화별로 나누는지 확인하는 용도.
 */
export const MOCK_EXPENSES: Expense[] = [
  {
    id: 'e-1',
    tripId: 't-sea',
    title: '인천 → 방콕 항공권 4명',
    amount: 1_560_000,
    currency: 'KRW',
    paidBy: 'u-me',
    splitAmong: ['u-me', 'u-jun', 'u-sera', 'u-min'],
    spentOn: '2026-11-03',
  },
  {
    id: 'e-2',
    tripId: 't-sea',
    title: '팟타이 점심',
    amount: 480,
    currency: 'THB',
    paidBy: 'u-jun',
    splitAmong: ['u-me', 'u-jun', 'u-sera', 'u-min'],
    spentOn: '2026-11-04',
  },
  {
    id: 'e-3',
    tripId: 't-sea',
    title: '아이콘시암 기념품',
    amount: 1_200,
    currency: 'THB',
    paidBy: 'u-sera',
    splitAmong: ['u-sera', 'u-min'],
    spentOn: '2026-11-04',
  },
  {
    id: 'e-4',
    tripId: 't-sea',
    title: '도쿄 라멘',
    amount: 4_800,
    currency: 'JPY',
    paidBy: 'u-min',
    splitAmong: ['u-me', 'u-jun', 'u-sera', 'u-min'],
    spentOn: '2026-11-07',
  },
];
