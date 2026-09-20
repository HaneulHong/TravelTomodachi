/**
 * 여행 저장소 선택.
 *
 * Supabase가 설정돼 있으면 그쪽, 아니면 개발용 목. 화면과 스토어는 어느
 * 쪽인지 모른다 — providers/·auth/와 같은 구조다.
 */

import { hasBackend } from '@/supabase/client';
import { mockTripRepository } from './mockTripRepository';
import { createSupabaseTripRepository } from './supabaseTripRepository';
import type { TripRepository } from './tripRepository';

export * from './tripRepository';

/** 한 번만 만든다 — 매번 새로 만들면 Supabase 클라이언트가 여러 개 생긴다. */
const repository: TripRepository = hasBackend
  ? createSupabaseTripRepository()
  : mockTripRepository;

export function getTripRepository(): TripRepository {
  return repository;
}
