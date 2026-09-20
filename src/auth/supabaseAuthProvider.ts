/**
 * Supabase 로그인.
 *
 * 계정은 Supabase Auth가, 닉네임은 public.profiles 테이블이 들고 있다.
 * 테이블과 RLS는 docs/AUTH_SETUP.md의 SQL로 만든다.
 *
 * ── 받는 정보를 최소로 ───────────────────────────────────────────
 * Google이 이메일과 프로필 사진을 줘도 **저장하지 않는다.** 우리 테이블에는
 * 닉네임만 넣는다. 일정을 같이 보는 데 필요한 건 "구분되는 이름"이 전부고,
 * 그 이상은 유출됐을 때 손해만 크다.
 * (Auth 쪽에는 제공자가 준 정보가 남는다. 그건 Supabase가 관리하는 영역이고
 *  우리 코드가 읽지 않는다.)
 */

import { platform } from '@/platform';
import { getSupabase } from '@/supabase/client';
import { colorOf, initialOf, type Account, type AuthProvider, type SignInMethod } from './types';

/** 프로필이 아직 없을 때 쓰는 이름. 사용자가 프로필 화면에서 바꾼다. */
const DEFAULT_NICKNAME = '여행자';

export function createSupabaseAuthProvider(): AuthProvider {
  const client = getSupabase();

  /** auth 사용자 + profiles 행 → 화면이 쓰는 Account */
  async function toAccount(userId: string, via: SignInMethod): Promise<Account> {
    const { data, error } = await client
      .from('profiles')
      .select('nickname')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(`프로필을 읽지 못했습니다: ${error.message}`);

    /*
     * 보통은 가입 트리거가 행을 미리 만들어 둔다. 없을 수도 있다고 보는 이유는
     * 트리거를 만들기 전에 가입한 계정이 남아 있을 수 있어서다. 그때 로그인이
     * 통째로 막히는 것보다, 기본 닉네임으로 채워 넣고 진행하는 게 낫다.
     */
    const nickname = data?.nickname ?? DEFAULT_NICKNAME;
    if (!data) {
      const { error: insertError } = await client
        .from('profiles')
        .insert({ id: userId, nickname });
      if (insertError) throw new Error(`프로필을 만들지 못했습니다: ${insertError.message}`);
    }

    return {
      id: userId,
      nickname,
      initial: initialOf(nickname),
      color: colorOf(nickname),
      via,
    };
  }

  /** 어떤 방식으로 들어왔는지. 제공자 정보가 없으면 google로 본다. */
  function viaOf(providerId: string | undefined): SignInMethod {
    return providerId === 'apple' ? 'apple' : 'google';
  }

  return {
    id: 'supabase-auth',
    label: 'Supabase',
    // Apple은 Developer Program($99/년)이 있어야 켤 수 있다. 켜면 여기에 더한다.
    methods: ['google'],

    async restore(): Promise<Account | null> {
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) return null;
      const user = data.session.user;
      return toAccount(user.id, viaOf(user.app_metadata?.provider));
    },

    async signIn(method: SignInMethod): Promise<Account> {
      if (method !== 'google' && method !== 'apple') {
        throw new Error('지원하지 않는 로그인 방식입니다');
      }

      const { error } = await client.auth.signInWithOAuth({
        provider: method,
        // Capacitor 제약 #4 — window.location.origin을 직접 쓰지 않는다
        options: { redirectTo: platform.authRedirectUrl },
      });

      if (error) throw new Error(`로그인하지 못했습니다: ${error.message}`);

      /*
       * 여기서 브라우저가 Google로 떠난다. 돌아오면 페이지가 새로 뜨고
       * restore()가 세션을 집는다. 그래서 이 약속은 끝나지 않는다 —
       * 호출부가 로딩 상태를 유지한 채 화면이 사라지는 게 맞는 동작이다.
       */
      return new Promise<never>(() => {});
    },

    async signOut(): Promise<void> {
      await client.auth.signOut();
    },

    async updateNickname(nickname: string): Promise<Account> {
      const trimmed = nickname.trim();
      if (trimmed.length === 0) throw new Error('닉네임을 입력해 주세요');

      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error('로그인 상태가 아닙니다');

      const { error } = await client
        .from('profiles')
        .update({ nickname: trimmed })
        .eq('id', user.id);

      if (error) throw new Error(`닉네임을 바꾸지 못했습니다: ${error.message}`);

      return {
        id: user.id,
        nickname: trimmed,
        initial: initialOf(trimmed),
        color: colorOf(trimmed),
        via: viaOf(user.app_metadata?.provider),
      };
    },
  };
}
