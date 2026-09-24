/**
 * 환경변수 타입.
 *
 * vite/client 참조와 분리해 둔 이유: 이 선언만 있으면 React나 Vite 타입 없이도
 * 순수 로직·지도 렌더러를 단독으로 타입체크할 수 있다 (tsconfig.logic.json).
 */

interface ImportMetaEnv {
  /** 개발 서버(npm run dev)인지. 설정 안내 같은 개발자용 문구는 이때만 보인다. */
  readonly DEV: boolean;
  readonly PROD: boolean;

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

  // ── Supabase (로그인·공유) ────────────────────────────────────────
  // 주의: VITE_ 접두사가 붙은 값은 빌드 결과에 그대로 들어간다.
  // 공개 키는 RLS로 보호되므로 노출해도 되지만, **secret/service_role 키는
  // 절대 여기 두지 말 것** — RLS를 통째로 우회한다.
  readonly VITE_SUPABASE_URL?: string;
  /** 공개 키 새 이름 (sb_publishable_... ). 새 프로젝트는 이걸 준다. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** 공개 키 옛 이름 (eyJ... JWT). 2026년 말 지원 종료 예정. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** package.json의 version. vite.config.ts가 빌드할 때 넣는다. */
declare const __APP_VERSION__: string;
