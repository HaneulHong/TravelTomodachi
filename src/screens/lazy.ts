/**
 * 필요할 때 받는 화면들 — 첫 로딩을 가볍게.
 *
 * 홈·일정·로그인은 처음에 바로 필요해서 같이 받고, 나머지(지도·가계부·후보·처리방침 등)는
 * 따로 떼어 그 화면에 갈 때 받는다. 지도 화면은 지도 SDK 로더·렌더러를 끌고 와서 특히 크다.
 *
 * 그러면 오프라인에서 한 번도 안 연 화면이 안 열린다(파일을 받은 적이 없으니). 그래서 첫
 * 화면이 뜬 뒤 남는 시간에 나머지를 미리 받아 둔다(preloadScreens) — 서비스 워커가
 * 그 파일들을 기기에 저장한다(public/sw.js).
 */

import { lazy } from 'react';

const loaders = {
  itemDetail: () => import('./ItemDetailScreen'),
  itemEdit: () => import('./ItemEditScreen'),
  map: () => import('./MapScreen'),
  members: () => import('./MembersScreen'),
  checklist: () => import('./ChecklistScreen'),
  expenses: () => import('./ExpensesScreen'),
  ideas: () => import('./IdeasScreen'),
  invite: () => import('./InviteScreen'),
  profile: () => import('./ProfileScreen'),
  privacy: () => import('./PrivacyScreen'),
  tripCreate: () => import('./TripCreateScreen'),
};

export const ItemDetailScreen = lazy(() => loaders.itemDetail().then((m) => ({ default: m.ItemDetailScreen })));
export const ItemEditScreen = lazy(() => loaders.itemEdit().then((m) => ({ default: m.ItemEditScreen })));
export const MapScreen = lazy(() => loaders.map().then((m) => ({ default: m.MapScreen })));
export const MembersScreen = lazy(() => loaders.members().then((m) => ({ default: m.MembersScreen })));
export const ChecklistScreen = lazy(() => loaders.checklist().then((m) => ({ default: m.ChecklistScreen })));
export const ExpensesScreen = lazy(() => loaders.expenses().then((m) => ({ default: m.ExpensesScreen })));
export const IdeasScreen = lazy(() => loaders.ideas().then((m) => ({ default: m.IdeasScreen })));
export const InviteScreen = lazy(() => loaders.invite().then((m) => ({ default: m.InviteScreen })));
export const ProfileScreen = lazy(() => loaders.profile().then((m) => ({ default: m.ProfileScreen })));
export const PrivacyScreen = lazy(() => loaders.privacy().then((m) => ({ default: m.PrivacyScreen })));
export const TripCreateScreen = lazy(() => loaders.tripCreate().then((m) => ({ default: m.TripCreateScreen })));

/** 나머지 화면을 미리 받는다. 하나가 실패해도(오프라인 등) 나머지는 계속. */
export function preloadScreens(): Promise<void> {
  return Promise.allSettled(Object.values(loaders).map((load) => load())).then(() => {});
}
