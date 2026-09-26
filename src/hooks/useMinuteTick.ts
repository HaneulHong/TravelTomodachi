import { useEffect, useState } from 'react';

/** 1분마다 다시 그린다 — "다음 일정까지 N분", 현지 시각, "지금" 표시가 흘러가야 한다 */
export function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
