import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { restoreHashFromQuery } from './domain/inAppBrowser';
import { platform } from './platform';
import './styles.css';

/*
 * 앱 안 브라우저에서 안드로이드 intent로 넘어오면 해시(#/invite/코드)가 쿼리에 실려 온다
 * (intent 주소는 `#`을 자기 구분자로 써서). 앱이 뜨기 전에 원래 주소로 되돌린다.
 */
const restored = restoreHashFromQuery(window.location.href);
if (restored) window.history.replaceState(null, '', restored);

const root = document.getElementById('root');
if (!root) throw new Error('#root 엘리먼트가 없습니다');

/*
 * 오프라인에서도 앱이 열리게 서비스 워커를 등록한다 (public/sw.js).
 * 웹 배포본에서만 — 개발 서버에서 켜면 고친 코드 대신 저장본이 떠서 헷갈리고,
 * 앱(Capacitor)은 파일이 이미 기기 안에 있다.
 * 등록이 실패해도 앱은 그대로 돈다(오프라인에서만 못 열 뿐).
 */
if (import.meta.env.PROD && platform.kind === 'web' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // 이 페이지가 이미 받은 앱 파일을 알려 준다 — 첫 방문에도 저장되게 (sw.js)
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(window.location.origin) && u.includes('/assets/'));
        reg.active?.postMessage({ type: 'cache-assets', urls });
      })
      .catch(() => {});
  });
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
