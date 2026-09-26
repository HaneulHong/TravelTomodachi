/**
 * 이름으로 더 찾기 — Nominatim (OpenStreetMap 재단의 공식 검색).
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────────
 * Photon은 해외 장소의 한글 이름을 거의 모른다("도쿄 스카이트리" 0건).
 * OSM에는 유명한 곳마다 name:ko(한국어 이름) 태그가 달려 있는데, Photon은 그 칸을
 * 검색하지 않고 Nominatim은 한다. 도쿄 스카이트리·센소지·오사카성·에펠탑이 한글로 찾히고,
 * 주소도 사용자 언어로 온다. 식당 같은 작은 곳은 여전히 약하다.
 *
 * ── 버튼을 눌렀을 때만 부른다 ─────────────────────────────────────
 * 공개 서버의 이용 정책이 입력할 때마다 부르는 자동완성을 금지하고, 초당 1회로 제한한다.
 * 그래서 목록 아래 "더 찾기" 버튼으로만 부르고, 여기서도 1초 간격을 지킨다.
 * 브라우저가 보내는 Referer(우리 주소)로 어느 앱인지 드러난다 — 정책이 요구하는 것.
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * 무료이고 저장 제한이 없다(ODbL — 출처 표시는 DataCredits의 OSM 줄).
 */

import { getLocale, getMessages } from '@/i18n/store';
import type { Place } from '../types';

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const LIMIT = 6;
/** 이용 정책: 초당 1회 */
const MIN_INTERVAL_MS = 1100;

interface NominatimResult {
  osm_type?: string;
  osm_id?: number;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
}

let lastCall = 0;
const cache = new Map<string, Place[]>();

/** display_name은 "이름, 번지, 동네, 구, 도시, …, 나라"라 첫 칸(이름)을 뺀 나머지가 주소다 */
export function nominatimToPlace(r: NominatimResult): Place | null {
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  const parts = (r.display_name ?? '').split(', ');
  const name = r.name || parts[0];
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: `nom-${r.osm_type ?? 'x'}${r.osm_id ?? name}`,
    // 여러 이름이 ;로 붙어 오기도 한다 ("오사카성;오사카 성")
    name: name.split(';')[0]!.trim(),
    address: parts.slice(1).join(', '),
    coord: { lat, lng },
  };
}

export async function searchByName(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length === 0) return [];
  const locale = getLocale();
  const key = `${locale}:${q}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: String(LIMIT),
    // 사용자 언어로 이름·주소를 받는다 (한국어면 "스미다구, 도쿄도, 일본")
    'accept-language': locale,
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!res.ok) throw new Error(getMessages().place.searchHttpFailed(res.status));

  const data = (await res.json()) as NominatimResult[];
  const seen = new Set<string>();
  const found = data
    .map(nominatimToPlace)
    .filter((p): p is Place => p !== null)
    // 같은 건물의 여러 입구·층이 따로 온다 — 이름과 주소가 같으면 하나만
    .filter((p) => {
      const k = `${p.name}|${p.address}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  cache.set(key, found);
  return found;
}
