import { webPlatform } from './web';
import type { Platform } from './types';

export type { Platform, SharePayload, ShareResult } from './types';

/**
 * 네이티브 여부 판별.
 *
 * 2단계에서 Capacitor를 붙이면 이 함수만 다음으로 바꾼다:
 *   import { Capacitor } from '@capacitor/core';
 *   return Capacitor.isNativePlatform();
 */
function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'capacitor:';
}

export const platform: Platform = isNative()
  ? // 아직 native 구현이 없다. 붙이기 전까지는 웹 구현으로 동작한다.
    webPlatform
  : webPlatform;
