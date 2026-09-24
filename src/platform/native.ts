/**
 * 네이티브(iOS·Android) 구현 — Capacitor.
 *
 * 웹 구현(web.ts)과 같은 인터페이스를 채운다. 화면 코드는 둘을 구분하지 않는다.
 *
 * ── 로그인이 웹과 다른 이유 ─────────────────────────────────────
 * 웹은 페이지째 Google로 갔다가 앱 루트로 돌아온다. 앱에서 그렇게 하면
 * 웹뷰 안에서 Google 로그인이 열리는데, Google은 웹뷰 로그인을 막는다.
 * 그래서 시스템 브라우저(iOS SFSafariViewController, Android Custom Tabs)로
 * 열고, 로그인이 끝나면 딥링크(APP_SCHEME://auth?code=...)로 앱에 돌아온다.
 * PKCE 검증값은 로그인을 시작한 웹뷰의 저장소에 있으므로 코드 교환은 앱에서 한다.
 */

import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import type { Coord } from '@/domain/types';
import type { Platform, SharePayload, ShareResult } from './types';
import { normalizeBaseUrl } from './baseUrl';

/**
 * 딥링크 스킴. capacitor.config.ts의 appId와 같게 둔다.
 * iOS Info.plist의 CFBundleURLSchemes, Android의 intent-filter,
 * Supabase의 Redirect URLs에 같은 값이 들어가 있어야 한다(docs/APP_SETUP.md).
 */
export const APP_SCHEME = 'com.traveltomodachi.app';
const AUTH_CALLBACK = `${APP_SCHEME}://auth`;

/**
 * 초대 링크용 공개 주소. 앱은 origin이 capacitor://localhost라서 그대로 쓰면
 * 친구가 열 수 없는 링크가 된다. 배포 주소가 없으면 비워 두고 코드만 보낸다.
 */
const PUBLIC_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined);

/**
 * 브라우저를 닫은 뒤 콜백을 조금 더 기다리는 시간.
 * Android는 로그인 끝에 Custom Tab이 먼저 닫히고 딥링크가 뒤따라 올 수 있다.
 * 닫힘을 곧바로 "취소"로 보면 성공한 로그인을 버리게 된다.
 */
const CALLBACK_GRACE_MS = 1200;

export const nativePlatform: Platform = {
  kind: 'native',
  authRedirectUrl: AUTH_CALLBACK,
  publicBaseUrl: PUBLIC_BASE_URL,

  openExternal(url: string): void {
    void Browser.open({ url });
  },

  async share(payload: SharePayload): Promise<ShareResult> {
    try {
      await Share.share({ title: payload.title, text: payload.text, url: payload.url });
      return 'shared';
    } catch {
      // 사용자가 시트를 닫아도 예외로 온다. 알릴 일이 아니다.
      return 'cancelled';
    }
  },

  getCurrentPosition(): Promise<Coord | null> {
    // 웹뷰의 geolocation이 네이티브 권한 창을 띄운다. 아직 쓰는 화면이 없어서
    // Info.plist에 위치 설명 문구를 넣지 않았다 — 쓰기 시작할 때 같이 넣는다.
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 60_000 },
      );
    });
  },

  vibrate(): void {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },

  openAuthSession(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      let settled = false;
      const handles: Array<{ remove(): Promise<void> }> = [];

      const finish = (result: string | null): void => {
        if (settled) return;
        settled = true;
        for (const h of handles) void h.remove();
        resolve(result);
      };

      void App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        if (!event.url.startsWith(AUTH_CALLBACK)) return;
        // iOS는 딥링크로 돌아와도 브라우저가 떠 있다. 직접 닫는다.
        void Browser.close().catch(() => {});
        finish(event.url);
      }).then((h) => (settled ? void h.remove() : handles.push(h)));

      void Browser.addListener('browserFinished', () => {
        setTimeout(() => finish(null), CALLBACK_GRACE_MS);
      }).then((h) => (settled ? void h.remove() : handles.push(h)));

      void Browser.open({ url, presentationStyle: 'popover' }).catch(() => finish(null));
    });
  },

  onDeepLink(handler: (url: string) => void): () => void {
    let removed = false;
    let handle: { remove(): Promise<void> } | undefined;

    // 앱이 꺼져 있다가 링크로 켜진 경우 — 리스너를 달기 전에 이미 지나갔다
    void App.getLaunchUrl().then((launch) => {
      if (!removed && launch?.url) handler(launch.url);
    });

    void App.addListener('appUrlOpen', (event) => handler(event.url)).then((h) => {
      if (removed) void h.remove();
      else handle = h;
    });

    return () => {
      removed = true;
      void handle?.remove();
    };
  },
};
