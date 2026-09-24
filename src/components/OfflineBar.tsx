/**
 * 오프라인 · 서버 연결 안 됨 알림.
 *
 * 기기에 남은 사본(data/offlineCache.ts)을 보여줄 때는 그렇다고 말한다. 모르고
 * 고치면 저장이 실패해 되돌아가는데, 왜 되돌아갔는지 알 수 없다.
 * 아래쪽에 떠 있는 알약으로 둔다 — 자리 잡는 규칙은 styles.css의 .offline-bar.
 */

import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import { useTripStore } from '@/store/tripStore';

export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function OfflineBar() {
  const t = useT();
  const online = useOnline();
  const fromCache = useTripStore((s) => s.fromCache);

  if (online && !fromCache) return null;
  return (
    <div className="offline-bar" role="status">
      {online ? t.offline.serverDown : t.offline.offline}
    </div>
  );
}
