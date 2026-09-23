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
  /** 공개 웹 주소가 없으면(앱만 있을 때) 링크 없이 글만 보낸다 */
  url?: string;
}

/** cancelled: 사용자가 공유 시트를 닫았다. 아무것도 알리지 않는다. */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable';

export interface Platform {
  readonly kind: 'web' | 'native';
  /** OAuth 콜백 주소. 웹은 origin, 네이티브는 딥링크 스킴. */
  readonly authRedirectUrl: string;
  /**
   * 초대 링크를 만들 때 쓰는 공개 주소. 네이티브에서도 웹 주소여야 한다.
   * 앱에서 배포 주소(VITE_PUBLIC_BASE_URL)가 없으면 빈 문자열 — 그땐
   * 링크 대신 코드만 보낸다. capacitor://localhost 링크는 친구가 못 연다.
   */
  readonly publicBaseUrl: string;
  openExternal(url: string): void;
  share(payload: SharePayload): Promise<ShareResult>;
  getCurrentPosition(): Promise<Coord | null>;
  /** 햅틱. 웹에서는 무시된다. */
  vibrate(pattern?: number): void;

  /**
   * 네이티브 전용. 시스템 브라우저로 로그인 페이지를 열고, 앱으로 돌아온
   * 콜백 주소를 돌려준다. 사용자가 브라우저를 닫으면 null.
   *
   * 웹은 페이지째 Google로 갔다 오면 되지만, 앱은 그럴 수 없다. 앱 안의
   * 웹뷰로 Google 로그인을 열면 Google이 막는다(disallowed_useragent).
   */
  openAuthSession?(url: string): Promise<string | null>;

  /**
   * 네이티브 전용. 앱이 딥링크(com.traveltomodachi.app://invite/CODE)로
   * 열렸을 때. 이미 떠 있는 앱과 새로 켜진 앱 둘 다 부른다. 해제 함수를 돌려준다.
   */
  onDeepLink?(handler: (url: string) => void): () => void;
}
