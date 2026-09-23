/**
 * 초대 링크 공유. 일정 메뉴와 멤버 화면이 같이 쓴다.
 *
 * 공유 시트가 없는 환경(데스크톱 브라우저)에서는 링크를 복사하고, 그것도
 * 안 되면 코드를 그대로 보여준다. 어느 경우든 "무슨 일이 일어났는지"를
 * 토스트로 알린다 — 조용히 복사되면 눌렀는데 아무 일도 없는 것처럼 보인다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trip } from '@/domain/types';
import { platform } from '@/platform';

export function inviteUrl(code: string): string {
  return `${platform.publicBaseUrl}/#/invite/${code}`;
}

export function useInviteShare(): {
  share(trip: Pick<Trip, 'name' | 'inviteCode'>): Promise<void>;
  toast: string | null;
} {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const share = useCallback(async (trip: Pick<Trip, 'name' | 'inviteCode'>) => {
    const result = await platform.share({
      title: trip.name,
      text: `${trip.name} 일정을 함께 봐요`,
      url: inviteUrl(trip.inviteCode),
    });
    if (result === 'copied') setToast('초대 링크를 복사했습니다');
    else if (result === 'unavailable') setToast(`초대 코드: ${trip.inviteCode}`);
    else return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  return { share, toast };
}
