/**
 * 한국어 문구 — 원본.
 *
 * en.ts·ja.ts는 `Messages` 타입(= 이 객체의 모양)을 따른다. 여기 문구를
 * 더하면 두 파일에도 넣어야 빌드가 통과한다 — 번역 누락이 배포까지 가지 않는다.
 *
 * 값을 끼워 넣는 문구는 함수로 둔다. 언어마다 어순이 달라서 문장을 조각내
 * 이어 붙이면 번역이 안 된다. 문장 안의 굵은 글씨는 **이렇게** (Rich가 그린다).
 */

import type { ItemKind, TransportMode } from '@/domain/types';

type Region = 'KR' | 'GLOBAL';
type SignInMethod = 'google' | 'apple' | 'dev';

export const ko = {
  common: {
    back: '뒤로',
    menu: '메뉴',
    profile: '프로필',
    mainNav: '주요 화면',
    tripDates: '여행 날짜',
    save: '저장',
    add: '추가',
    delete: '삭제',
    cancel: '취소',
    processing: '처리하는 중…',
    failed: '하지 못했습니다',
    loading: '불러오는 중…',
    beta: '베타',
    tripNotFound: '여행을 찾을 수 없습니다.',
    itemNotFound: '항목을 찾을 수 없습니다.',
    noInfo: '정보 없음',
    querying: '조회 중',
    dayN: (n: number) => `${n}일차`,
    dayWithDate: (n: number, date: string) => `${n}일차 · ${date}`,
  },

  tabs: { home: '홈', schedule: '일정', map: '지도' },

  kind: {
    place: '방문',
    flight: '항공',
    train: '기차',
    bus: '버스',
    ferry: '배편',
  } satisfies Record<ItemKind, string>,

  transport: {
    walk: '도보',
    transit: '대중교통',
    car: '차량',
  } satisfies Record<TransportMode, string>,

  /** 편명 칸에 무엇을 적는지. 종류마다 부르는 이름이 다르다. */
  carrierLabel: {
    place: '',
    flight: '편명',
    train: '열차편',
    bus: '버스 노선',
    ferry: '항로 · 선박',
  } satisfies Record<ItemKind, string>,

  carrierPlaceholder: {
    place: '',
    flight: '예: KE1201',
    train: '예: KTX 101',
    bus: '예: 동서울 → 속초 시외버스',
    ferry: '예: 목포 → 제주 퀸메리호',
  } satisfies Record<ItemKind, string>,

  region: { KR: '국내', GLOBAL: '해외' } satisfies Record<Region, string>,

  /** 일정 사이 이동 구간 칩 */
  leg: {
    transitMissing: '대중교통 정보 없음',
    transitNoRoute: '노선 없음',
    crossBorder: '국제 구간 · 직접 입력',
    crossBorderShort: '국제 구간',
    unknownTap: '이동 정보 없음 · 탭해서 입력',
    needsPlace: '장소를 넣으면 자동 계산',
    unknown: '이동 정보 없음',
    manual: '직접 입력',
  },

  signIn: {
    method: {
      google: 'Google로 계속하기',
      apple: 'Apple로 계속하기',
      dev: '개발용 계정으로 둘러보기',
    } satisfies Record<SignInMethod, string>,
    tagline: '친구들과 함께 만드는 여행 일정',
    invited: '여행에 초대받았습니다. 로그인하면 바로 그 일정으로 들어갑니다.',
    devNote:
      '아직 백엔드가 연결되지 않아 **이 브라우저에만** 세션이 남습니다. 친구 초대와 공동 편집은 Supabase를 연결한 뒤에 동작합니다.',
    privacy: "앱에서 다른 사람에게 보이는 건 닉네임뿐입니다. 로그인에 쓰인 이메일은 보이지 않습니다.",
    privacyLink: "개인정보 처리방침",
  },

  unavailable: {
    title: '잠시 서비스를 이용할 수 없습니다',
    body: '서비스 점검 중이거나 일시적인 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.',
    retry: '다시 시도',
  },

  home: {
    title: '홈',
    list: '일정 리스트',
    empty: '아직 여행이 없습니다. 아래에서 첫 여행을 만들어 보세요.',
    dayCount: (n: number) => `${n}일`,
    bothRegions: '국내 + 해외',
    dday: (n: number) => `D-${n}`,
    departsToday: '오늘 출발',
    ongoing: '여행 중',
    past: '지난 여행',
    newTrip: '새 여행 만들기',
    joinByCode: '초대 코드로 참가',
  },

  today: {
    label: '오늘',
    dayCity: (n: number, city: string) => `${n}일차 · ${city}`,
    localTime: (time: string) => `현지 ${time}`,
    next: '다음 일정',
    inTime: (d: string) => `${d} 후`,
    allDone: '오늘 일정은 다 끝났습니다.',
    empty: '오늘은 아직 일정이 없습니다.',
    weather: {
      clear: '맑음',
      cloudy: '구름',
      fog: '안개',
      rain: '비',
      snow: '눈',
      storm: '뇌우',
    },
    rainChance: (n: number) => `강수 ${n}%`,
    rate: (from: string, to: string) => `1 ${from} ≈ ${to}`,
  },

  trip: {
    title: '일정',
    notFound: '여행을 찾을 수 없습니다. 삭제됐거나 더 이상 멤버가 아닐 수 있습니다.',
    tzBanner: (delta: string, city: string) =>
      `어제와 시차가 **${delta}** 있습니다. 아래 시간은 모두 **${city} 현지 시각**입니다.`,
    emptyDay: '이 날은 아직 비어 있습니다.',
    addItem: '일정 추가',
    /** 일정 화면 위의 바로가기 — 메뉴 속 자주 쓰는 기능을 상태와 함께 */
    shortcuts: '여행 바로가기',
    shortcutChecklist: (done: number, total: number) => total ? `준비물 ${done}/${total}` : '준비물',
    shortcutLedger: (n: number) => n ? `가계부 ${n}건` : '가계부',
    shortcutIdeas: (n: number) => n ? `후보 ${n}` : '후보 장소',
    menuChecklist: '체크리스트',
    timeConflict:
      '앞 일정보다 이른 시각이 있습니다. 자정을 넘기는 일정이 아니라면 순서를 확인해 보세요.',
    timeConflictShort: '앞 일정보다 이른 시각',
    sortByTime: '시각순으로 정렬',
    menuReorder: '순서 바꾸기',
    menuOptimize: '동선 최적화',
    reorderDone: '완료',
    reorderHint: '오른쪽 손잡이를 끌어 순서를 바꾸세요. 적어 둔 시각은 바뀌지 않습니다.',
    reorderHandle: (title: string) => `${title} 옮기기`,
    menuLedger: '가계부',
    menuIdeas: '후보 장소',
    menuCalendar: '캘린더로 내보내기',
    menuShare: '친구에게 공유',
    menuMembers: '멤버 · 초대 코드',
    menuDelete: '여행 삭제',
    menuLeave: '여행에서 나가기',
    deleteTitle: '여행을 삭제할까요?',
    deleteConfirm: '삭제',
    deleteBody: (name: string) =>
      `**${name}**의 일정·준비물이 모두 지워집니다. 되돌릴 수 없습니다.`,
    deleteOthers: (n: number) => `함께하던 ${n}명도 더 이상 이 여행을 볼 수 없습니다.`,
    leaveTitle: '여행에서 나갈까요?',
    leaveConfirm: '나가기',
    leaveBody: (name: string) =>
      `내 목록에서 **${name}** 여행이 사라집니다. 일정은 남은 사람들에게 그대로 남습니다.`,
    leaveRejoin: '다시 들어오려면 초대 링크를 새로 받아야 합니다.',
  },

  optimize: {
    title: '동선 최적화',
    distance: (before: string, after: string) => `이동 거리 ${before} → ${after}`,
    saving: (pct: number) => `${pct}% 짧아집니다 (직선거리 기준)`,
    noGain: '지금 순서가 이미 가장 짧습니다.',
    note: '첫 일정, 기차·항공 같은 구간, 좌표가 없는 일정은 옮기지 않습니다. 적어 둔 시각은 그대로입니다.',
    timesOff: '⚠ 적어 둔 시각과 순서가 어긋나는 일정이 생깁니다. 바꾼 뒤 시각을 고쳐 주세요.',
    apply: '이 순서로 바꾸기',
    close: '닫기',
    moved: '옮겨짐',
  },

  dayEdit: {
    label: '날짜 설정',
    city: '도시',
    timezone: '타임존',
    keepTimes: (city: string) =>
      `일정 시간은 그대로 둡니다. 09:00 일정은 ${city} 현지 09:00이 됩니다.`,
    withFollowing: (n: number) => `뒤로 이어지는 ${n}일도 같이 바꾸기`,
    until: (date: string, city: string) => `${date}까지 · 지금 ${city}`,
  },

  tripCreate: {
    title: '새 여행',
    create: '만들기',
    creating: '만드는 중…',
    cover: '표지',
    coverAria: (emoji: string) => `표지 ${emoji}`,
    name: '여행 이름',
    namePlaceholder: '예: 동남아 + 도쿄 6일',
    start: '시작',
    end: '종료',
    timezone: '기본 타임존',
    timezoneHint:
      '모든 날짜에 이 타임존이 붙습니다. 도시를 옮기는 날은 일정 화면에서 도시 이름을 눌러 그 날부터 고치면 됩니다.',
    dateCount: (n: number) => `만들어질 날짜 ${n}일`,
    submit: '여행 만들기',
    failed: '여행을 만들지 못했습니다',
  },

  itemEdit: {
    deleteTitle: "이 일정을 지울까요?",
    deleteBody: ["같은 여행 친구들 화면에서도 사라집니다.", "달린 댓글도 함께 지워지고, 되돌릴 수 없습니다."],
    titleNew: '일정 추가',
    titleEdit: '일정 수정',
    date: '날짜',
    dateMoveHint: '그 날의 맨 뒤로 옮깁니다. 시각은 그대로입니다.',
    kind: '종류',
    title: '제목',
    titlePlaceholder: '예: 점심 · 분짜',
    place: '장소',
    placePlaceholder: '장소 검색 (예: 호안끼엠)',
    depart: '출발 터미널',
    departPlaceholder: '예: 서울역, 동서울종합터미널',
    arrive: '도착 터미널',
    arrivePlaceholder: '예: 부산역, 제주항 여객터미널',
    time: '시각',
    stay: '머무는 시간',
    minutesSuffix: '분',
    bookingRef: '예약 번호',
    bookingRefPlaceholder: '항공권·숙소·투어 예약 번호',
    memo: '메모',
    memoPlaceholder: '예약 번호, 준비물, 주의할 점…',
    defaultTitle: '새 일정',
  },

  itemDetail: {
    stay: (d: string) => `체류 ${d}`,
    howToMove: '이동 방법',
    firstOfDay: '이 날의 첫 일정입니다. 이전 구간이 없습니다.',
    transitMissing:
      '대중교통 경로를 찾지 못했습니다. 이 지역에 데이터가 없거나 그 시간에 다니는 노선이 없을 수 있어요. 도보·차량만 계산했으니, 그랩·툭툭 같은 현지 수단을 쓴다면 아래에서 직접 적어두세요.',
    crossBorder:
      '국경을 넘는 구간입니다. 길찾기로는 계산되지 않으니 항공편·기차 정보를 직접 입력해 주세요.',
    moveTime: '이동 시간',
    minus5: '5분 줄이기',
    plus5: '5분 늘리기',
    saveManual: '직접 입력한 시간으로 저장',
    manualNote: '직접 입력한 값입니다. 길찾기 결과로 덮어쓰지 않습니다.',
    revertAuto: '자동 계산으로 되돌리기',
    memo: '메모',
    noMemo: '아직 메모가 없습니다.',
    drawnLine: '지도에 그려진 선',
    viaTransit: '조회된 대중교통 노선',
    viaCar: '도로·항로를 따라간 차량 경로',
    straight: '경로를 못 찾아 두 터미널을 직선(점선)으로 이었습니다.',
    coordNote: '좌표만 보고 찾은 경로입니다.',
    carrierDiffers: (code: string) => ` 적어두신 "${code}"와 다를 수 있습니다.`,
    edit: '수정',
    copy: '복사',
    copied: '복사했습니다',
  },

  edited: {
    leftMember: '나간 멤버',
    /** name이 null이면 나 */
    title: (name: string | null, when: string) =>
      `${name === null ? '내가' : `${name}님이`} 고침${when ? ` · ${when}` : ''}`,
    line: (name: string | null) => `${name === null ? '내가' : `${name}님이`} 마지막으로 고침`,
  },

  map: {
    title: '지도',
    noCoords: '이 날은 좌표가 있는 일정이 없습니다.',
    noTime: '시간 미정',
    startPoint: '이 날의 출발 지점입니다.',
    loading: '지도를 불러오는 중…',
    failed: '지도를 불러오지 못했습니다',
    fallback: '지도를 불러오지 못해 간략 지도로 보여드립니다. 일정 순서와 동선은 그대로입니다.',
    schematic: '간략 지도',
    /** 지도 번호 마커를 화면 읽기 도구가 읽는 말 */
    pinAria: (n: string, time: string | undefined, name: string) =>
      `${n}번 지점: ${time ? `${time} ` : ''}${name}`,
  },

  place: {
    searchFailed: '장소를 찾지 못했습니다',
    searchHttpFailed: (status: number) =>
      `장소 검색에 실패했습니다 (${status}). 잠시 후 다시 시도해 주세요.`,
    searching: '찾는 중…',
    noResults:
      '후보가 없습니다. 해외 장소는 현지어나 영어로 쳐보세요 (예: 도쿄 스카이트리 → Tokyo Skytree).',
    noCoord: '좌표가 없어 지도에는 표시되지 않습니다.',
  },

  credits: {
    title: '데이터 출처',
    searchUse: '장소 검색 · 길찾기',
    osm: '© OpenStreetMap 기여자',
    ratesUse: '환율',
    weatherUse: '날씨',
    transitUse: '대중교통',
    transitous: 'Transitous (교통기관 GTFS)',
  },

  ledger: {
    title: '가계부',
    needsDb: '가계부를 아직 쓸 수 없습니다. 잠시 후 다시 열어 주세요.',
    total: '총 지출',
    myShare: '내 부담',
    settleIn: '정산 통화',
    settleTitle: '정산',
    allSettled: '더 주고받을 돈이 없습니다.',
    byCurrency: '환율을 불러오지 못해 통화별로 따로 정산했습니다.',
    ratesAsOf: (date: string) => `환율은 ${date} 기준입니다.`,
    empty: '아직 적은 지출이 없습니다. 누가 냈는지만 적어 두면 정산은 앱이 합니다.',
    add: '지출 추가',
    addTitle: '지출 추가',
    editTitle: '지출 수정',
    what: '어디에 썼나요',
    whatPlaceholder: '예: 저녁 · 쏨땀',
    amount: '금액',
    currency: '통화',
    paidBy: '낸 사람',
    splitAmong: '나눠 낼 사람',
    splitEach: (n: number, each: string) => `${n}명이 ${each}씩`,
    splitNone: '한 명 이상 골라 주세요',
    date: '날짜',
    noDate: '날짜 없음',
    paidLine: (name: string, n: number) => `${name} 결제 · ${n}명`,
    deleteTitle: '이 지출을 지울까요?',
    deleteBody: '정산도 다시 계산됩니다.',
    approx: (amount: string) => `≈ ${amount}`,
    sends: '보낼 사람',
    receives: '받을 사람',
  },

  ideas: {
    title: '후보 장소',
    needsDb: '후보 장소를 아직 쓸 수 없습니다. 잠시 후 다시 열어 주세요.',
    empty: '가고 싶은 곳을 올리고 투표해 보세요. 표를 많이 받은 곳부터 일정에 넣으면 됩니다.',
    add: '후보 올리기',
    addTitle: '후보 장소 올리기',
    where: '어디',
    wherePlaceholder: '장소 검색 (예: 성수동 카페거리)',
    note: '한마디',
    notePlaceholder: '왜 가고 싶은지, 가격, 예약 필요 여부…',
    addedBy: (name: string) => `${name} 올림`,
    vote: '가고 싶어요',
    voted: '투표함',
    votes: (n: number) => `${n}표`,
    toPlan: '일정에 넣기',
    toPlanTitle: '어느 날에 넣을까요?',
    toPlanHint: '그 날 일정 맨 뒤에 들어가고, 후보 목록에서는 빠집니다.',
    removeTitle: (name: string) => `'${name}' 후보를 지울까요?`,
    removeBody: '받은 표도 함께 지워집니다.',
  },

  comments: {
    title: '댓글',
    placeholder: '댓글 달기',
    send: '보내기',
    empty: '아직 댓글이 없습니다.',
    delete: '지우기',
    count: (n: number) => `댓글 ${n}개`,
  },

  checklist: {
    title: '체크리스트',
    empty: '아직 항목이 없습니다.',
    addPlaceholder: '항목 추가',
  },

  members: {
    title: '멤버',
    screenTitle: '멤버 · 초대',
    code: '초대 코드',
    codeAria: (spelled: string) => `초대 코드 ${spelled}`,
    sendLink: '초대 링크 보내기',
    regenerate: '초대 코드 바꾸기',
    count: (n: number) => `함께하는 사람 ${n}명`,
    me: ' (나)',
    owner: '만든 사람',
    kick: '내보내기',
    alone: '아직 혼자입니다. 초대 링크를 보내면 친구가 바로 들어와 같이 고칠 수 있습니다.',
    kickTitle: (name: string) => `${name}님을 내보낼까요?`,
    kickBody: '이 여행을 더 이상 볼 수 없게 됩니다. 이미 고친 일정은 그대로 남습니다.',
    kickBody2:
      '초대 링크를 아직 갖고 있으면 다시 들어올 수 있습니다. 막으려면 초대 코드도 바꾸세요.',
    regenTitle: '초대 코드를 바꿀까요?',
    regenConfirm: '새 코드 만들기',
    regenBody: (code: string) =>
      `지금까지 보낸 링크와 코드 **${code}**로는 더 이상 들어올 수 없습니다.`,
    regenBody2: '이미 들어온 멤버는 그대로입니다.',
  },

  invite: {
    title: '초대 참가',
    joining: '참가하는 중…',
    code: '초대 코드',
    placeholder: '예: 5G5D5UNX',
    hint: '대소문자는 가리지 않습니다. 친구에게 받은 링크를 열면 이 화면이 알아서 참가시킵니다.',
    join: '참가하기',
    goHome: '홈으로',
    failed: '참가하지 못했습니다',
  },

  /** 공유 메시지는 보내는 사람의 언어로 만든다 */
  share: {
    text: (name: string, code: string) => `${name} 일정을 함께 봐요 (초대 코드 ${code})`,
    textNoUrl: (name: string, code: string) =>
      `${name} 일정을 함께 봐요\n초대 코드: ${code}\n앱에서 "초대 코드로 참가"를 누르고 입력하세요.`,
    copiedLink: '초대 링크를 복사했습니다',
    copiedCode: '초대 코드를 복사했습니다',
    codeToast: (code: string) => `초대 코드: ${code}`,
  },

  profile: {
    title: '프로필',
    notSignedIn: '로그인 상태가 아닙니다.',
    via: {
      google: 'Google 계정으로 로그인됨',
      apple: 'Apple 계정으로 로그인됨',
      dev: '개발용 계정으로 로그인됨',
    } satisfies Record<SignInMethod, string>,
    nickname: '닉네임',
    nicknamePlaceholder: '친구들에게 보일 이름',
    nicknameHint: (tag: string | undefined) =>
      `다른 사람과 같아도 됩니다${tag ? `. 뒤의 번호(#${tag})로 구분합니다` : ''}. 언제든 바꿀 수 있습니다.`,
    saved: '저장했습니다',
    saveNickname: '닉네임 저장',
    signOut: '로그아웃',
    privacy: "앱에서 다른 사람에게 보이는 건 닉네임뿐입니다. 로그인에 쓰인 이메일은 보이지 않습니다.",
    privacyLink: "개인정보 처리방침",
    /** 처음 가입할 때 붙는 닉네임. 가입한 사람의 언어로 정해진다. */
    defaultNickname: '여행자',
    language: '언어',
    languageAuto: '기기 언어 따르기',
    languageAutoHint: (name: string) => `지금 기기 언어: ${name}`,
    languageManualHint: '이 기기에서만 고른 언어로 보입니다.',
    deleteAccount: "회원 탈퇴",
    deleteTitle: "회원 탈퇴할까요?",
    deleteConfirm: "탈퇴하기",
    /** 탈퇴하면 무엇이 어떻게 되는지 — 확인 창에 한 줄씩 */
    deleteBody: ["닉네임과 로그인 정보(이메일 등)가 바로 지워지고, 되돌릴 수 없습니다.", "내가 만든 여행은 함께하는 멤버 중 가장 먼저 들어온 사람에게 넘어갑니다. 혼자인 여행은 지워집니다.", "같이 쓰던 여행에 남긴 일정·댓글·지출은 남고, 작성자는 「나간 멤버」로 보입니다."],
    deleteFailed: "탈퇴하지 못했습니다",
  },

  privacyPage: {
    title: "개인정보 처리방침",
    effective: "시행일",
    /** 번역본이면 공식 문서가 한국어라는 안내. 한국어는 null */
    authoritative: null as string | null,
  },

  nicknameSetup: {
    title: '뭐라고 불러 드릴까요?',
    sub: '같은 여행 친구들에게 이 이름으로 보입니다.',
    placeholder: '예: 하늘',
    hint: '다른 사람과 같아도 됩니다. 프로필에서 언제든 바꿀 수 있습니다.',
    invited: '닉네임을 정하면 초대받은 여행으로 바로 들어갑니다.',
    start: '시작하기',
    later: '나중에 정하기',
  },

  offline: {
    offline: '오프라인 — 마지막으로 불러온 일정입니다. 고친 내용은 저장되지 않을 수 있습니다.',
    serverDown: '서버에 연결하지 못해 마지막으로 불러온 일정을 보여 드립니다.',
  },

  nickname: {
    empty: '닉네임을 입력해 주세요',
    tooLong: (max: number) => `닉네임은 ${max}자까지입니다`,
    hash: "닉네임에는 '#'을 쓸 수 없습니다",
  },

  /** 데이터 계층 오류. 뒤에 서버가 준 원문이 붙는다. */
  errors: {
    signInFailed: '로그인하지 못했습니다',
    signInCancelled: '로그인을 취소했습니다',
    signInNoCode: '로그인 응답에 코드가 없습니다',
    unsupportedMethod: '지원하지 않는 로그인 방식입니다',
    notSignedIn: '로그인 상태가 아닙니다',
    needSignIn: '로그인이 필요합니다',
    nicknameFailed: '닉네임을 바꾸지 못했습니다',
    readProfile: '프로필을 읽지 못했습니다',
    createProfile: '프로필을 만들지 못했습니다',
    saveFailed: '저장하지 못했습니다',
    readTrips: '여행을 읽지 못했습니다',
    readMembers: '멤버를 읽지 못했습니다',
    readDays: '날짜를 읽지 못했습니다',
    readItems: '항목을 읽지 못했습니다',
    createTrip: '여행을 만들지 못했습니다',
    createDays: '날짜를 만들지 못했습니다',
    removeMember: '멤버를 빼지 못했습니다',
    removeMemberNone: '권한이 없거나 이미 빠진 멤버입니다',
    deleteTrip: '여행을 지우지 못했습니다',
    deleteTripNotOwner: '여행을 만든 사람만 지울 수 있습니다',
    createItem: '일정을 만들지 못했습니다',
    updateItem: '일정을 고치지 못했습니다',
    deleteItem: '일정을 지우지 못했습니다',
    updateDays: '날짜를 고치지 못했습니다',
    addChecklist: '준비물을 추가하지 못했습니다',
    updateChecklist: '준비물을 고치지 못했습니다',
    deleteChecklist: '준비물을 지우지 못했습니다',
    addExpense: '지출을 적지 못했습니다',
    updateExpense: '지출을 고치지 못했습니다',
    deleteExpense: '지출을 지우지 못했습니다',
    addPlace: '후보 장소를 올리지 못했습니다',
    removePlace: '후보 장소를 지우지 못했습니다',
    vote: '투표하지 못했습니다',
    addComment: '댓글을 달지 못했습니다',
    deleteComment: '댓글을 지우지 못했습니다',
  },

  /**
   * DB 함수가 던지는 문구(supabase/*.sql). 한국어 값이 곧 DB 원문이라
   * translateServerError가 이 값으로 찾는다 — 여기 한국어는 SQL과 같게 둔다.
   */
  serverErrors: {
    needSignIn: '로그인이 필요합니다',
    codeNotFound: '초대 코드를 찾을 수 없습니다',
    onlyOwnerRegenerate: '여행을 만든 사람만 초대 코드를 바꿀 수 있습니다',
    regenerateFailed: '초대 코드를 만들지 못했습니다. 다시 시도해 주세요',
    nicknameCrowded: '이 닉네임을 쓰는 사람이 너무 많습니다. 다른 닉네임을 써 주세요',
    /** limits.sql — 앞부분만 맞춰 찾는다(뒤에 표 이름·숫자가 붙는다) */
    tooMany: '한 여행에 넣을 수 있는 개수를 넘었습니다',
    tooManyTrips: '만들 수 있는 여행 수를 넘었습니다',
  },
};

export type Messages = typeof ko;
