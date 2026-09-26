/**
 * 개인정보 처리방침 본문.
 *
 * 개인정보 보호법 제30조(처리방침 공개)의 항목을 따른다. 공식 문서는 한국어이고,
 * 영어·일본어는 번역본이다(화면 위에 그렇게 밝힌다).
 *
 * ── 바꿀 때 ──────────────────────────────────────────────────────
 * - 새로 모으는 정보가 생기거나(새 칸, 새 외부 서비스) 보내는 곳이 바뀌면 여기를 먼저 고친다.
 *   특히 외부 서비스를 붙이면 "처리 위탁·국외 이전" 표에 더한다.
 * - 고치면 EFFECTIVE_DATE를 바꾼다. 세 언어를 같이 고친다.
 * - 사실과 다르면 법 위반이다. "저장하지 않는다" 같은 말은 확인하고 쓴다
 *   (예: Google 로그인 정보는 Supabase 인증에 저장된다 — 앱이 읽지 않을 뿐).
 */

import type { Locale } from '@/i18n';

/** 시행일 */
export const EFFECTIVE_DATE = '2026-09-26';

/** 개인정보 보호책임자 — 운영자. 연락처는 실제로 답을 받는 곳이어야 한다. */
export const OPERATOR = {
  name: 'TravelTomodachi 운영자 (GitHub: HaneulHong)',
  contact: 'https://github.com/HaneulHong/TravelTomodachi/issues',
};

/**
 * Supabase 프로젝트의 서버 지역. 대시보드 → Project Settings → General → Region.
 * 2026-09-26 확인: DB 서버 주소가 AWS ap-northeast-2(서울) 대역이다.
 */
export const SUPABASE_REGION = {
  ko: '대한민국 서울',
  en: 'Seoul, South Korea',
  ja: '韓国・ソウル',
} satisfies Record<Locale, string>;

export interface PolicySection {
  title: string;
  /** 문단. 표는 rows로 */
  paragraphs?: string[];
  items?: string[];
  table?: { head: string[]; rows: string[][] };
  /** 표 아래에 붙는 안내 */
  note?: string;
}

const ko: PolicySection[] = [
  {
    title: '1. 처리 목적',
    paragraphs: [
      'TravelTomodachi(이하 "서비스")는 친구와 함께 여행 일정을 만들고 공유하기 위해 아래 목적으로만 개인정보를 처리합니다.',
    ],
    items: [
      '회원 식별과 로그인 유지',
      '같은 여행 멤버에게 누가 어떤 일정을 쓰고 고쳤는지 보여 주기',
      '초대, 공동 편집, 댓글·투표·가계부 정산 같은 서비스 기능 제공',
      '부정 이용 방지와 보안 점검',
    ],
  },
  {
    title: '2. 처리하는 개인정보 항목',
    table: {
      head: ['구분', '항목', '어디에'],
      rows: [
        ['가입·로그인 (필수)', 'Google 계정 식별자, 이메일 주소, 이름, 프로필 사진 주소 — Google이 로그인할 때 보내는 정보', 'Supabase 인증 시스템. 서비스 화면과 다른 이용자에게는 보이지 않습니다'],
        ['프로필 (필수)', '닉네임, 닉네임 번호(#1234)', '서비스 DB. 같은 여행 멤버에게 보입니다'],
        ['이용 중 입력', '여행 이름·기간, 일정(장소·좌표·시각·메모·예약 번호), 체크리스트, 지출, 후보 장소, 투표, 댓글', '서비스 DB. 같은 여행 멤버에게 보입니다'],
        ['자동 생성', '접속 IP 주소, 브라우저 정보, 접속 시각 (서버 기록)', 'Supabase·Cloudflare 서버 기록'],
      ],
    },
    note: '메모·예약 번호 같은 입력 칸에는 주민등록번호·카드 번호·여권 번호 등 민감한 정보를 적지 않도록 해 주세요. 같은 여행 멤버 모두에게 보입니다.',
  },
  {
    title: '3. 처리 및 보유 기간',
    items: [
      '회원 정보(로그인 정보·닉네임): 회원 탈퇴 시까지. 탈퇴하면 바로 지웁니다.',
      '이용 중 입력한 내용: 그 여행이 지워질 때까지. 탈퇴해도 다른 멤버와 같이 쓰던 여행에 남긴 일정·댓글·지출은 남고, 작성자 표시는 지워집니다(「나간 멤버」로 표시).',
      '서버 기록: 각 서비스 제공자(Supabase·Cloudflare)의 보관 기간에 따릅니다.',
    ],
  },
  {
    title: '4. 제3자 제공',
    paragraphs: [
      '서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 서비스의 성격상 여행에 참가한 멤버끼리는 서로의 닉네임과 그 여행에 입력한 내용을 볼 수 있습니다.',
    ],
  },
  {
    title: '5. 처리 위탁 및 국외 이전',
    paragraphs: [
      '서비스 운영을 위해 아래 업체에 처리를 맡기며, 일부는 국외에서 처리됩니다. 정보는 서비스를 이용할 때 인터넷(암호화 통신)으로 전송되고, 각 업체의 보관 기간 동안 보관됩니다. 국외 이전을 원하지 않으면 회원 탈퇴로 거부할 수 있으나, 이 경우 서비스를 이용할 수 없습니다.',
    ],
    table: {
      head: ['받는 곳 (국가)', '맡기는 일', '보내는 정보'],
      rows: [
        [`Supabase Inc. (미국 법인, 서버: ${SUPABASE_REGION.ko})`, '데이터 저장, 로그인, 실시간 동기화', '2번의 모든 항목'],
        ['Cloudflare, Inc. (미국, 전 세계 서버)', '웹사이트 전송', '접속 IP·브라우저 정보'],
        ['Google LLC (미국)', 'Google 로그인, 해외 지도 표시', '로그인 정보, 지도에 표시할 좌표, 접속 IP'],
        ['㈜카카오 (대한민국)', '국내 지도 표시', '지도에 표시할 좌표, 접속 IP'],
        ['Photon·Valhalla(OpenStreetMap 기반, 독일), Transitous(독일)', '장소 검색, 길찾기, 대중교통 조회', '검색어, 출발·도착 좌표, 접속 IP'],
        ['Open-Meteo(스위스), ExchangeRate-API(영국)', '날씨, 환율', '도시 좌표(날씨), 접속 IP'],
      ],
    },
  },
  {
    title: '6. 파기 절차와 방법',
    items: [
      '회원 탈퇴를 누르면 로그인 정보와 프로필을 DB에서 즉시 지웁니다. 지운 정보는 되살릴 수 없습니다.',
      '이용자 기기에 저장된 정보(로그인 상태, 오프라인용 일정 사본)는 로그아웃하거나 탈퇴하면 지웁니다.',
    ],
  },
  {
    title: '7. 이용자의 권리와 행사 방법',
    items: [
      '열람·정정: 서비스 화면에서 언제든 보고 고칠 수 있습니다(닉네임은 프로필에서).',
      '삭제·처리정지: 프로필 → 회원 탈퇴로 직접 할 수 있습니다.',
      '그 밖의 요청은 아래 개인정보 보호책임자에게 연락하면 지체 없이 처리합니다.',
    ],
  },
  {
    title: '8. 만 14세 미만 아동',
    paragraphs: ['서비스는 만 14세 미만 아동의 가입을 받지 않습니다.'],
  },
  {
    title: '9. 자동 수집 장치',
    paragraphs: [
      '서비스는 광고·추적용 쿠키를 쓰지 않습니다. 로그인 상태, 언어 설정, 오프라인에서 볼 일정 사본을 이용자 기기의 브라우저 저장소에 둡니다. 브라우저 설정에서 지울 수 있으며, 지우면 다시 로그인해야 합니다.',
    ],
  },
  {
    title: '10. 안전성 확보 조치',
    items: [
      '모든 통신은 암호화(HTTPS)합니다.',
      '데이터베이스 접근 통제: 여행 정보는 그 여행 멤버만 보고 고칠 수 있도록 DB 단에서 막습니다.',
      '관리용 비밀 키는 서비스 코드에 두지 않습니다.',
      '권한 시나리오를 자동으로 시험하는 보안 점검을 정기적으로 합니다.',
    ],
  },
  {
    title: '11. 개인정보 보호책임자',
    items: [`책임자: ${OPERATOR.name}`, `연락처: ${OPERATOR.contact}`],
  },
  {
    title: '12. 권익침해 구제 방법',
    paragraphs: ['개인정보 침해에 대한 신고나 상담은 아래 기관에 할 수 있습니다.'],
    items: [
      '개인정보침해신고센터: privacy.kisa.or.kr / 국번 없이 118',
      '개인정보분쟁조정위원회: kopico.go.kr / 1833-6972',
      '대검찰청 사이버수사과: spo.go.kr / 국번 없이 1301',
      '경찰청 사이버수사국: ecrm.police.go.kr / 국번 없이 182',
    ],
  },
  {
    title: '13. 처리방침의 변경',
    paragraphs: [`이 처리방침은 ${EFFECTIVE_DATE}부터 적용됩니다. 내용이 바뀌면 시행 전에 서비스 화면으로 알립니다.`],
  },
];

const en: PolicySection[] = [
  {
    title: '1. Why we process personal data',
    paragraphs: ['TravelTomodachi ("the service") processes personal data only to let you plan and share trips with friends:'],
    items: [
      'Identifying members and keeping you signed in',
      'Showing trip members who wrote or changed what',
      'Providing invites, shared editing, comments, votes and expense splitting',
      'Preventing abuse and checking security',
    ],
  },
  {
    title: '2. What we process',
    table: {
      head: ['Type', 'Data', 'Where'],
      rows: [
        ['Sign-up & sign-in (required)', 'Google account ID, email, name, profile photo URL — sent by Google when you sign in', 'Supabase authentication. Not shown in the app or to other users'],
        ['Profile (required)', 'Nickname and its number (#1234)', 'Service database. Visible to members of your trips'],
        ['What you enter', 'Trip names and dates, plans (places, coordinates, times, notes, booking numbers), checklists, expenses, suggested places, votes, comments', 'Service database. Visible to members of that trip'],
        ['Generated automatically', 'IP address, browser details, access time (server logs)', 'Supabase and Cloudflare server logs'],
      ],
    },
    note: 'Please don’t put sensitive data (ID, card or passport numbers) in notes or booking numbers — every member of the trip can see them.',
  },
  {
    title: '3. How long we keep it',
    items: [
      'Account data (sign-in details, nickname): until you delete your account, then immediately deleted.',
      'What you enter: until the trip is deleted. If you delete your account, plans, comments and expenses you added to shared trips remain without your name (shown as “former member”).',
      'Server logs: per each provider’s (Supabase, Cloudflare) retention period.',
    ],
  },
  {
    title: '4. Sharing with third parties',
    paragraphs: ['We don’t provide your personal data to third parties. By the nature of the service, members of a trip can see each other’s nicknames and what they entered in that trip.'],
  },
  {
    title: '5. Processors and transfers abroad',
    paragraphs: ['We use the following processors, some outside Korea. Data is sent over encrypted connections when you use the service and kept for each provider’s retention period. You can refuse the transfer by deleting your account, but then you can’t use the service.'],
    table: {
      head: ['Recipient (country)', 'Purpose', 'Data sent'],
      rows: [
        [`Supabase Inc. (US company, servers in ${SUPABASE_REGION.en})`, 'Storage, sign-in, real-time sync', 'Everything in section 2'],
        ['Cloudflare, Inc. (USA, global servers)', 'Delivering the website', 'IP address, browser details'],
        ['Google LLC (USA)', 'Google sign-in, maps outside Korea', 'Sign-in details, map coordinates, IP address'],
        ['Kakao Corp. (Korea)', 'Maps in Korea', 'Map coordinates, IP address'],
        ['Photon, Valhalla (OpenStreetMap-based, Germany), Transitous (Germany)', 'Place search, directions, public transport', 'Search terms, start/end coordinates, IP address'],
        ['Open-Meteo (Switzerland), ExchangeRate-API (UK)', 'Weather, exchange rates', 'City coordinates (weather), IP address'],
      ],
    },
  },
  {
    title: '6. Deletion',
    items: [
      'Deleting your account removes your sign-in details and profile from the database immediately. This can’t be undone.',
      'Data on your device (sign-in state, offline copy of trips) is removed when you sign out or delete your account.',
    ],
  },
  {
    title: '7. Your rights',
    items: [
      'See and correct: anytime in the app (nickname in Profile).',
      'Delete or stop processing: Profile → Delete account.',
      'For anything else, contact the privacy officer below.',
    ],
  },
  { title: '8. Children under 14', paragraphs: ['Children under 14 may not sign up.'] },
  {
    title: '9. Cookies and local storage',
    paragraphs: ['We don’t use advertising or tracking cookies. Your sign-in state, language setting and an offline copy of your trips are kept in your browser’s storage. You can clear them in your browser; you’ll need to sign in again.'],
  },
  {
    title: '10. Security measures',
    items: [
      'All connections are encrypted (HTTPS).',
      'Database access control: only members of a trip can see or change it, enforced by the database.',
      'Admin secret keys are never in the app’s code.',
      'Regular security checks with automated permission tests.',
    ],
  },
  { title: '11. Privacy officer', items: [`Officer: ${OPERATOR.name}`, `Contact: ${OPERATOR.contact}`] },
  {
    title: '12. Remedies',
    paragraphs: ['You can report or get advice on privacy violations from:'],
    items: [
      'Personal Information Infringement Report Center: privacy.kisa.or.kr / 118',
      'Personal Information Dispute Mediation Committee: kopico.go.kr / 1833-6972',
      'Supreme Prosecutors’ Office Cyber Investigation: spo.go.kr / 1301',
      'Korean National Police Agency Cyber Bureau: ecrm.police.go.kr / 182',
    ],
  },
  { title: '13. Changes', paragraphs: [`This policy applies from ${EFFECTIVE_DATE}. We’ll announce changes in the app before they take effect.`] },
];

const ja: PolicySection[] = [
  {
    title: '1. 処理の目的',
    paragraphs: ['TravelTomodachi（以下「本サービス」）は、友だちと旅行の予定を作って共有するために、次の目的でのみ個人情報を処理します。'],
    items: [
      '会員の識別とログイン状態の維持',
      '同じ旅行のメンバーに、誰がどの予定を書いたり変えたりしたかを示すこと',
      '招待、共同編集、コメント・投票・割り勘など本サービスの機能の提供',
      '不正利用の防止とセキュリティ点検',
    ],
  },
  {
    title: '2. 処理する個人情報',
    table: {
      head: ['区分', '項目', '保管先'],
      rows: [
        ['登録・ログイン（必須）', 'Google アカウント識別子、メールアドレス、名前、プロフィール写真の URL — ログイン時に Google から送られる情報', 'Supabase の認証システム。画面やほかの利用者には表示されません'],
        ['プロフィール（必須）', 'ニックネーム、ニックネーム番号（#1234）', '本サービスのデータベース。同じ旅行のメンバーに表示されます'],
        ['利用中の入力', '旅行名・期間、予定（場所・座標・時刻・メモ・予約番号）、チェックリスト、支出、候補地、投票、コメント', '本サービスのデータベース。その旅行のメンバーに表示されます'],
        ['自動生成', '接続 IP アドレス、ブラウザ情報、接続時刻（サーバーの記録）', 'Supabase・Cloudflare のサーバー記録'],
      ],
    },
    note: 'メモや予約番号の欄には、マイナンバー・カード番号・パスポート番号などの機微な情報を書かないでください。旅行のメンバー全員に表示されます。',
  },
  {
    title: '3. 処理・保有期間',
    items: [
      '会員情報（ログイン情報・ニックネーム）：退会まで。退会するとすぐに削除します。',
      '利用中に入力した内容：その旅行が削除されるまで。退会しても、共有していた旅行に残した予定・コメント・支出は残り、作成者の表示は消えます（「退出したメンバー」と表示）。',
      'サーバーの記録：各提供者（Supabase・Cloudflare）の保管期間に従います。',
    ],
  },
  {
    title: '4. 第三者提供',
    paragraphs: ['本サービスは利用者の個人情報を第三者に提供しません。ただしサービスの性質上、旅行に参加したメンバー同士は、互いのニックネームとその旅行に入力した内容を見ることができます。'],
  },
  {
    title: '5. 処理の委託と国外移転',
    paragraphs: ['本サービスの運営のため、次の事業者に処理を委託しており、一部は国外で処理されます。情報はサービス利用時に暗号化通信で送られ、各事業者の保管期間中保管されます。国外移転を望まない場合は退会により拒否できますが、その場合サービスは利用できません。'],
    table: {
      head: ['受け取る者（国）', '委託する業務', '送る情報'],
      rows: [
        [`Supabase Inc.（米国法人、サーバー：${SUPABASE_REGION.ja}）`, 'データ保存、ログイン、リアルタイム同期', '2. のすべての項目'],
        ['Cloudflare, Inc.（米国、世界各地のサーバー）', 'ウェブサイトの配信', '接続 IP、ブラウザ情報'],
        ['Google LLC（米国）', 'Google ログイン、海外の地図表示', 'ログイン情報、地図に表示する座標、接続 IP'],
        ['Kakao Corp.（韓国）', '韓国国内の地図表示', '地図に表示する座標、接続 IP'],
        ['Photon・Valhalla（OpenStreetMap ベース、ドイツ）、Transitous（ドイツ）', '場所検索、経路検索、公共交通の検索', '検索語、出発・到着の座標、接続 IP'],
        ['Open-Meteo（スイス）、ExchangeRate-API（英国）', '天気、為替レート', '都市の座標（天気）、接続 IP'],
      ],
    },
  },
  {
    title: '6. 破棄の手続きと方法',
    items: [
      '退会すると、ログイン情報とプロフィールをデータベースからすぐに削除します。削除した情報は元に戻せません。',
      '端末に保存された情報（ログイン状態、オフライン用の予定のコピー）は、ログアウトまたは退会時に削除します。',
    ],
  },
  {
    title: '7. 利用者の権利と行使方法',
    items: [
      '閲覧・訂正：画面からいつでも確認・修正できます（ニックネームはプロフィールで）。',
      '削除・処理停止：プロフィール → 退会から行えます。',
      'そのほかの要望は、下記の個人情報保護責任者までご連絡ください。',
    ],
  },
  { title: '8. 14歳未満の児童', paragraphs: ['本サービスは14歳未満の方の登録を受け付けません。'] },
  {
    title: '9. 自動収集の仕組み',
    paragraphs: ['広告や追跡のための Cookie は使いません。ログイン状態、言語設定、オフラインで見る予定のコピーを端末のブラウザ保存領域に置きます。ブラウザの設定で削除でき、削除すると再ログインが必要です。'],
  },
  {
    title: '10. 安全管理措置',
    items: [
      'すべての通信を暗号化（HTTPS）しています。',
      'データベースのアクセス制御：旅行の情報は、その旅行のメンバーだけが見たり変えたりできるようデータベース側で制限しています。',
      '管理用の秘密鍵はサービスのコードに置きません。',
      '権限のシナリオを自動で試すセキュリティ点検を定期的に行います。',
    ],
  },
  { title: '11. 個人情報保護責任者', items: [`責任者：${OPERATOR.name}`, `連絡先：${OPERATOR.contact}`] },
  {
    title: '12. 権利侵害の救済',
    paragraphs: ['個人情報の侵害に関する申告や相談は、次の韓国の機関で受け付けています。'],
    items: [
      '個人情報侵害申告センター：privacy.kisa.or.kr / 118',
      '個人情報紛争調停委員会：kopico.go.kr / 1833-6972',
      '大検察庁サイバー捜査課：spo.go.kr / 1301',
      '警察庁サイバー捜査局：ecrm.police.go.kr / 182',
    ],
  },
  { title: '13. 変更', paragraphs: [`本ポリシーは ${EFFECTIVE_DATE} から適用されます。内容を変更する場合は、施行前にサービス画面でお知らせします。`] },
];

export const PRIVACY_POLICY: Record<Locale, PolicySection[]> = { ko, en, ja };
