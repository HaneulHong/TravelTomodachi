import { Capacitor } from '@capacitor/core';
import { nativePlatform } from './native';
import { webPlatform } from './web';
import type { Platform } from './types';

export type { Platform, SharePayload, ShareResult } from './types';

/**
 * 네이티브 앱(Capacitor)인지. 화면 코드는 이걸 직접 보지 않고 platform만 쓴다.
 *
 * 프로토콜(capacitor:)로 판단하면 안 된다. Android는 https://localhost로 떠서
 * 웹과 구분이 안 된다.
 */
export const platform: Platform = Capacitor.isNativePlatform() ? nativePlatform : webPlatform;
