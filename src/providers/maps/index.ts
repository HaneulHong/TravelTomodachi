/**
 * 지도 렌더러 선택.
 *
 * ── 중요: 지도 렌더링의 지역 판정은 길찾기와 규칙이 다르다 ──────────
 *
 * 길찾기는 "이 좌표가 한국이냐"로 갈린다. Google이 한국 내 차량·도보
 * 길찾기를 제공하지 않기 때문이다.
 *
 * 하지만 타일 렌더링은 사정이 다르다. Google은 한국 지도도 그려준다
 * (디테일이 얕을 뿐). 반대로 카카오는 해외 지도를 제대로 그리지 못한다.
 * 그래서 규칙이 비대칭이 된다:
 *
 *   모든 지점이 한국 안  →  카카오맵
 *   하나라도 해외        →  Google Maps
 *
 * 이게 중요한 건 1일차 "서울 → 방콕" 같은 날 때문이다. 첫 지점만 보고
 * 카카오를 고르면 방콕 마커가 카카오 지도 위에 떠서 아무것도 안 보인다.
 */

import type { Coord } from '@/domain/types';
import { isInKorea } from '../region';
import { createGoogleMapRenderer } from './googleMapRenderer';
import { createKakaoMapRenderer } from './kakaoMapRenderer';
import { createSchematicMapRenderer } from './schematicMapRenderer';
import type { MapRenderer } from './types';

export * from './types';
export { createSchematicMapRenderer } from './schematicMapRenderer';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
/**
 * Advanced Marker에 필수. 비어 있으면 렌더러가 DEMO_MAP_ID로 떨어지고
 * 화면에 경고를 띄운다 (마커가 조용히 안 뜨는 걸 막기 위해).
 *
 * 주의: `?? 'DEMO_MAP_ID'`로 쓰면 안 된다. .env.local에 `VITE_..._MAP_ID=`처럼
 * 키만 있고 값이 없으면 Vite는 undefined가 아니라 **빈 문자열**을 준다.
 * 그러면 ??가 발동하지 않아 빈 mapId가 그대로 넘어간다 — 빈 값 판정은
 * 렌더러에서 length로 한다.
 */
const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAPS_JS_KEY ?? '';

export type MapRegion = 'KR' | 'GLOBAL';

/**
 * 지점 목록으로 지도 지역을 판정한다.
 * 좌표가 하나도 없으면 GLOBAL로 본다 (Google이 더 넓게 커버하므로).
 */
export function resolveMapRegion(coords: Coord[]): MapRegion {
  if (coords.length === 0) return 'GLOBAL';
  return coords.every(isInKorea) ? 'KR' : 'GLOBAL';
}

const googleRenderer = createGoogleMapRenderer(GOOGLE_KEY, GOOGLE_MAP_ID);
const kakaoRenderer = createKakaoMapRenderer(KAKAO_KEY);

/**
 * 렌더러 인스턴스는 지역당 하나로 고정한다.
 *
 * 매번 새 객체를 만들면 참조가 바뀌어서, 이걸 effect 의존성으로 쓰는
 * MapCanvas가 렌더마다 지도를 다시 마운트한다. 화면이 계속 깜빡이고
 * SDK 호출도 낭비된다.
 */
const rendererCache = new Map<MapRegion, MapRenderer>();

/**
 * 해당 지역의 렌더러. 키가 설정돼 있지 않으면 개략도 렌더러로 떨어진다.
 * 키가 없다고 화면이 깨지면 안 된다 — 좌표와 동선 순서는 지도 없이도
 * 확인할 수 있어야 하고, 무엇을 설정해야 하는지도 화면에서 보여야 한다.
 */
export function getMapRenderer(region: MapRegion): MapRenderer {
  const cached = rendererCache.get(region);
  if (cached) return cached;

  const real = region === 'KR' ? kakaoRenderer : googleRenderer;
  const chosen = real.configured ? real : createSchematicMapRenderer(real);
  rendererCache.set(region, chosen);
  return chosen;
}

/** 실제 렌더러(키 유무와 무관). 설정 안내 문구를 보여줄 때 쓴다. */
export function getIntendedMapRenderer(region: MapRegion): MapRenderer {
  return region === 'KR' ? kakaoRenderer : googleRenderer;
}
