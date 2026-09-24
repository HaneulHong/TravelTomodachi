import type { Coord } from '@/domain/types';
import type { Platform, SharePayload, ShareResult } from './types';
import { normalizeBaseUrl } from './baseUrl';

/**
 * 웹(PWA) 구현.
 *
 * 2단계에서 platform/native.ts를 추가하고 index.ts의 분기만 바꾸면 된다.
 * 네이티브 구현은 @capacitor/share, @capacitor/geolocation,
 * @capacitor/haptics, @capacitor/browser를 각각 쓴다.
 */

/** 배포 환경의 공개 주소. .env의 VITE_PUBLIC_BASE_URL로 덮어쓸 수 있다. */
const PUBLIC_BASE_URL =
  normalizeBaseUrl(import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export const webPlatform: Platform = {
  kind: 'web',
  /*
   * OAuth가 돌아올 주소는 **지금 열려 있는 사이트의 앱 루트**다.
   *
   * /auth/callback 같은 경로를 쓰면 안 된다. 이 앱은 HashRouter라 라우트가
   * 전부 # 뒤에 있어서 그런 경로를 처리할 화면이 없고, 정적 배포에서는 그
   * 경로 자체가 404다. 루트로 돌아오면 Supabase가 쿼리에 붙여준 code를 읽어
   * 세션을 만들고, 해시 라우팅은 그대로 이어진다.
   *
   * PUBLIC_BASE_URL(초대 링크용 설정값)을 쓰지 않는 이유: 로그인은 시작한
   * 바로 그 사이트로 돌아와야 한다. PKCE 검증값이 그 사이트의 저장소에 있다.
   * 설정값이 틀리면(실제로 남의 사이트 주소가 들어갔었다) 로그인이 엉뚱한
   * 곳으로 튀었다. 미리보기 주소에서도 그대로 동작한다.
   * (앱은 origin이 capacitor://localhost라 native.ts가 딥링크를 쓴다.)
   */
  authRedirectUrl:
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : PUBLIC_BASE_URL,
  publicBaseUrl: PUBLIC_BASE_URL,

  saveFile(filename: string, content: string, mimeType: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 바로 풀면 일부 브라우저가 받기 전에 끊는다
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  openExternal(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  async share(payload: SharePayload): Promise<ShareResult> {
    if (typeof navigator === 'undefined') return 'unavailable';

    // `'share' in navigator`로 확인하면 안 된다. lib.dom의 Navigator 타입에는
    // share가 항상 선언되어 있어서 TS가 else 분기를 never로 좁혀버리고,
    // 그러면 아래 클립보드 폴백이 타입상 죽은 코드가 된다.
    // 실제로 share를 지원하지 않는 브라우저(데스크톱 Chrome 등)가 있으므로
    // 런타임 값으로 판단한다.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        return 'shared';
      } catch (err: unknown) {
        // 사용자가 닫은 건 실패가 아니다 — 복사로 넘어가지도, 알리지도 않는다
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
        return 'unavailable';
      }
    }

    if (typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(payload.url ?? payload.text);
        return 'copied';
      } catch {
        return 'unavailable';
      }
    }

    return 'unavailable';
  },

  getCurrentPosition(): Promise<Coord | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 60_000 },
      );
    });
  },

  vibrate(pattern = 10): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  },
};
