/**
 * Google Maps JavaScript API 타입 선언 — 우리가 실제로 쓰는 것만.
 *
 * @types/google.maps를 설치해도 되지만, 직접 선언하면 두 가지 이득이 있다:
 *   1. 이 파일이 곧 "우리가 SDK의 어느 표면에 의존하는지" 목록이 된다.
 *      의존이 늘어나면 여기 줄이 늘어나므로 눈에 보인다.
 *   2. 외부 타입 패키지 없이 지도 코드까지 타입체크된다.
 *
 * 표면을 넓힐 때 여기에 선언을 추가하고, 공식 문서와 대조할 것.
 */

declare namespace google.maps {
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  interface Padding {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }

  interface MapOptions {
    center?: LatLngLiteral;
    zoom?: number;
    /** Advanced Marker를 쓰려면 필수. 클라우드 기반 스타일링도 이걸로 묶인다. */
    mapId?: string;
    disableDefaultUI?: boolean;
    zoomControl?: boolean;
    clickableIcons?: boolean;
    keyboardShortcuts?: boolean;
    /** 'LIGHT' | 'DARK' | 'FOLLOW_SYSTEM' (v3.59+) */
    colorScheme?: string;
    gestureHandling?: string;
    maxZoom?: number;
    minZoom?: number;
  }

  class LatLng {
    lat(): number;
    lng(): number;
  }

  class LatLngBounds {
    constructor();
    extend(point: LatLngLiteral): LatLngBounds;
    isEmpty(): boolean;
    getCenter(): LatLng;
  }

  class Map {
    constructor(container: HTMLElement, options?: MapOptions);
    fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
    setCenter(latLng: LatLngLiteral): void;
    setZoom(zoom: number): void;
    /** 지도가 아직 준비 전이면 undefined */
    getCenter(): LatLng | undefined;
  }

  /** 점선을 만들 때 선 위에 반복해 찍는 심볼. */
  interface IconSequence {
    icon: {
      /** SVG path. 점선용 짧은 선분은 'M 0,-1 0,1'. */
      path: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      scale?: number;
    };
    offset?: string;
    /** '12px'처럼 간격. 이게 있어야 반복된다. */
    repeat?: string;
  }

  interface PolylineOptions {
    path?: LatLngLiteral[];
    map?: Map | null;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    geodesic?: boolean;
    zIndex?: number;
    /** 점선 표현용 — Google에는 dash 옵션이 없어서 이걸 쓴다. */
    icons?: IconSequence[];
  }

  class Polyline {
    constructor(options?: PolylineOptions);
    setMap(map: Map | null): void;
  }

  namespace marker {
    interface AdvancedMarkerElementOptions {
      map?: Map | null;
      position?: LatLngLiteral;
      content?: HTMLElement;
      title?: string;
      zIndex?: number;
      gmpClickable?: boolean;
    }

    /**
     * 커스텀 엘리먼트(`<gmp-advanced-marker>`)다. 그래서 지도 이벤트 방식인
     * addListener('click')이 아니라 **DOM 이벤트** addEventListener('gmp-click')를
     * 써야 한다. addListener는 콘솔에 deprecation 경고를 남긴다.
     * HTMLElement를 상속한다고 선언해 addEventListener를 타입으로 받는다.
     */
    class AdvancedMarkerElement extends HTMLElement {
      constructor(options?: AdvancedMarkerElementOptions);
      map: Map | null;
    }
  }

  /**
   * 동적 라이브러리 로딩. 스크립트 태그의 libraries= 로 받지 않은 것을
   * 필요한 시점에 가져온다. 장소 검색은 지도를 한 번도 안 열고 들어올 수
   * 있어서 이 방식이 맞다.
   */
  function importLibrary(name: 'places'): Promise<PlacesLibrary>;

  interface PlacesLibrary {
    AutocompleteSessionToken: typeof places.AutocompleteSessionToken;
    AutocompleteSuggestion: typeof places.AutocompleteSuggestion;
  }

  namespace places {
    /**
     * 자동완성 세션 토큰.
     *
     * 과금 단위가 "요청 1건"이 아니라 "세션 1건"이다. 타이핑 중 여러 번
     * 호출해도 같은 토큰을 쓰면 한 세션으로 묶이고, 마지막에 상세 조회
     * (fetchFields)를 하면 그 세션이 닫힌다. 토큰을 안 쓰면 타이핑 횟수만큼
     * 따로 과금된다.
     */
    class AutocompleteSessionToken {}

    interface AutocompleteRequest {
      input: string;
      sessionToken?: AutocompleteSessionToken;
      language?: string;
      region?: string;
      /** 가까운 결과를 위로 올린다. 필터가 아니라 가중치다. */
      locationBias?: { center: LatLngLiteral; radius: number };
    }

    interface FormattableText {
      text: string;
    }

    class Place {
      /** 자동완성에서 받은 placeId로 상세 조회용 객체를 만든다. */
      constructor(options: { id: string });
      id: string;
      displayName?: string;
      formattedAddress?: string;
      location?: LatLng;
      fetchFields(request: { fields: string[] }): Promise<unknown>;
    }

    class PlacePrediction {
      placeId: string;
      mainText?: FormattableText;
      secondaryText?: FormattableText;
      toPlace(): Place;
    }

    class AutocompleteSuggestion {
      /** 장소가 아닌 질의어 추천이면 null이다. */
      placePrediction: PlacePrediction | null;
      static fetchAutocompleteSuggestions(
        request: AutocompleteRequest,
      ): Promise<{ suggestions: AutocompleteSuggestion[] }>;
    }
  }
}

interface Window {
  google?: typeof google;
}
