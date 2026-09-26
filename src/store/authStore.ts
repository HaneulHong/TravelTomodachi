/**
 * 로그인 상태.
 *
 * tripStore와 나눠 둔 이유: 여행 데이터는 로그아웃해도 캐시로 남을 수 있지만
 * 세션은 그 순간 사라져야 한다. 한 스토어에 묶으면 로그아웃할 때 무엇을
 * 지우고 무엇을 남길지가 매번 헷갈린다.
 */

import { create } from 'zustand';
import { getAuthProvider, type Account, type SignInMethod } from '@/auth';
import { clearOfflineCache, saveAccount } from '@/data/offlineCache';
import { getMessages } from '@/i18n/store';
import { useTripStore } from './tripStore';

interface AuthState {
  /** 세션 복구가 끝나기 전. 이때 로그인 화면을 띄우면 이미 로그인한 사람에게도 깜빡인다. */
  loading: boolean;
  account: Account | null;
  error: string | null;

  restore(): Promise<void>;
  signIn(method: SignInMethod): Promise<void>;
  signOut(): Promise<void>;
  updateNickname(nickname: string): Promise<void>;
  /** 실패하면 던진다 — 확인 창이 이유를 보여준다 */
  deleteAccount(): Promise<void>;
}

const auth = getAuthProvider();

/**
 * 이 기기에 남은 여행을 치운다 — 메모리와 오프라인 사본 모두. 같은 기기로
 * 다른 사람이 로그인했을 때 앞사람 여행이 잠깐이라도 보이면 안 된다.
 */
function clearLocalTrips(): void {
  clearOfflineCache();
  useTripStore.setState({
    currentUserId: '',
    trips: [],
    items: [],
    checklist: [],
    expenses: [],
    places: [],
    votes: [],
    comments: [],
    loading: true,
    fromCache: false,
  });
}

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
      set({ error: err instanceof Error ? err.message : getMessages().errors.signInFailed });
    }
  },

  signOut: async () => {
    await auth.signOut();
    clearLocalTrips();
    set({ account: null, error: null });
  },

  deleteAccount: async () => {
    await auth.deleteAccount();
    clearLocalTrips();
    set({ account: null, error: null });
  },

  updateNickname: async (nickname) => {
    set({ error: null });
    try {
      const account = await auth.updateNickname(nickname);
      set({ account });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : getMessages().errors.nicknameFailed });
    }
  },
}));

// 오프라인에서도 로그인 상태로 켜지도록 계정 사본을 남긴다 (supabaseAuthProvider.restore)
useAuthStore.subscribe((state, prev) => {
  if (state.account && state.account !== prev.account) saveAccount(state.account);
});
