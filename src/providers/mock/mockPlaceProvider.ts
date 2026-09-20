/**
 * 목 장소검색.
 *
 * 실제 구현 시 주의: Google Places Autocomplete는 비싼 SKU다.
 * debounce + session token + 결과 캐싱을 반드시 넣어야 한다. 타이핑마다
 * 호출하면 월 무료 사용량이 순식간에 녹는다.
 */

import { haversineMeters } from '@/domain/geo';
import type { Coord } from '@/domain/types';
import type { Place, PlaceProvider } from '../types';

/** 목 데이터는 좌표를 반드시 들고 있다 — 거리순 정렬에 필요하다. */
type SeedPlace = Place & { coord: Coord };

const SEED: SeedPlace[] = [
  { id: 'p-gyeongbok', name: '경복궁', address: '서울 종로구 사직로 161', coord: { lat: 37.5796, lng: 126.977 } },
  { id: 'p-bukchon', name: '북촌한옥마을', address: '서울 종로구 계동길', coord: { lat: 37.5826, lng: 126.9832 } },
  { id: 'p-icn', name: '인천국제공항 제1터미널', address: '인천 중구 공항로 271', coord: { lat: 37.4492, lng: 126.4505 } },
  { id: 'p-bkk-grand', name: '왓 프라깨우 (왕궁)', address: 'Na Phra Lan Rd, Bangkok', coord: { lat: 13.7515, lng: 100.4925 } },
  { id: 'p-bkk-chatuchak', name: '짜뚜짝 주말시장', address: 'Kamphaeng Phet 2 Rd, Bangkok', coord: { lat: 13.7999, lng: 100.5502 } },
  { id: 'p-bkk-iconsiam', name: '아이콘시암', address: '299 Charoen Nakhon Rd, Bangkok', coord: { lat: 13.7263, lng: 100.5101 } },
  { id: 'p-hanoi-hoankiem', name: '호안끼엠 호수', address: 'Hàng Trống, Hoàn Kiếm, Hà Nội', coord: { lat: 21.0287, lng: 105.8524 } },
  { id: 'p-hanoi-train', name: '하노이 기찻길 마을', address: 'Phùng Hưng, Hoàn Kiếm, Hà Nội', coord: { lat: 21.0313, lng: 105.8447 } },
  { id: 'p-tokyo-senso', name: '센소지', address: '2-3-1 Asakusa, Taito, Tokyo', coord: { lat: 35.7148, lng: 139.7967 } },
  { id: 'p-tokyo-shibuya', name: '시부야 스크램블 교차로', address: '2 Dogenzaka, Shibuya, Tokyo', coord: { lat: 35.6595, lng: 139.7004 } },
  { id: 'p-tokyo-teamlab', name: 'teamLab Planets', address: '6-1-16 Toyosu, Koto, Tokyo', coord: { lat: 35.6487, lng: 139.7899 } },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockPlaceProvider: PlaceProvider = {
  id: 'mock-places',
  label: '장소검색 (목)',

  // 목 데이터는 좌표를 이미 들고 있어서 채울 게 없다.
  async resolve(place: Place): Promise<Place> {
    return place;
  },

  async search(query: string, near?: Coord): Promise<Place[]> {
    await delay(200);
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];

    const hits = SEED.filter(
      (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q),
    );

    if (!near) return hits.slice(0, 8);

    // 가까운 곳 우선 — 실제 API의 location bias와 같은 취지
    return hits
      .slice()
      .sort((a, b) => haversineMeters(near, a.coord) - haversineMeters(near, b.coord))
      .slice(0, 8);
  },
};
