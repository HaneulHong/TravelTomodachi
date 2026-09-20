/**
 * Google 장소 검색 (Places API New).
 *
 * ── 국내도 이걸 쓴다 ──────────────────────────────────────────────
 * 길찾기는 한국에서 Google을 못 쓰지만(측량법상 지도 데이터 국외 반출 제한),
 * **장소 검색은 제한 대상이 아니다.** "경복궁", "제주시 연동 카페" 모두
 * 한글로 잘 나오고 좌표도 돌려준다. 그래서 지도 렌더러와 달리 지역 분기를
 * 두지 않는다 — 한 경로로 유지하는 편이 버그가 적다.
 *
 * ── 과금 단위가 요청이 아니라 세션이다 ────────────────────────────
 * 타이핑 중 자동완성을 여러 번 불러도, 같은 세션 토큰을 쓰면 한 건으로
 * 묶인다. 그리고 고른 장소의 상세(fetchFields)를 조회하는 순간 그 세션이
 * 닫힌다. 토큰 없이 부르면 타이핑 횟수만큼 따로 과금된다.
 *
 * 그래서 여기서는 세 겹으로 호출을 줄인다:
 *   1. 화면 쪽 디바운스 — 입력이 멈춘 뒤에만 부른다
 *   2. 세션 토큰       — 한 번의 "찾아서 고르기"를 한 건으로 묶는다
 *   3. 질의어 캐시     — 지웠다 다시 친 글자는 네트워크를 타지 않는다
 */

import type { Coord } from '@/domain/types';
import { loadGoogleSdk } from '../googleSdk';
import type { Place, PlaceProvider } from '../types';

/** 가까운 결과를 위로 올리는 반경. 필터가 아니라 가중치다. */
const BIAS_RADIUS_M = 50_000;

/**
 * 캐시 상한. 한 번의 일정 편집에서 치는 질의어는 많아야 수십 개라
 * 이 정도면 전부 담기고, 화면을 벗어나면 프로바이더째 사라진다.
 */
const MAX_CACHE = 60;

function cacheKey(query: string, near?: Coord): string {
  if (!near) return query;
  // 좌표를 통째로 키에 넣으면 소수점 끝자리 차이로 캐시가 안 맞는다.
  return `${query}@${near.lat.toFixed(2)},${near.lng.toFixed(2)}`;
}

export function createGooglePlaceProvider(apiKey: string): PlaceProvider {
  const cache = new Map<string, Place[]>();
  let session: google.maps.places.AutocompleteSessionToken | null = null;

  async function placesLib(): Promise<google.maps.PlacesLibrary> {
    await loadGoogleSdk(apiKey);
    return google.maps.importLibrary('places');
  }

  return {
    id: 'google-places',
    label: 'Google Places',

    async search(query: string, near?: Coord): Promise<Place[]> {
      const q = query.trim();
      if (q.length === 0) return [];

      const key = cacheKey(q, near);
      const hit = cache.get(key);
      if (hit) return hit;

      const { AutocompleteSessionToken, AutocompleteSuggestion } = await placesLib();
      session ??= new AutocompleteSessionToken();

      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        sessionToken: session,
        language: 'ko',
        ...(near ? { locationBias: { center: near, radius: BIAS_RADIUS_M } } : {}),
      });

      const found = suggestions
        // 장소가 아니라 질의어 추천("근처 카페" 같은)은 좌표가 없어서 못 쓴다
        .filter((s) => s.placePrediction !== null)
        .map((s) => {
          const p = s.placePrediction!;
          return {
            id: p.placeId,
            name: p.mainText?.text ?? '',
            address: p.secondaryText?.text ?? '',
            // 좌표는 자동완성 응답에 없다. 고른 뒤 resolve()가 채운다.
          };
        })
        .filter((p) => p.name.length > 0);

      if (cache.size >= MAX_CACHE) {
        // 가장 오래된 것부터 버린다 (Map은 삽입 순서를 지킨다)
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, found);

      return found;
    },

    async resolve(place: Place): Promise<Place> {
      if (place.coord) return place;

      await placesLib();
      const detail = new google.maps.places.Place({ id: place.id });
      await detail.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });

      const location = detail.location;
      /*
       * 상세 조회가 세션을 닫는다. 다음 검색은 새 세션이어야 하므로 토큰을
       * 버린다. 이걸 빼면 한 토큰이 계속 재사용돼 과금이 어떻게 묶일지
       * 예측할 수 없어진다.
       */
      session = null;

      return {
        id: place.id,
        name: detail.displayName ?? place.name,
        address: detail.formattedAddress ?? place.address,
        coord: location ? { lat: location.lat(), lng: location.lng() } : undefined,
      };
    },
  };
}
