/**
 * 장소 검색 — 국내는 카카오, 해외는 Photon(OpenStreetMap).
 *
 * 검색하는 순간에는 어느 나라 장소를 찾는지 모른다(입력칸에 좌표가 아직 없다).
 * 그래서 둘을 같이 부르고 합친다:
 *   - 카카오 결과가 있으면 Photon의 **국내** 결과는 버린다 — 같은 곳이 두 번 뜨고,
 *     국내는 카카오 쪽이 정확하다.
 *   - 한글로 쳤으면 카카오 먼저, 아니면 Photon 먼저. 해외 장소의 한글 이름은
 *     Photon에 거의 없어서, 한글 검색어는 대개 국내 장소다.
 *   - 이미 고른 장소가 해외면(다시 고치는 중) 카카오는 부르지 않는다.
 *
 * 한쪽이 실패하면(카카오 도메인 미등록, 하루 한도 초과 등) 다른 쪽만 보여 준다.
 * 둘 다 실패했을 때만 오류다.
 *
 * 그래도 못 찾으면 목록 아래 "더 찾기"로 Nominatim(한글 이름 검색)을 부른다.
 */

import type { Coord } from '@/domain/types';
import { isInKorea } from '../region';
import type { Place, PlaceProvider } from '../types';
import { searchByName } from './nominatimPlaceProvider';

const LIMIT = 8;
/** 카카오 SDK가 늦으면 기다리지 않는다 — Photon 결과까지 붙잡히지 않게 */
const KAKAO_TIMEOUT_MS = 4000;

const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** 한국 장소를 먼저 보일지. 고른 장소가 있으면 그 위치, 없으면 검색어 글자로 판단한다. */
export function koreaFirst(query: string, near?: Coord): boolean {
  if (near) return isInKorea(near);
  return HANGUL.test(query);
}

/**
 * 두 결과를 합친다. null은 그쪽이 실패했거나 부르지 않았다는 뜻.
 */
export function mergePlaceResults(
  kakao: Place[] | null,
  osm: Place[] | null,
  kakaoFirst: boolean,
  limit = LIMIT,
): Place[] {
  const k = kakao ?? [];
  const o =
    k.length > 0 ? (osm ?? []).filter((p) => !p.coord || !isInKorea(p.coord)) : (osm ?? []);
  return (kakaoFirst ? [...k, ...o] : [...o, ...k]).slice(0, limit);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function createCombinedPlaceProvider(
  kakao: PlaceProvider | null,
  osm: PlaceProvider,
): PlaceProvider {
  return {
    id: 'kakao+photon',
    label: kakao ? '카카오 · OpenStreetMap' : osm.label,

    async search(query: string, near?: Coord): Promise<Place[]> {
      const useKakao = kakao !== null && (!near || isInKorea(near));
      const [k, o] = await Promise.allSettled([
        useKakao ? withTimeout(kakao.search(query, near), KAKAO_TIMEOUT_MS) : Promise.resolve(null),
        osm.search(query, near),
      ]);
      const kakaoPlaces = k.status === 'fulfilled' ? k.value : null;
      const osmPlaces = o.status === 'fulfilled' ? o.value : null;

      // Photon만 실패하고 카카오가 답했으면 그걸로 충분하다. 둘 다 못 했을 때만 오류
      if (osmPlaces === null && (kakaoPlaces === null || kakaoPlaces.length === 0)) {
        if (o.status === 'rejected') throw o.reason;
      }
      return mergePlaceResults(kakaoPlaces, osmPlaces, koreaFirst(query, near));
    },

    // 해외 명소를 한글 이름으로 — 버튼을 눌렀을 때만 (nominatimPlaceProvider.ts)
    searchMore: searchByName,

    // 지도에서 찍은 곳의 이름 — 전 세계를 덮는 Photon으로
    reverse: osm.reverse ? (coord: Coord) => osm.reverse!(coord) : undefined,

    async resolve(place: Place): Promise<Place> {
      return place;
    },
  };
}
