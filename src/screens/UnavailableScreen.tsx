/**
 * 서비스를 쓸 수 없을 때.
 *
 * 배포 빌드에 Supabase 설정이 빠지면 예전에는 조용히 개발용 목으로 돌았다.
 * 사용자는 로그인한 줄 알고 일정을 짜지만 새로고침하면 전부 사라진다 —
 * 그보다는 솔직하게 "지금은 안 된다"고 말하는 게 낫다.
 */

import { versionLabel } from '@/config';
import { useT } from '@/i18n';

export function UnavailableScreen() {
  const t = useT();
  return (
    <div className="app">
      <main className="main main--no-tabs signin">
        <div className="signin__brand">
          <span className="signin__mark">🧳</span>
          <h1 className="signin__title">TravelTomodachi</h1>
          <p className="signin__sub">{t.unavailable.title}</p>
        </div>
        <p className="signin__note">{t.unavailable.body}</p>
        <div className="signin__methods">
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            {t.unavailable.retry}
          </button>
        </div>
        <p className="signin__version">{versionLabel(t.common.beta)}</p>
      </main>
    </div>
  );
}
