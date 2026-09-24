/**
 * 후보 장소 순위 — 표가 많은 곳이 위로. 같으면 먼저 올린 곳.
 */

import type { Place, PlaceVote } from './types';

export interface RankedPlace {
  place: Place;
  /** 표를 준 사람(멤버 id) */
  voters: string[];
}

export function rankPlaces(places: readonly Place[], votes: readonly PlaceVote[]): RankedPlace[] {
  const byPlace = new Map<string, string[]>();
  for (const v of votes) byPlace.set(v.placeId, [...(byPlace.get(v.placeId) ?? []), v.userId]);
  return places
    .map((place) => ({ place, voters: [...new Set(byPlace.get(place.id) ?? [])] }))
    .sort(
      (a, b) =>
        b.voters.length - a.voters.length ||
        (a.place.createdAt ?? '').localeCompare(b.place.createdAt ?? '') ||
        a.place.id.localeCompare(b.place.id),
    );
}
