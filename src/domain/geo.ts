import type { Coord } from './types';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 두 좌표 사이 대권거리(미터) */
export function haversineMeters(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 1200 → '1.2km', 450 → '450m' */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)}km`;
}

/** 좌표 목록을 감싸는 경계 상자. 지도 초기 뷰포트 계산용. */
export function boundsOf(coords: Coord[]): { sw: Coord; ne: Coord } | null {
  if (coords.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of coords) {
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  }
  return { sw: { lat: minLat, lng: minLng }, ne: { lat: maxLat, lng: maxLng } };
}

/**
 * 좌표 목록을 0~1 정규화 좌표로. 지도 SDK를 붙이기 전까지
 * 개략 동선을 SVG로 그리는 데 쓴다.
 */
export function normalizePoints(coords: Coord[]): { x: number; y: number }[] {
  const b = boundsOf(coords);
  if (!b) return [];
  const spanLat = Math.max(1e-6, b.ne.lat - b.sw.lat);
  const spanLng = Math.max(1e-6, b.ne.lng - b.sw.lng);
  return coords.map((c) => ({
    x: (c.lng - b.sw.lng) / spanLng,
    y: 1 - (c.lat - b.sw.lat) / spanLat, // 화면 좌표는 위가 0
  }));
}
