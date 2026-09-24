/**
 * 첫 로그인 닉네임 정하기 — 보여줄지 판단.
 *
 * 가입하면 모두 기본 닉네임(여행자 · Traveler · 旅行者)으로 시작해서, 친구 넷이
 * 들어오면 멤버 목록이 '여행자'로 꽉 찬다. 번호(#0421)로 구분은 되지만 누가
 * 누군지는 모른다. 그래서 기본 닉네임인 사람에게 한 번 묻는다.
 *
 * "가입한 직후"가 아니라 "아직 기본 닉네임"을 기준으로 한다 — 이 화면이 생기기
 * 전에 가입해 '여행자'로 남아 있는 사람도 한 번 보게 된다.
 * 「나중에」를 누르면 그 기기에서는 다시 묻지 않는다(프로필에서 언제든 바꾼다).
 */

import { MESSAGES } from '@/i18n/store';

const KEY = (userId: string) => `tt.nickname-asked.${userId}`;

/** 어느 언어로든 기본 닉네임인지 — 가입한 사람의 언어로 들어가 있다 */
export function isDefaultNickname(nickname: string): boolean {
  return Object.values(MESSAGES).some((m) => m.profile.defaultNickname === nickname.trim());
}

function alreadyAsked(userId: string): boolean {
  try {
    return localStorage.getItem(KEY(userId)) !== null;
  } catch {
    // 저장소가 막혀 있으면 매번 묻게 되므로 차라리 묻지 않는다
    return true;
  }
}

export function markNicknameAsked(userId: string): void {
  try {
    localStorage.setItem(KEY(userId), '1');
  } catch {
    // 이번 실행 동안은 화면 상태로 넘어간다
  }
}

export function shouldAskNickname(account: { id: string; nickname: string }): boolean {
  return isDefaultNickname(account.nickname) && !alreadyAsked(account.id);
}
