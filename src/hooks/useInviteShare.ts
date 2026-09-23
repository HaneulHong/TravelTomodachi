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

/**
 * 초대 링크. 공개 웹 주소가 없으면(배포 전 앱) undefined — 친구가 열 수 없는
 * capacitor://localhost 링크를 보내느니 코드만 보내는 게 낫다.
 */
export function inviteUrl(code: string): string | undefined {
  return platform.publicBaseUrl ? `${platform.publicBaseUrl}/#/invite/${code}` : undefined;
}

export function useInviteShare(): {
  share(trip: Pick<Trip, 'name' | 'inviteCode'>): Promise<void>;
  toast: string | null;
} {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const share = useCallback(async (trip: Pick<Trip, 'name' | 'inviteCode'>) => {
    const url = inviteUrl(trip.inviteCode);
    const result = await platform.share({
      title: trip.name,
      // 코드는 링크가 있어도 적는다. 앱을 쓰는 친구는 링크 대신 코드를 입력한다.
      text: url
        ? `${trip.name} 일정을 함께 봐요 (초대 코드 ${trip.inviteCode})`
        : `${trip.name} 일정을 함께 봐요\n초대 코드: ${trip.inviteCode}\n앱에서 "초대 코드로 참가"를 누르고 입력하세요.`,
      url,
    });
    if (result === 'copied') setToast(url ? '초대 링크를 복사했습니다' : '초대 코드를 복사했습니다');
    else if (result === 'unavailable') setToast(`초대 코드: ${trip.inviteCode}`);
    else return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  return { share, toast };
}
