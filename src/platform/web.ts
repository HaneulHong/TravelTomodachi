import type { Coord } from '@/domain/types';
import type { Platform, SharePayload, ShareResult } from './types';

/**
 * 웹(PWA) 구현.
 *
 * 2단계에서 platform/native.ts를 추가하고 index.ts의 분기만 바꾸면 된다.
 * 네이티브 구현은 @capacitor/share, @capacitor/geolocation,
 * @capacitor/haptics, @capacitor/browser를 각각 쓴다.
 */

/** 배포 환경의 공개 주소. .env의 VITE_PUBLIC_BASE_URL로 덮어쓸 수 있다. */
const PUBLIC_BASE_URL =
  (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export const webPlatform: Platform = {
  kind: 'web',
  authRedirectUrl: `${PUBLIC_BASE_URL}/auth/callback`,
  publicBaseUrl: PUBLIC_BASE_URL,

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
      } catch {
        // 사용자가 취소한 경우도 여기로 온다 — 복사로 넘어가지 않고 조용히 끝낸다
        return 'unavailable';
      }
    }

    if (typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(payload.url);
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
