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

import {
  authFailureListeners,
  installAuthFailureHook,
  loadGoogleSdk,
  type FailureListener,
} from '../googleSdk';
import type { Coord } from '@/domain/types';
import {
  accentColor,
  createPinElement,
  FIT_PADDING_PX,
  SINGLE_STOP_ZOOM,
  type MapHandle,
  type MapRenderer,
  type MapStop,
  type MountOptions,
  type PathSegment,
} from './types';

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
      await loadGoogleSdk(apiKey);

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
      let lines: google.maps.Polyline[] = [];
      let stops: MapStop[] = [];
      /** fit이 선까지 담으려면 좌표를 들고 있어야 한다 — 아래 fit() 주석 참고. */
      let pathCoords: Coord[] = [];

      function clearMarkers(): void {
        for (const marker of markers) marker.map = null;
        markers = [];
      }

      function clearLines(): void {
        for (const line of lines) line.setMap(null);
        lines = [];
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

        setPath(segments: PathSegment[]): void {
          clearLines();
          /*
           * fit에는 각 토막의 양끝만 쓴다. 폴리라인은 한 구간이 수천 점이라
           * 전부 넣으면 bounds 계산이 무거워지고, 어차피 중간 점은 양끝이
           * 만드는 사각형 안에 들어온다.
           */
          pathCoords = segments.flatMap((segment) =>
            segment.coords.length === 0
              ? []
              : [segment.coords[0]!, segment.coords[segment.coords.length - 1]!],
          );
          for (const segment of segments) {
            if (segment.coords.length < 2) continue;
            lines.push(
              new google.maps.Polyline({
                path: segment.coords,
                map,
                strokeColor: accentColor(),
                strokeOpacity: segment.dashed ? 0 : 0.85,
                strokeWeight: 3,
                // 장거리 구간(도시간 이동)에서 직선이 아니라 대권 경로로 보이게
                geodesic: true,
                /*
                 * Google에는 점선 옵션이 없다. 선을 투명하게 만들고 점 아이콘을
                 * 일정 간격으로 반복하는 게 공식 문서가 안내하는 방법이다.
                 */
                ...(segment.dashed
                  ? {
                      icons: [
                        {
                          icon: {
                            path: 'M 0,-1 0,1',
                            strokeOpacity: 0.85,
                            strokeWeight: 3,
                            scale: 2,
                          },
                          offset: '0',
                          repeat: '12px',
                        },
                      ],
                    }
                  : {}),
              }),
            );
          }
        },

        fit(): void {
          if (stops.length === 0) return;
          /*
           * 선까지 담아야 한다. 지점만 보면 터미널 구간(제주 → 목포 배편처럼
           * 도착지가 그 날 지점 목록에 없는 경우)이 화면 밖으로 밀려난다.
           */
          if (stops.length === 1 && pathCoords.length === 0) {
            map.setCenter(stops[0]!.coord);
            map.setZoom(SINGLE_STOP_ZOOM);
            return;
          }
          const bounds = new google.maps.LatLngBounds();
          for (const stop of stops) bounds.extend(stop.coord);
          for (const coord of pathCoords) bounds.extend(coord);
          if (!bounds.isEmpty()) map.fitBounds(bounds, FIT_PADDING_PX);
        },

        destroy(): void {
          if (failureListener) authFailureListeners.delete(failureListener);
          clearMarkers();
          clearLines();
          stops = [];
          pathCoords = [];
        },
      };
    },
  };
}
