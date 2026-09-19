/**
 * 플랫폼 추상화 — Capacitor 전환 제약 #3.
 *
 * 웹과 네이티브에서 다르게 동작하는 것들을 전부 이 인터페이스 뒤로 숨긴다.
 * 화면 코드가 window나 navigator를 직접 만지면 나중에 앱으로 감쌀 때
 * 어디가 깨지는지 찾아다녀야 한다.
 *
 * 특히 authRedirectUrl: 앱에서 출처가 capacitor://localhost 가 되므로
 * window.location.origin을 그대로 쓰면 소셜 로그인 리다이렉트가 깨진다.
 */

import type { Coord } from '@/domain/types';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export type ShareResult = 'shared' | 'copied' | 'unavailable';

export interface Platform {
  readonly kind: 'web' | 'native';
  /** OAuth 콜백 주소. 웹은 origin, 네이티브는 딥링크 스킴. */
  readonly authRedirectUrl: string;
  /** 초대 링크를 만들 때 쓰는 공개 주소. 네이티브에서도 웹 주소여야 한다. */
  readonly publicBaseUrl: string;
  openExternal(url: string): void;
  share(payload: SharePayload): Promise<ShareResult>;
  getCurrentPosition(): Promise<Coord | null>;
  /** 햅틱. 웹에서는 무시된다. */
  vibrate(pattern?: number): void;
}
