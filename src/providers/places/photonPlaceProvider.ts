/**
 * 장소 검색 — Photon (OpenStreetMap 기반). 해외 담당, 국내는 카카오가 앞선다
 * (combinedPlaceProvider.ts).
 *
 * ── 왜 Google이 아니라 이걸 쓰나 ──────────────────────────────────
 * Google Places는 과금 SKU다. 월 무료 사용량이 있긴 하지만 초과분은 청구되고,
 * 자동완성은 타이핑마다 호출이 나가는 자리라 가장 빨리 새는 곳이다.
 * Photon은 무료이고 키도 필요 없다.
 *
 * ── 대신 감수하는 것 ──────────────────────────────────────────────
 * OSM 데이터에는 해외 장소의 **한글 이름이 거의 없다.** "도쿄 스카이트리"로는
 * 안 나오고 "Tokyo Skytree"나 "東京スカイツリー"로 쳐야 한다. 결과 이름도
 * 현지어로 돌아온다. 국내는 유명한 곳은 찾히지만 가게·식당이 얇다 — 그래서 국내는 카카오.
 * 이 차이는 화면에서 안내한다 — 안 그러면 검색이 고장난 걸로 보인다.
 *
 * ── 공개 인스턴스를 쓰는 예의 ─────────────────────────────────────
 * 남의 서버다. 화면 쪽 디바운스와 여기 캐시로 호출을 줄인다. 트래픽이 늘면
 * 자체 호스팅(photon은 오픈소스)으로 옮기는 게 맞다.
 */

import { getMessages } from '@/i18n/store';
import type { Coord } from '@/domain/types';
import type { Place, PlaceProvider } from '../types';

const ENDPOINT = 'https://photon.komoot.io/api/';
const REVERSE_ENDPOINT = 'https://photon.komoot.io/reverse';
const LIMIT = 6;

/** 한 번의 편집에서 치는 질의어는 많아야 수십 개라 이 정도면 전부 담긴다. */
const MAX_CACHE = 60;

/**
 * Photon이 돌려주는 GeoJSON 중 우리가 읽는 것만.
 * 속성은 OSM 태그에서 오기 때문에 대부분 있을 수도, 없을 수도 있다.
 */
interface PhotonFeature {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_id?: number;
    osm_type?: string;
    /** 'house'(건물·가게) · 'street' · 'city' 등 — 역조회에서 고를 때 본다 */
    type?: string;
    /** 'postcode'면 이름이 우편번호다 */
    osm_value?: string;
  };
  geometry?: {
    /** GeoJSON은 [경도, 위도] 순서다 — lat/lng과 뒤집혀 있으니 주의. */
    coordinates?: [number, number];
  };
}

function addressOf(p: NonNullable<PhotonFeature['properties']>): string {
  return [p.street, p.district, p.city, p.state, p.country].filter(Boolean).join(', ');
}

function toPlace(feature: PhotonFeature): Place | null {
  const p = feature.properties ?? {};
  const c = feature.geometry?.coordinates;
  if (!p.name || !c) return null;
  return {
    id: `${p.osm_type ?? 'x'}${p.osm_id ?? p.name}`,
    name: p.name,
    address: addressOf(p),
    // GeoJSON은 [lng, lat] 순서
    coord: { lat: c[1], lng: c[0] },
  };
}

function cacheKey(query: string, near?: Coord): string {
  if (!near) return query;
  // 좌표를 통째로 넣으면 소수점 끝자리 차이로 캐시가 안 맞는다
  return `${query}@${near.lat.toFixed(2)},${near.lng.toFixed(2)}`;
}

export function createPhotonPlaceProvider(): PlaceProvider {
  const cache = new Map<string, Place[]>();

  return {
    id: 'photon-osm',
    label: 'OpenStreetMap',

    async search(query: string, near?: Coord): Promise<Place[]> {
      const q = query.trim();
      if (q.length === 0) return [];

      const key = cacheKey(q, near);
      const hit = cache.get(key);
      if (hit) return hit;

      const params = new URLSearchParams({ q, limit: String(LIMIT) });
      if (near) {
        // 가까운 결과를 위로 올린다. 필터가 아니라 가중치다.
        params.set('lat', String(near.lat));
        params.set('lon', String(near.lng));
      }
      /*
       * lang은 de/en/fr/it만 받는다. ko를 넣으면 요청이 거부되고 features가
       * 아예 오지 않는다. 빼면 현지 이름(경복궁, 東京スカイツリー)이 온다.
       */

      const res = await fetch(`${ENDPOINT}?${params.toString()}`);
      if (!res.ok) {
        throw new Error(getMessages().place.searchHttpFailed(res.status));
      }

      const data = (await res.json()) as { features?: PhotonFeature[] };
      const found: Place[] = (data.features ?? [])
        .map(toPlace)
        .filter((p): p is Place => p !== null);

      if (cache.size >= MAX_CACHE) {
        // 가장 오래된 것부터 버린다 (Map은 삽입 순서를 지킨다)
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, found);

      return found;
    },

    /**
     * 좌표 → 가까운 곳 이름. 이름 없는 땅·도시·우편번호가 섞여 와서 몇 개 받아 고른다.
     * 좌표는 사용자가 찍은 그대로 쓰고, 여기서는 이름만 빌린다(호출부).
     */
    async reverse(coord: Coord): Promise<Place | null> {
      const params = new URLSearchParams({
        lat: String(coord.lat),
        lon: String(coord.lng),
        limit: '5',
      });
      const res = await fetch(`${REVERSE_ENDPOINT}?${params.toString()}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { features?: PhotonFeature[] };
      // 건물·거리 수준만 — 도시 이름이나 우편번호("04524")는 장소 이름이 못 된다
      const near = (data.features ?? []).filter(
        (f) =>
          (f.properties?.type === 'house' || f.properties?.type === 'street') &&
          f.properties.osm_value !== 'postcode',
      );
      return near.map(toPlace).find((p) => p !== null) ?? null;
    },

    // Photon은 검색 응답에 좌표를 함께 준다. 따로 조회할 게 없다.
    async resolve(place: Place): Promise<Place> {
      return place;
    },
  };
}
