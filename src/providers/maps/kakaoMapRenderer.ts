/**
 * 카카오맵 렌더러 — 국내 전용.
 *
 * 한국에서 Google을 안 쓰는 이유는 타일 디테일 때문이다. Google도 한국
 * 지도를 그려주기는 하지만 건물·골목 수준의 정보가 카카오/네이버보다
 * 훨씬 얕다. (길찾기 쪽 제약은 별개 문제 — ARCHITECTURE.md 참고)
 *
 * 로딩: `autoload=false`를 붙여 스크립트만 받고, `kakao.maps.load()`로
 * 준비 완료를 기다린다. 이걸 빼면 스크립트 태그가 붙는 즉시 SDK가
 * 자기 초기화를 시작해서, React에서 마운트 타이밍을 잡을 수 없다.
 *
 * ⚠️ 카카오는 **사이트 도메인 등록이 필수**다. 등록하지 않은 출처에서
 * 호출하면 키가 맞아도 401이 돌아온다. localhost도 포트까지 등록해야 한다.
 */

import type { Coord } from '@/domain/types';
import {
  accentColor,
  createPinElement,
  FIT_PADDING_PX,
  type MapHandle,
  type MapRenderer,
  type MapStop,
  type MountOptions,
} from './types';

/** 카카오 level은 숫자가 작을수록 확대. Google zoom과 반대 방향이다. */
const SINGLE_STOP_LEVEL = 3;

let sdkPromise: Promise<void> | null = null;

function loadSdk(jsKey: string): Promise<void> {
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
    )}&autoload=false`;
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

export function createKakaoMapRenderer(jsKey: string): MapRenderer {
  return {
    id: 'kakao-map',
    label: '카카오맵',
    attribution: '© Kakao',
    configured: jsKey.length > 0,
    setupHint: 'VITE_KAKAO_MAPS_JS_KEY',

    async mount(container: HTMLElement, options?: MountOptions): Promise<MapHandle> {
      await loadSdk(jsKey);

      const map = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(37.5665, 126.978),
        level: 8,
      });

      let overlays: kakao.maps.CustomOverlay[] = [];
      let line: kakao.maps.Polyline | null = null;
      let stops: MapStop[] = [];

      function clearOverlays(): void {
        for (const overlay of overlays) overlay.setMap(null);
        overlays = [];
      }

      return {
        setStops(next: MapStop[]): void {
          clearOverlays();
          stops = next;
          overlays = next.map((stop) => {
            const pin = createPinElement(stop.label, stop.title, 'center', stop.caption);
            const onClick = options?.onStopClick;
            if (onClick) {
              pin.style.cursor = 'pointer';
              pin.addEventListener('click', () => onClick(stop.id));
            }
            return new kakao.maps.CustomOverlay({
              map,
              position: new kakao.maps.LatLng(stop.coord.lat, stop.coord.lng),
              content: pin,
              // 마커 중심을 좌표에 맞춘다 (기본값은 아래쪽 꼬리 기준)
              yAnchor: 0.5,
              xAnchor: 0.5,
              clickable: Boolean(onClick),
            });
          });
        },

        setPath(coords: Coord[]): void {
          line?.setMap(null);
          line =
            coords.length > 1
              ? new kakao.maps.Polyline({
                  map,
                  path: coords.map((c) => new kakao.maps.LatLng(c.lat, c.lng)),
                  strokeColor: accentColor(),
                  strokeOpacity: 0.85,
                  strokeWeight: 3,
                  strokeStyle: 'solid',
                })
              : null;
        },

        fit(): void {
          if (stops.length === 0) return;
          if (stops.length === 1) {
            map.setCenter(new kakao.maps.LatLng(stops[0]!.coord.lat, stops[0]!.coord.lng));
            map.setLevel(SINGLE_STOP_LEVEL);
            return;
          }
          const bounds = new kakao.maps.LatLngBounds();
          for (const stop of stops) {
            bounds.extend(new kakao.maps.LatLng(stop.coord.lat, stop.coord.lng));
          }
          if (!bounds.isEmpty()) {
            map.setBounds(bounds, FIT_PADDING_PX, FIT_PADDING_PX, FIT_PADDING_PX, FIT_PADDING_PX);
          }
        },

        destroy(): void {
          clearOverlays();
          line?.setMap(null);
          line = null;
          stops = [];
        },
      };
    },
  };
}
