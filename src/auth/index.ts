/**
 * 로그인 제공자 선택.
 *
 * Supabase가 설정돼 있으면 그쪽, 아니면 개발용 목. 지도·길찾기와 같은 방식이다.
 * 키가 없다고 화면이 죽으면 안 된다 — 흐름은 목으로도 전부 돌아간다.
 *
 * Supabase를 붙일 때 할 일:
 *   1. src/auth/supabaseAuthProvider.ts 를 추가한다 (AuthProvider 구현)
 *   2. 아래 분기에 끼운다
 *   3. 화면 코드는 손대지 않는다
 *
 * anon 키는 브라우저에 노출되도록 설계된 공개 키라 클라이언트에 둬도 된다.
 * 접근 제어는 키가 아니라 RLS(행 수준 보안)가 한다 — 그래서 테이블을 만들 때
 * RLS부터 켜야 한다.
 */

import { hasBackend } from '@/supabase/client';
import { mockAuthProvider } from './mockAuthProvider';
import { createSupabaseAuthProvider } from './supabaseAuthProvider';
import type { AuthProvider } from './types';

export * from './types';
export { hasBackend } from '@/supabase/client';

/**
 * 한 번만 만든다. 매번 새로 만들면 Supabase 클라이언트가 여러 개 생기고
 * 각자 세션을 들고 있어서, 한쪽에서 로그아웃해도 다른 쪽이 살아 있다.
 */
const provider: AuthProvider = hasBackend
  ? createSupabaseAuthProvider()
  : mockAuthProvider;

export function getAuthProvider(): AuthProvider {
  return provider;
}
