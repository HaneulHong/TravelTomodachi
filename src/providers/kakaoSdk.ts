/**
 * 카카오 SDK 로더 — 지도와 장소 검색이 공유한다.
 *
 * 렌더러 안에 두지 않고 꺼낸 이유는 googleSdk.ts와 같다: 장소 검색은 지도를 한 번도
 * 열지 않고 들어올 수 있고(일정 추가 화면), 스크립트 태그는 페이지당 하나여야 한다.
 * 지도가 먼저 SDK를 불렀다면 검색 라이브러리(services)가 빠진 채라, 처음부터
 * `libraries=services`를 붙여 한 번에 받는다.
 *
 * 로딩: `autoload=false`를 붙여 스크립트만 받고, `kakao.maps.load()`로
 * 준비 완료를 기다린다. 이걸 빼면 스크립트 태그가 붙는 즉시 SDK가
 * 자기 초기화를 시작해서, React에서 마운트 타이밍을 잡을 수 없다.
 *
 * ⚠️ 카카오는 **사이트 도메인 등록이 필수**다. 등록하지 않은 출처에서
 * 호출하면 키가 맞아도 401이 돌아온다. localhost도 포트까지 등록해야 한다.
 */

let sdkPromise: Promise<void> | null = null;

export function loadKakaoSdk(jsKey: string): Promise<void> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('브라우저 환경이 아닙니다'));
      return;
    }
    if (window.kakao?.maps?.load) {
      window.kakao.maps.load(() => resolve());
      return;
    }

    const script = document.createElement('script');
    // 프로토콜 상대 경로(//)를 쓰지 않는다. Capacitor 웹뷰에서는 출처가
    // capacitor:// 가 될 수 있어서 //dapi... 가 capacitor://dapi... 로 해석된다.
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      jsKey,
    )}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => {
      if (!window.kakao?.maps?.load) {
        sdkPromise = null;
        reject(new Error('카카오맵 SDK가 로드됐지만 초기화 함수가 없습니다'));
        return;
      }
      window.kakao.maps.load(() => resolve());
    };
    script.onerror = () => {
      sdkPromise = null;
      reject(
        new Error(
          '카카오맵 SDK를 불러오지 못했습니다. JavaScript 키와 사이트 도메인 등록을 확인하세요.',
        ),
      );
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}
