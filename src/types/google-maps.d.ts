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
  }

  interface PolylineOptions {
    path?: LatLngLiteral[];
    map?: Map | null;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    geodesic?: boolean;
    zIndex?: number;
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
}

interface Window {
  google?: typeof google;
}
