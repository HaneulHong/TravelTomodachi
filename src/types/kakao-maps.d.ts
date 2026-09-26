/**
 * 카카오맵 Web JavaScript SDK 타입 선언 — 우리가 실제로 쓰는 것만.
 * 카카오는 공식 타입 패키지를 제공하지 않으므로 직접 선언한다.
 *
 * 주의: 카카오는 좌표를 객체 리터럴로 받지 않는다. 반드시
 * `new kakao.maps.LatLng(lat, lng)` 인스턴스를 만들어야 한다.
 * (Google은 { lat, lng } 리터럴을 받는다 — 두 SDK의 가장 큰 차이)
 */

declare namespace kakao.maps {
  /** autoload=false로 스크립트를 넣었을 때, SDK 준비 완료 콜백 */
  function load(callback: () => void): void;

  class LatLng {
    constructor(latitude: number, longitude: number);
    getLat(): number;
    getLng(): number;
  }

  class LatLngBounds {
    constructor();
    extend(latlng: LatLng): void;
    isEmpty(): boolean;
  }

  interface MapOptions {
    center: LatLng;
    /** 확대 레벨. 숫자가 작을수록 더 확대된다 (Google zoom과 반대). */
    level?: number;
    draggable?: boolean;
    scrollwheel?: boolean;
  }

  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setBounds(
      bounds: LatLngBounds,
      paddingTop?: number,
      paddingRight?: number,
      paddingBottom?: number,
      paddingLeft?: number,
    ): void;
    setCenter(latlng: LatLng): void;
    getCenter(): LatLng;
    setLevel(level: number): void;
    relayout(): void;
  }

  interface CustomOverlayOptions {
    position: LatLng;
    content: HTMLElement | string;
    map?: Map | null;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions);
    setMap(map: Map | null): void;
  }

  interface PolylineOptions {
    path: LatLng[];
    map?: Map | null;
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    /** 'solid' | 'shortdash' | 'dash' 등 */
    strokeStyle?: string;
    zIndex?: number;
  }

  class Polyline {
    constructor(options: PolylineOptions);
    setMap(map: Map | null): void;
  }
}

/** 장소 검색 — SDK에 `libraries=services`를 붙여야 생긴다 (providers/kakaoSdk.ts) */
declare namespace kakao.maps.services {
  /** 실제 값은 'OK' · 'ZERO_RESULT' · 'ERROR' 문자열이다 */
  type StatusValue = 'OK' | 'ZERO_RESULT' | 'ERROR';
  const Status: { OK: StatusValue; ZERO_RESULT: StatusValue; ERROR: StatusValue };

  interface PlaceResult {
    id: string;
    place_name: string;
    /** 지번 주소 */
    address_name: string;
    /** 도로명 주소. 없으면 빈 문자열 */
    road_address_name: string;
    /** 좌표가 **문자열**로 온다 — x가 경도, y가 위도 */
    x: string;
    y: string;
    category_group_name: string;
  }

  interface KeywordSearchOptions {
    /** 이 근처를 우선한다(정렬이 거리순이 아니면 가중치) */
    location?: LatLng;
    /** 한 번에 받을 개수, 1~15 */
    size?: number;
  }

  class Places {
    constructor();
    keywordSearch(
      keyword: string,
      callback: (data: PlaceResult[], status: StatusValue) => void,
      options?: KeywordSearchOptions,
    ): void;
  }
}

interface Window {
  kakao?: typeof kakao;
}
