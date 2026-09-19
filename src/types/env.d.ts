/**
 * 환경변수 타입.
 *
 * vite/client 참조와 분리해 둔 이유: 이 선언만 있으면 React나 Vite 타입 없이도
 * 순수 로직·지도 렌더러를 단독으로 타입체크할 수 있다 (tsconfig.logic.json).
 */

interface ImportMetaEnv {
  readonly VITE_PUBLIC_BASE_URL?: string;

  // ── 지도 ──────────────────────────────────────────────────────────
  // 지도 SDK 키는 브라우저 SDK라서 숨길 수 없다. 클라이언트에 노출되는 걸
  // 전제로 하고, 대신 **출처 제한**으로 막는다:
  //   Google — API 키에 HTTP 리퍼러 제한 + API 제한(Maps JavaScript API만)
  //   카카오 — 앱 설정의 사이트 도메인 등록 (등록 안 하면 401)
  // 발급·제한 설정 절차는 docs/MAP_SETUP.md 참고.
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Advanced Marker에 필수. 없으면 DEMO_MAP_ID(개발용)로 동작한다. */
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
  readonly VITE_KAKAO_MAPS_JS_KEY?: string;

  // ── Supabase (아직 미연결) ────────────────────────────────────────
  // 주의: VITE_ 접두사가 붙은 값은 빌드 결과에 그대로 들어간다.
  // anon key는 RLS로 보호되므로 노출해도 되지만, **길찾기 API 키는
  // 절대 여기 두지 말고** Supabase Edge Function 프록시 뒤에 둔다.
  // (길찾기는 서버에서 부르고 결과를 routes 테이블에 캐시한다)
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
