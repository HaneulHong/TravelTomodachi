/**
 * 이 페이지가 지금까지 받은 앱 파일(/assets/…) 목록을 서비스 워커에 알려 저장하게 한다.
 * 첫 방문에는 서비스 워커가 켜지기 전에 파일을 받아서, 알려 주지 않으면 저장되지 않는다
 * (public/sw.js의 'cache-assets'). 나중에 받은 화면 조각(screens/lazy.ts)도 같은 방법으로.
 */
export function cacheLoadedAssets(): void {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.ready
    .then((reg) => {
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(window.location.origin) && u.includes('/assets/'));
      reg.active?.postMessage({ type: 'cache-assets', urls });
    })
    .catch(() => {});
}
