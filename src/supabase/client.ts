/**
 * Supabase 클라이언트 — 앱 전체가 하나를 공유한다.
 *
 * 여러 개 만들면 각자 세션을 들고 있어서, 로그인은 됐는데 데이터 조회만
 * 비로그인으로 나가거나 한쪽에서 로그아웃해도 다른 쪽이 살아 있는 일이
 * 생긴다. 인증(auth/)과 데이터(data/)가 같은 인스턴스를 써야 한다.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

/**
 * 브라우저에 두는 공개 키.
 *
 * Supabase가 키 체계를 바꾸는 중이라 이름이 두 가지다.
 *   sb_publishable_...  새 이름. 새로 만든 프로젝트는 이걸 준다.
 *   eyJhbGciOi...       옛 이름(anon). 2026년 말 지원 종료 예정.
 * 둘 다 같은 자리에 들어가므로 어느 쪽이 와도 받는다.
 */
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** 백엔드가 설정돼 있는지. 화면에서 안내를 띄울지 판단하는 데도 쓴다. */
export const hasBackend = SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!hasBackend) {
    throw new Error('Supabase가 설정되지 않았습니다 (VITE_SUPABASE_URL / KEY)');
  }
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      /*
       * PKCE를 쓴다. 암묵적 흐름은 토큰을 URL **해시**에 붙여 보내는데,
       * 이 앱은 HashRouter라 해시가 곧 라우트다. 둘이 같은 자리를 놓고
       * 싸우면 로그인 직후 엉뚱한 화면으로 떨어지거나 세션을 놓친다.
       */
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}
