/**
 * 개발용 로그인.
 *
 * Supabase 프로젝트가 아직 없어서, 백엔드 없이도 전체 흐름(로그인 → 닉네임
 * 설정 → 로그아웃)을 돌려볼 수 있게 한다. 세션은 이 브라우저에만 남는다.
 *
 * ── 이게 "가짜 Google 로그인"이라는 걸 숨기지 않는다 ─────────────
 * 화면에 개발용이라고 적는다. 진짜 로그인처럼 보이면, 친구를 초대했는데
 * 아무 일도 일어나지 않는 이유를 못 찾게 된다.
 *
 * ── 왜 localStorage인가 ──────────────────────────────────────────
 * 새로고침해도 로그인이 풀리지 않아야 흐름을 제대로 볼 수 있다. Capacitor
 * 웹뷰에서도 동작한다. 실제 세션은 Supabase가 자기 저장소로 관리하므로,
 * 이 파일이 통째로 사라져도 화면 코드는 그대로다.
 */

import { getMessages } from '@/i18n/store';
import {
  colorOf,
  initialOf,
  nicknameMessage,
  nicknameProblem,
  type Account,
  type AuthProvider,
  type SignInMethod,
} from './types';

const STORAGE_KEY = 'tt.dev-session';

/** 진짜 네트워크처럼 아주 짧게 지연시킨다 — 로딩 상태가 도는지 보려고. */
const FAKE_DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function read(): Account | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Account>;
    if (!parsed.id || !parsed.nickname) return null;
    return {
      id: parsed.id,
      nickname: parsed.nickname,
      tag: parsed.tag ?? '0001',
      initial: parsed.initial ?? initialOf(parsed.nickname),
      color: parsed.color ?? colorOf(parsed.id),
      via: parsed.via ?? 'dev',
    };
  } catch {
    // 사생활 보호 모드나 저장소 차단. 로그인만 안 될 뿐 앱은 돌아야 한다.
    return null;
  }
}

function write(account: Account | null): void {
  try {
    if (account) localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장에 실패해도 이번 세션 동안은 메모리 상태로 쓸 수 있다
  }
}

let session: Account | null = null;

export const mockAuthProvider: AuthProvider = {
  id: 'dev-auth',
  label: '개발용 로그인',
  // 실제로 되는 건 이것뿐이다. Google/Apple 버튼을 띄우면 눌렀을 때 아무 일도
  // 일어나지 않아 더 헷갈린다.
  methods: ['dev'],

  async restore(): Promise<Account | null> {
    session = read();
    return session;
  },

  async signIn(method: SignInMethod): Promise<Account> {
    await delay(FAKE_DELAY_MS);
    // 진짜 로그인처럼 기본 닉네임으로 시작한다 — 첫 로그인 닉네임 화면을 개발 중에도 거친다
    const nickname = getMessages().profile.defaultNickname;
    // 실제로는 제공자가 주는 안정적인 사용자 id가 들어간다
    const id = `dev-${Date.now().toString(36)}`;
    session = {
      id,
      nickname,
      tag: '0001',
      initial: initialOf(nickname),
      color: colorOf(id),
      via: method,
    };
    write(session);
    return session;
  },

  async signOut(): Promise<void> {
    session = null;
    write(null);
  },

  // 개발용: 이 브라우저의 세션을 지우는 것으로 탈퇴를 흉내 낸다
  async deleteAccount(): Promise<void> {
    session = null;
    write(null);
  },

  async updateNickname(nickname: string): Promise<Account> {
    if (!session) throw new Error('로그인 상태가 아닙니다');
    const problem = nicknameProblem(nickname);
    if (problem) throw new Error(nicknameMessage(problem, getMessages().nickname));
    const trimmed = nickname.trim();

    session = {
      ...session,
      nickname: trimmed,
      initial: initialOf(trimmed),
    };
    write(session);
    return session;
  },
};
