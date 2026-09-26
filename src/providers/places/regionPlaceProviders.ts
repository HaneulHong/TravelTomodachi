/**
 * 장소 검색 — 국내·해외를 사용자가 고른다(검색 화면 위쪽 전환, PlaceSearchSheet).
 *
 * 전에는 어디를 찾는지 몰라 카카오와 Photon을 같이 부르고 합쳤다. 그러면 "오사카성"에
 * 서울 분식집이 섞였다. 지역을 알면 그쪽 검색만 하면 된다.
 *
 *   국내 — 카카오 로컬. 카카오가 없거나(키·도메인) 못 찾으면 OpenStreetMap의 국내 결과.
 *   해외 — Photon(OpenStreetMap). 한글 이름은 "더 찾기"로 Nominatim(버튼으로만).
 *
 * 결과는 고른 지역 안의 것만 남긴다 — 해외를 골랐는데 국내 가게가 뜨면 헷갈린다.
 */

import type { Coord, Region } from '@/domain/types';
import { isInKorea } from '../region';
import type { Place, PlaceProvider } from '../types';
import { searchByName } from './nominatimPlaceProvider';

/** 카카오 SDK가 늦으면 기다리지 않고 OpenStreetMap으로 넘어간다 */
const KAKAO_TIMEOUT_MS = 4000;

/** 이 지역의 장소인지. 좌표가 없으면 판단할 수 없어 남긴다 */
export function inRegion(region: Region, place: Place): boolean {
  if (!place.coord) return true;
  return isInKorea(place.coord) === (region === 'KR');
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

export function createKoreaPlaceProvider(
  kakao: PlaceProvider | null,
  osm: PlaceProvider,
): PlaceProvider {
  return {
    id: 'kr',
    label: kakao ? kakao.label : osm.label,

    async search(query: string, near?: Coord): Promise<Place[]> {
      if (kakao) {
        try {
          const found = await withTimeout(kakao.search(query, near), KAKAO_TIMEOUT_MS);
          if (found.length > 0) return found;
        } catch {
          // 카카오가 막혔다(도메인 미등록, 하루 한도) — 아래 OpenStreetMap으로
        }
      }
      return (await osm.search(query, near)).filter((p) => inRegion('KR', p));
    },

    reverse: osm.reverse ? (coord: Coord) => osm.reverse!(coord) : undefined,

    async resolve(place: Place): Promise<Place> {
      return place;
    },
  };
}

export function createGlobalPlaceProvider(osm: PlaceProvider): PlaceProvider {
  return {
    id: 'global',
    label: osm.label,

    async search(query: string, near?: Coord): Promise<Place[]> {
      return (await osm.search(query, near)).filter((p) => inRegion('GLOBAL', p));
    },

    // 해외 명소를 한글 이름으로 — 버튼을 눌렀을 때만 (nominatimPlaceProvider.ts)
    async searchMore(query: string): Promise<Place[]> {
      return (await searchByName(query)).filter((p) => inRegion('GLOBAL', p));
    },

    reverse: osm.reverse ? (coord: Coord) => osm.reverse!(coord) : undefined,

    async resolve(place: Place): Promise<Place> {
      return place;
    },
  };
}
