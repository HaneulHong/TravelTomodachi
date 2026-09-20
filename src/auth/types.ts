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
  /** 화면에 보이는 이름. 사용자가 직접 정한다. */
  nickname: string;
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
 * 닉네임에서 색을 정한다.
 *
 * 무작위로 고르면 로그인할 때마다 색이 바뀌어서, 목록에서 "아까 그 사람"을
 * 알아볼 수 없다. 같은 이름이면 항상 같은 색이 나와야 한다.
 */
const AVATAR_COLORS = ['#b2563a', '#3f7a52', '#3a5fa0', '#94671a', '#8a4b7d', '#2f7d7a'];

export function colorOf(nickname: string): string {
  let hash = 0;
  for (const ch of nickname) hash = (hash + ch.codePointAt(0)!) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}
