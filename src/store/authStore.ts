/**
 * 로그인 상태.
 *
 * tripStore와 나눠 둔 이유: 여행 데이터는 로그아웃해도 캐시로 남을 수 있지만
 * 세션은 그 순간 사라져야 한다. 한 스토어에 묶으면 로그아웃할 때 무엇을
 * 지우고 무엇을 남길지가 매번 헷갈린다.
 */

import { create } from 'zustand';
import { getAuthProvider, type Account, type SignInMethod } from '@/auth';

interface AuthState {
  /** 세션 복구가 끝나기 전. 이때 로그인 화면을 띄우면 이미 로그인한 사람에게도 깜빡인다. */
  loading: boolean;
  account: Account | null;
  error: string | null;

  restore(): Promise<void>;
  signIn(method: SignInMethod): Promise<void>;
  signOut(): Promise<void>;
  updateNickname(nickname: string): Promise<void>;
}

const auth = getAuthProvider();

export const useAuthStore = create<AuthState>()((set) => ({
  loading: true,
  account: null,
  error: null,

  restore: async () => {
    try {
      const account = await auth.restore();
      set({ account, loading: false, error: null });
    } catch {
      // 저장소가 막혀 있어도 로그인 화면은 떠야 한다
      set({ account: null, loading: false });
    }
  },

  signIn: async (method) => {
    set({ error: null });
    try {
      const account = await auth.signIn(method);
      set({ account });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : '로그인하지 못했습니다' });
    }
  },

  signOut: async () => {
    await auth.signOut();
    set({ account: null, error: null });
  },

  updateNickname: async (nickname) => {
    set({ error: null });
    try {
      const account = await auth.updateNickname(nickname);
      set({ account });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : '닉네임을 바꾸지 못했습니다' });
    }
  },
}));
