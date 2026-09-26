/**
 * 카카오맵 렌더러 — 국내 전용.
 *
 * 한국에서 Google을 안 쓰는 이유는 타일 디테일 때문이다. Google도 한국
 * 지도를 그려주기는 하지만 건물·골목 수준의 정보가 카카오/네이버보다
 * 훨씬 얕다. (길찾기 쪽 제약은 별개 문제 — ARCHITECTURE.md 참고)
 *
 * SDK 로딩(장소 검색과 공유)과 도메인 등록 주의점은 providers/kakaoSdk.ts.
 */

import type { Coord } from '@/domain/types';
import { loadKakaoSdk } from '../kakaoSdk';
import {
  accentColor,
  createPinElement,
  FIT_PADDING_PX,
  type MapHandle,
  type MapRenderer,
  type MapStop,
  type MountOptions,
  type PathSegment,
} from './types';

/** 카카오 level은 숫자가 작을수록 확대. Google zoom과 반대 방향이다. */
const SINGLE_STOP_LEVEL = 3;

export function createKakaoMapRenderer(jsKey: string): MapRenderer {
  return {
    id: 'kakao-map',
    label: '카카오맵',
    attribution: '© Kakao',
    configured: jsKey.length > 0,
    setupHint: 'VITE_KAKAO_MAPS_JS_KEY',

    async mount(container: HTMLElement, options?: MountOptions): Promise<MapHandle> {
      await loadKakaoSdk(jsKey);

      const map = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(37.5665, 126.978),
        level: 8,
      });

      let overlays: kakao.maps.CustomOverlay[] = [];
      let lines: kakao.maps.Polyline[] = [];
      let stops: MapStop[] = [];
      /** fit이 선까지 담으려면 좌표를 들고 있어야 한다 — 아래 fit() 주석 참고. */
      let pathCoords: Coord[] = [];

      function clearOverlays(): void {
        for (const overlay of overlays) overlay.setMap(null);
        overlays = [];
      }

      function clearLines(): void {
        for (const line of lines) line.setMap(null);
        lines = [];
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
              new kakao.maps.Polyline({
                map,
                path: segment.coords.map((c) => new kakao.maps.LatLng(c.lat, c.lng)),
                strokeColor: accentColor(),
                strokeOpacity: 0.85,
                strokeWeight: 3,
                // 카카오는 dash를 문자열 하나로 받는다 (Google과 달리 내장)
                strokeStyle: segment.dashed ? 'shortdash' : 'solid',
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
            map.setCenter(new kakao.maps.LatLng(stops[0]!.coord.lat, stops[0]!.coord.lng));
            map.setLevel(SINGLE_STOP_LEVEL);
            return;
          }
          const bounds = new kakao.maps.LatLngBounds();
          for (const stop of stops) {
            bounds.extend(new kakao.maps.LatLng(stop.coord.lat, stop.coord.lng));
          }
          for (const coord of pathCoords) {
            bounds.extend(new kakao.maps.LatLng(coord.lat, coord.lng));
          }
          if (!bounds.isEmpty()) {
            map.setBounds(bounds, FIT_PADDING_PX, FIT_PADDING_PX, FIT_PADDING_PX, FIT_PADDING_PX);
          }
        },

        destroy(): void {
          clearOverlays();
          clearLines();
          stops = [];
          pathCoords = [];
        },
      };
    },
  };
}
