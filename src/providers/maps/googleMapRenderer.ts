/**
 * Google Maps 렌더러 — 한국을 제외한 전 세계.
 *
 * 로딩 방식: 공식 권장은 동적 라이브러리 임포트(importLibrary)지만,
 * 여기서는 `libraries=maps,marker` + `loading=async` + callback 조합을 쓴다.
 * 결과가 같으면서 코드가 훨씬 읽히고, 웹뷰(Capacitor)에서도 동작이 같다.
 *
 * 마커: google.maps.Marker는 2024-02-21(v3.56)부터 deprecated이므로
 * AdvancedMarkerElement를 쓴다. 이걸 쓰려면 **mapId가 필수**다.
 * mapId가 없으면 마커가 아예 안 뜨므로, 없을 때는 DEMO_MAP_ID로 떨어진다.
 * DEMO_MAP_ID는 개발용이다 — 배포 전에 실제 Map ID를 발급해 넣을 것.
 */

import type { Coord } from '@/domain/types';
import {
  createPinElement,
  FIT_PADDING_PX,
  SINGLE_STOP_ZOOM,
  type MapHandle,
  type MapRenderer,
  type MapStop,
  type MountOptions,
} from './types';

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
type FailureListener = (err: Error) => void;
const authFailureListeners = new Set<FailureListener>();
let authHookInstalled = false;

function installAuthFailureHook(): void {
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

function loadSdk(apiKey: string): Promise<void> {
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

export function createGoogleMapRenderer(apiKey: string, mapId?: string): MapRenderer {
  // Map ID가 없으면 지도는 정상적으로 뜨지만 **마커만 조용히 사라진다.**
  // 콘솔을 열기 전까지 원인을 알 수 없는 종류의 실패라서 화면에 경고를 띄운다.
  const hasRealMapId = Boolean(mapId && mapId.length > 0);
  const effectiveMapId = hasRealMapId ? mapId! : 'DEMO_MAP_ID';

  return {
    id: 'google-maps',
    label: 'Google Maps',
    attribution: '© Google',
    configured: apiKey.length > 0,
    setupHint: 'VITE_GOOGLE_MAPS_API_KEY',
    warning: hasRealMapId
      ? undefined
      : 'VITE_GOOGLE_MAPS_MAP_ID가 비어 있어 번호 마커가 표시되지 않습니다. Google Cloud Console의 [지도 관리]에서 Map ID를 발급해 .env.local에 넣으세요.',

    async mount(container: HTMLElement, options?: MountOptions): Promise<MapHandle> {
      installAuthFailureHook();
      await loadSdk(apiKey);

      const onFailure = options?.onFailure;
      const failureListener: FailureListener | null = onFailure ? (err) => onFailure(err) : null;
      if (failureListener) authFailureListeners.add(failureListener);

      const map = new google.maps.Map(container, {
        center: { lat: 35.68, lng: 139.77 },
        zoom: 11,
        mapId: effectiveMapId,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        colorScheme: options?.dark ? 'DARK' : 'LIGHT',
      });

      let markers: google.maps.marker.AdvancedMarkerElement[] = [];
      let line: google.maps.Polyline | null = null;
      let stops: MapStop[] = [];

      function clearMarkers(): void {
        for (const marker of markers) marker.map = null;
        markers = [];
      }

      return {
        setStops(next: MapStop[]): void {
          clearMarkers();
          stops = next;
          markers = next.map((stop) => {
            const marker = new google.maps.marker.AdvancedMarkerElement({
              map,
              position: stop.coord,
              // Google은 content의 아래쪽 중앙을 좌표에 맞춘다
              content: createPinElement(stop.label, stop.title, 'bottom', stop.caption),
              title: stop.title,
              gmpClickable: Boolean(options?.onStopClick),
            });
            const onClick = options?.onStopClick;
            if (onClick) {
              // Advanced Marker는 커스텀 엘리먼트라서 지도 이벤트가 아니라
              // DOM 이벤트를 쓴다. addListener('click')은 deprecated 경고를 남기고,
              // 키보드 접근성(Tab → Enter)도 gmp-click 쪽에만 붙는다.
              marker.addEventListener('gmp-click', () => onClick(stop.id));
            }
            return marker;
          });
        },

        setPath(coords: Coord[]): void {
          line?.setMap(null);
          line =
            coords.length > 1
              ? new google.maps.Polyline({
                  path: coords,
                  map,
                  strokeColor: '#4f46e5',
                  strokeOpacity: 0.85,
                  strokeWeight: 3,
                  // 장거리 구간(도시간 이동)에서 직선이 아니라 대권 경로로 보이게
                  geodesic: true,
                })
              : null;
        },

        fit(): void {
          if (stops.length === 0) return;
          if (stops.length === 1) {
            map.setCenter(stops[0]!.coord);
            map.setZoom(SINGLE_STOP_ZOOM);
            return;
          }
          const bounds = new google.maps.LatLngBounds();
          for (const stop of stops) bounds.extend(stop.coord);
          if (!bounds.isEmpty()) map.fitBounds(bounds, FIT_PADDING_PX);
        },

        destroy(): void {
          if (failureListener) authFailureListeners.delete(failureListener);
          clearMarkers();
          line?.setMap(null);
          line = null;
          stops = [];
        },
      };
    },
  };
}
