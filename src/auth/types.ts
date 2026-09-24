/**
 * 로그인 추상화.
 *
 * 화면은 이 인터페이스만 본다. 지금 뒤에 있는 건 개발용 목이고, Supabase Auth를
 * 붙일 때 이 파일은 손대지 않는다 — providers/가 지도·길찾기에 대해 하는 일과
 * 같은 구조다.
 *
 * ── 받는 정보를 최소로 ───────────────────────────────────────────
 * 닉네임 하나만 받는다. 이메일·실명·프로필 사진은 저장하지 않는다.
 * 여행 일정을 같이 보는 데 필요한 건 "누가 고쳤는지 구분되는 이름"이 전부고,
 * 그 이상은 유출됐을 때 손해만 크다. OAuth 제공자가 이메일을 줘도 버린다.
 *
 * ── Capacitor 제약 #3·#4 ─────────────────────────────────────────
 * OAuth 리다이렉트 주소는 웹과 앱이 다르다(앱은 capacitor://localhost).
 * 그래서 구현체는 window.location.origin이 아니라 platform.authRedirectUrl을
 * 써야 한다.
 */

/** 지원하는 로그인 방식. Apple은 Developer Program($99/년)이 있어야 켤 수 있다. */
export type SignInMethod = 'google' | 'apple' | 'dev';

export interface Account {
  id: string;
  /** 화면에 보이는 이름. 사용자가 직접 정한다. 다른 사람과 겹칠 수 있다. */
  nickname: string;
  /**
   * 같은 닉네임끼리 구분하는 4자리 번호(여행자#0421). DB 트리거가 정한다.
   * supabase/profile-tag.sql을 돌리기 전 DB에는 없어서 빈 문자열일 수 있다.
   */
  tag: string;
  /** 아바타 한 글자 — 닉네임에서 만든다 */
  initial: string;
  /** 아바타 색. 사람마다 달라야 목록에서 구분된다. */
  color: string;
  /** 어떤 방식으로 들어왔는지. 프로필에서 보여준다. */
  via: SignInMethod;
}

export interface AuthProvider {
  readonly id: string;
  readonly label: string;
  /** 이 환경에서 실제로 쓸 수 있는 방식. 화면은 이것만 버튼으로 띄운다. */
  readonly methods: readonly SignInMethod[];

  /** 저장된 세션을 복구한다. 없으면 null. */
  restore(): Promise<Account | null>;
  signIn(method: SignInMethod): Promise<Account>;
  signOut(): Promise<void>;
  /** 닉네임 변경. 반영된 계정을 돌려준다. */
  updateNickname(nickname: string): Promise<Account>;
}

/** 닉네임 첫 글자를 아바타용으로. 이모지·영문도 한 글자로 끊는다. */
export function initialOf(nickname: string): string {
  const trimmed = nickname.trim();
  if (trimmed.length === 0) return '?';
  // 코드 포인트 단위로 잘라야 이모지가 반쪽 나지 않는다
  return [...trimmed][0] ?? '?';
}

/**
 * 아바타 색. **사용자 id**로 정한다.
 *
 * 무작위로 고르면 로그인할 때마다 색이 바뀌어서, 목록에서 "아까 그 사람"을
 * 알아볼 수 없다. 닉네임으로 정하면 같은 닉네임끼리 색까지 같아져 구분이
 * 안 된다. id는 바뀌지 않고 사람마다 다르다.
 */
const AVATAR_COLORS = ['#b2563a', '#3f7a52', '#3a5fa0', '#94671a', '#8a4b7d', '#2f7d7a'];

export function colorOf(key: string): string {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)!) % 100_003;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

/** "여행자#0421". 번호가 아직 없으면 이름만. */
export function fullName(nickname: string, tag: string | undefined): string {
  return tag ? `${nickname}#${tag}` : nickname;
}

export const NICKNAME_MAX = 20;

export type NicknameProblem = 'empty' | 'tooLong' | 'hash';

/**
 * 닉네임으로 쓸 수 없으면 그 이유, 괜찮으면 null. DB 제약과 같은 규칙이다.
 * 문구가 아니라 이유만 돌려준다 — 화면이 그 사람의 언어로 적는다(nicknameMessage).
 */
export function nicknameProblem(nickname: string): NicknameProblem | null {
  const trimmed = nickname.trim();
  if (trimmed.length === 0) return 'empty';
  if ([...trimmed].length > NICKNAME_MAX) return 'tooLong';
  // 번호 표시(#0421)와 헷갈린다
  if (trimmed.includes('#')) return 'hash';
  return null;
}

/** 이유를 문구로. 문구는 i18n 쪽에서 받아 넘긴다(여기는 언어를 모른다). */
export function nicknameMessage(
  problem: NicknameProblem,
  t: { empty: string; tooLong(max: number): string; hash: string },
): string {
  if (problem === 'tooLong') return t.tooLong(NICKNAME_MAX);
  return t[problem];
}
