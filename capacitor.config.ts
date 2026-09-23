/**
 * Capacitor 설정 — 웹 빌드(dist/)를 iOS·Android 앱으로 감싼다.
 *
 * 앱 만들기 순서는 docs/APP_SETUP.md.
 *
 * ── appId는 한 번 정하면 바꾸기 어렵다 ────────────────────────────
 * 스토어에 올리는 순간 앱의 주민번호가 된다. 로그인 딥링크 스킴도 여기서
 * 따온다(platform/native.ts의 APP_SCHEME). 바꾸려면 Supabase 리다이렉트 주소,
 * iOS URL Types, Android intent-filter를 전부 같이 바꿔야 한다.
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.traveltomodachi.app',
  appName: 'TravelTomodachi',
  webDir: 'dist',
  ios: {
    // 노치·홈바 영역은 CSS의 env(safe-area-inset-*)가 처리한다 (index.html의 viewport-fit=cover)
    contentInset: 'never',
  },
};

export default config;
