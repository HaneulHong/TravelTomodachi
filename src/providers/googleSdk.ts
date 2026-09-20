/**
 * Google Maps SDK 로더 — 지도와 장소검색이 공유한다.
 *
 * 렌더러 안에 두지 않고 꺼낸 이유: 장소 검색은 지도를 한 번도 열지 않고
 * 들어올 수 있다(일정 추가 화면). 그때도 SDK가 필요한데, 스크립트 태그는
 * 페이지당 하나여야 한다. 두 곳에서 각자 붙이면 파라미터가 다른 스크립트가
 * 두 번 로드되고 Google이 콘솔에 경고를 남긴다.
 */

const CALLBACK_NAME = '__ttGoogleMapsReady';

/**
 * 인증 실패 통보.
 *
 * 키가 거부되는 경우(API 미활성, 결제 미설정, 리퍼러 제한 위반) Google은
 * new google.maps.Map()을 실패시키지 않는다. 지도는 만들어지고, 잠시 뒤
 * 컨테이너 안에 "죄송합니다. 문제가 발생했습니다" 화면을 직접 그린다.
 * 예외가 없으니 호출부는 성공한 줄 안다.
 *
 * 공식적으로 열려 있는 통로가 전역 gm_authFailure 콜백뿐이라 여기에 건다.
 * 전역이 하나뿐이므로 리스너를 모아두고 한 번만 설치한다.
 */
export type FailureListener = (err: Error) => void;
export const authFailureListeners = new Set<FailureListener>();
let authHookInstalled = false;

export function installAuthFailureHook(): void {
  if (authHookInstalled || typeof window === 'undefined') return;
  authHookInstalled = true;
  (window as unknown as Record<string, unknown>).gm_authFailure = () => {
    const err = new Error(
      'Google 지도 인증에 실패했습니다. Maps JavaScript API 활성화와 키 제한 설정을 확인하세요.',
    );
    for (const listener of authFailureListeners) listener(err);
  };
}

/** SDK는 페이지당 한 번만 로드된다. StrictMode의 이중 마운트도 이걸로 흡수. */
let sdkPromise: Promise<void> | null = null;

export function loadGoogleSdk(apiKey: string): Promise<void> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('브라우저 환경이 아닙니다'));
      return;
    }
    // 이미 로드돼 있으면 (HMR 등) 바로 통과
    if (window.google?.maps) {
      resolve();
      return;
    }

    const globals = window as unknown as Record<string, unknown>;
    globals[CALLBACK_NAME] = () => resolve();

    /*
     * places는 여기 싣지 않는다. 지도만 보는 사람에게까지 장소검색 번들을
     * 내려보낼 이유가 없어서, 검색이 실제로 필요할 때 importLibrary로 가져온다.
     */
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      libraries: 'maps,marker',
      loading: 'async',
      callback: CALLBACK_NAME,
      language: 'ko',
    });

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      // 다음 시도에서 다시 받을 수 있도록 캐시를 비운다
      sdkPromise = null;
      reject(
        new Error(
          'Google Maps SDK를 불러오지 못했습니다. API 키와 리퍼러 제한 설정을 확인하세요.',
        ),
      );
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}
