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

import { isNetworkError, loadAccount } from '@/data/offlineCache';
import { getMessages, translateServerError } from '@/i18n/store';
import { platform } from '@/platform';
import { getSupabase } from '@/supabase/client';
import {
  colorOf,
  initialOf,
  nicknameMessage,
  nicknameProblem,
  type Account,
  type AuthProvider,
  type SignInMethod,
} from './types';

interface ProfileRow {
  nickname: string;
  /** profile-tag.sql 이전 DB에는 없다 */
  tag?: string | null;
}


export function createSupabaseAuthProvider(): AuthProvider {
  const client = getSupabase();

  /** profiles 행 → 화면이 쓰는 Account */
  function fromRow(userId: string, row: ProfileRow, via: SignInMethod): Account {
    return {
      id: userId,
      nickname: row.nickname,
      tag: row.tag ?? '',
      initial: initialOf(row.nickname),
      color: colorOf(userId),
      via,
    };
  }

  /** auth 사용자 + profiles 행 → 화면이 쓰는 Account */
  async function toAccount(userId: string, via: SignInMethod): Promise<Account> {
    /*
     * 칸을 골라 부르지 않고 '*'로 읽는다. tag 칸은 profile-tag.sql을 돌린 뒤에야
     * 생기는데, 없는 칸을 이름으로 부르면 로그인 자체가 실패한다.
     */
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(`${getMessages().errors.readProfile}: ${error.message}`);
    if (data) return fromRow(userId, data as ProfileRow, via);

    /*
     * 보통은 가입 트리거가 행을 미리 만들어 둔다. 없을 수도 있다고 보는 이유는
     * 트리거를 만들기 전에 가입한 계정이 남아 있을 수 있어서다. 그때 로그인이
     * 통째로 막히는 것보다, 기본 닉네임으로 채워 넣고 진행하는 게 낫다.
     * 번호(tag)는 DB 트리거가 붙여서 돌려준다.
     * 기본 닉네임은 가입하는 사람의 언어로 (여행자 · Traveler · 旅行者).
     * 사용자가 프로필 화면에서 바꾼다.
     */
    const { data: created, error: insertError } = await client
      .from('profiles')
      .insert({ id: userId, nickname: getMessages().profile.defaultNickname })
      .select('*')
      .single();
    if (insertError) throw new Error(`${getMessages().errors.createProfile}: ${insertError.message}`);
    return fromRow(userId, created as ProfileRow, via);
  }

  /**
   * 앱 로그인 (platform/native.ts 머리말 참고).
   *
   * 웹과 달리 페이지가 새로 뜨지 않으므로 restore()가 세션을 집어 주지 않는다.
   * 코드 교환까지 여기서 끝내고 계정을 돌려준다.
   */
  async function signInNative(
    method: 'google' | 'apple',
    openAuthSession: (url: string) => Promise<string | null>,
  ): Promise<Account> {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: method,
      options: { redirectTo: platform.authRedirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw new Error(`${getMessages().errors.signInFailed}: ${error?.message ?? 'no URL'}`);

    const callback = await openAuthSession(data.url);
    if (!callback) throw new Error(getMessages().errors.signInCancelled);

    // 사용자 정의 스킴도 URL로 읽힌다: com.traveltomodachi.app://auth?code=...
    const params = new URL(callback).searchParams;
    const code = params.get('code');
    if (!code) {
      throw new Error(params.get('error_description') ?? getMessages().errors.signInNoCode);
    }

    const { data: session, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
    if (exchangeError) throw new Error(`${getMessages().errors.signInFailed}: ${exchangeError.message}`);
    return toAccount(session.user.id, viaOf(session.user.app_metadata?.provider));
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
      /*
       * 오프라인이면 두 곳에서 막힌다. 토큰이 만료돼 갱신하려는데 서버가 없거나,
       * 세션은 있는데 프로필을 못 읽거나. 어느 쪽이든 로그인 화면으로 튕기면
       * 여행지에서 일정을 못 본다 — 마지막으로 로그인한 계정 사본으로 버틴다.
       * (서버가 "로그인 안 됨"이라고 분명히 답한 경우는 사본을 쓰지 않는다.)
       */
      if (error || !data.session) {
        return error && isNetworkError(error) ? loadAccount<Account>() : null;
      }
      const user = data.session.user;
      try {
        // 사본은 authStore가 계정이 바뀔 때마다 남긴다
        return await toAccount(user.id, viaOf(user.app_metadata?.provider));
      } catch (err: unknown) {
        const cached = isNetworkError(err) ? loadAccount<Account>(user.id) : null;
        if (cached) return cached;
        throw err;
      }
    },

    async signIn(method: SignInMethod): Promise<Account> {
      if (method !== 'google' && method !== 'apple') {
        throw new Error(getMessages().errors.unsupportedMethod);
      }

      // 앱: 시스템 브라우저로 열고 딥링크로 돌아온 코드를 세션으로 바꾼다
      if (platform.openAuthSession) {
        return signInNative(method, platform.openAuthSession);
      }

      const { error } = await client.auth.signInWithOAuth({
        provider: method,
        // Capacitor 제약 #4 — window.location.origin을 직접 쓰지 않는다
        options: { redirectTo: platform.authRedirectUrl },
      });

      if (error) throw new Error(`${getMessages().errors.signInFailed}: ${error.message}`);

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
      const problem = nicknameProblem(nickname);
      if (problem) throw new Error(nicknameMessage(problem, getMessages().nickname));
      const trimmed = nickname.trim();

      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error(getMessages().errors.notSignedIn);

      // 새 닉네임에서 번호가 겹치면 트리거가 번호를 새로 고른다. 결과를 돌려받는다.
      const { data, error } = await client
        .from('profiles')
        .update({ nickname: trimmed })
        .eq('id', user.id)
        .select('*')
        .single();

      // 닉네임이 너무 흔하면 DB 트리거가 한국어로 거절한다 — 그 사람의 언어로 옮긴다
      if (error) {
        throw new Error(
          `${getMessages().errors.nicknameFailed}: ${translateServerError(error.message)}`,
        );
      }
      return fromRow(user.id, data as ProfileRow, viaOf(user.app_metadata?.provider));
    },
  };
}
