/**
 * 국내 장소 검색 — 카카오 로컬 (지도 SDK의 services 라이브러리).
 *
 * ── 왜 카카오인가 ────────────────────────────────────────────────
 * OpenStreetMap(Photon)은 국내 가게·식당 데이터가 얇고, 띄어 쓴 한국어 검색어를
 * 잘 못 맞춘다. "을지로 노가리골목"은 Photon에서 0건, 카카오에서 바로 나온다.
 *
 * ── 비용 ────────────────────────────────────────────────────────
 * 무료다. 앱마다 하루 호출 한도가 있고, 넘으면 청구가 아니라 그날 막힌다.
 * 막히면 OpenStreetMap의 국내 결과가 보인다(regionPlaceProviders.ts).
 *
 * ── REST 키가 아니라 JavaScript 키 ───────────────────────────────
 * REST API 키는 도메인 제한이 없어서 화면 코드에 넣으면 누구나 가져다 쓴다.
 * JavaScript 키는 카카오에 등록한 도메인에서만 동작한다 — 지도와 같은 키.
 *
 * 카카오 로컬은 국내만 다룬다. 해외 검색어면 0건이 온다.
 */

import type { Coord } from '@/domain/types';
import { loadKakaoSdk } from '../kakaoSdk';
import type { Place, PlaceProvider } from '../types';

const LIMIT = 6;
const MAX_CACHE = 60;

export function createKakaoPlaceProvider(jsKey: string): PlaceProvider {
  const cache = new Map<string, Place[]>();
  let places: kakao.maps.services.Places | null = null;

  return {
    id: 'kakao-local',
    label: '카카오',

    async search(query: string, near?: Coord): Promise<Place[]> {
      const q = query.trim();
      if (q.length === 0) return [];

      const key = near ? `${q}@${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : q;
      const hit = cache.get(key);
      if (hit) return hit;

      await loadKakaoSdk(jsKey);
      places ??= new kakao.maps.services.Places();
      const service = places;

      const found = await new Promise<Place[]>((resolve, reject) => {
        service.keywordSearch(
          q,
          (data, status) => {
            if (status === 'ZERO_RESULT') return resolve([]);
            if (status !== 'OK') return reject(new Error('카카오 장소 검색 실패'));
            resolve(
              data.map((d) => ({
                id: `kakao${d.id}`,
                name: d.place_name,
                address: d.road_address_name || d.address_name,
                // 좌표가 문자열로 온다. x가 경도, y가 위도
                coord: { lat: Number(d.y), lng: Number(d.x) },
              })),
            );
          },
          {
            size: LIMIT,
            ...(near ? { location: new kakao.maps.LatLng(near.lat, near.lng) } : {}),
          },
        );
      });

      if (cache.size >= MAX_CACHE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, found);
      return found;
    },

    // 검색 응답에 좌표가 같이 온다
    async resolve(place: Place): Promise<Place> {
      return place;
    },
  };
}
