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

/**
 * 브라우저에 두는 공개 키.
 *
 * Supabase가 키 체계를 바꾸는 중이라 이름이 두 가지다.
 *   sb_publishable_...  새 이름 (publishable). 새로 만든 프로젝트는 이걸 준다.
 *   eyJhbGciOi...       옛 이름 (anon). JWT 모양이고 2026년 말 지원 종료 예정.
 *
 * 둘 다 같은 자리에 들어가고 하는 일도 같아서 어느 쪽이 와도 받는다.
 * 대시보드에서 보이는 걸 그대로 붙여넣으면 된다.
 */
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** 백엔드가 설정돼 있는지. 화면에서 "개발용" 안내를 띄울지 판단하는 데도 쓴다. */
export const hasBackend = SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;

export function getAuthProvider(): AuthProvider {
  // TODO: hasBackend면 supabaseAuthProvider를 돌려준다
  return mockAuthProvider;
}
