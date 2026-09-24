/**
 * 앱 전역 설정 — 버전과 "개발자에게만 보일 것".
 */

/** package.json의 version (빌드 때 박힌다) */
export const APP_VERSION = __APP_VERSION__;

/** 정식 출시 전. 버전 옆에 "베타"를 붙인다. 1.0에서 끈다. */
export const IS_BETA = true;

/** "v0.9.5 베타" · "v0.9.5 beta" — 베타 표시는 화면 언어로 받는다 */
export function versionLabel(beta: string): string {
  return `v${APP_VERSION}${IS_BETA ? ` ${beta}` : ''}`;
}

/**
 * 키 설정법, 환경변수 이름, 어떤 서비스가 붙었는지 같은 **개발자용 안내**를
 * 보일지. 개발 서버에서만 켠다. 배포된 서비스에서 사용자가 ".env.local에
 * 넣으세요"를 보면 안 된다.
 */
export const SHOW_DEV_HINTS = import.meta.env.DEV;
