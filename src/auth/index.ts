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

import { mockAuthProvider } from './mockAuthProvider';
import type { AuthProvider } from './types';

export * from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** 백엔드가 설정돼 있는지. 화면에서 "개발용" 안내를 띄울지 판단하는 데도 쓴다. */
export const hasBackend = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export function getAuthProvider(): AuthProvider {
  // TODO: hasBackend면 supabaseAuthProvider를 돌려준다
  return mockAuthProvider;
}
