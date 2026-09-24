/*
 * 서비스 워커 — 오프라인에서도 앱이 열리게 앱 파일을 기기에 둔다.
 *
 * 맡는 건 **이 사이트의 앱 파일**뿐이다(index.html, assets/*).
 * Supabase·지도·길찾기 요청은 건드리지 않는다. 여행 데이터의 오프라인 사본은
 * 앱이 따로 들고 있다(src/data/offlineCache.ts).
 *
 *   페이지(index.html) — 네트워크 먼저, 안 되면 저장본. 온라인이면 늘 새 배포를 받는다.
 *   assets/*           — 저장본 먼저. 파일 이름에 해시가 붙어 내용이 바뀌면 이름도 바뀐다.
 *   그 밖(아이콘 등)    — 손대지 않는다.
 *
 * 웹 배포본에서만 등록한다(main.tsx). 앱(Capacitor)은 파일이 이미 기기 안에 있다.
 * 캐시 모양을 바꾸면 VERSION을 올린다 — 옛 캐시는 activate에서 지운다.
 */

const VERSION = 'v1';
const SHELL = `tt-shell-${VERSION}`;
const ASSETS = `tt-assets-${VERSION}`;
/** 배포가 쌓이면 옛 해시 파일이 남는다. 이만큼만 두고 오래된 것부터 지운다. */
const MAX_ASSETS = 80;
/**
 * 서버가 `Vary: Origin`을 붙여 보낸다. 모듈 스크립트 요청에는 Origin이 붙고 미리
 * 받아 둔 요청에는 없어서, 그대로 찾으면 저장본이 있는데도 못 찾는다(오프라인에서
 * 앱이 안 열린다). 해시 붙은 파일은 누가 요청해도 같은 내용이라 Vary를 무시한다.
 */
const MATCH = { ignoreVary: true };

/**
 * 설치할 때 index.html과 거기 적힌 파일(진입 JS·CSS)을 받아 둔다.
 * 처음 방문한 페이지는 서비스 워커가 켜지기 전에 파일을 받아서 그대로 두면
 * 저장되지 않는다 — 첫 방문 뒤 바로 오프라인이 되면 앱이 안 열린다.
 */
async function precache() {
  const shell = await caches.open(SHELL);
  const res = await fetch('./', { cache: 'no-cache' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await shell.put('./', res);
  const files = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => m[1]);
  await cacheUrls(files);
}

async function cacheUrls(urls) {
  const cache = await caches.open(ASSETS);
  await Promise.all(
    urls.map(async (u) => {
      const url = new URL(u, self.registration.scope).href;
      if (await cache.match(url, MATCH)) return;
      try {
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res);
      } catch {
        // 하나 못 받아도 나머지는 둔다
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()));
});

/** 페이지가 이미 받아 둔 파일 목록을 보내 준다(main.tsx) — 나중에 불러온 조각까지 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'cache-assets' && Array.isArray(data.urls)) {
    event.waitUntil(
      cacheUrls(data.urls.filter((u) => typeof u === 'string' && u.includes('/assets/'))),
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('tt-') && k !== SHELL && k !== ASSETS)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // keys()는 넣은 순서라 앞쪽이 오래된 것
  for (const req of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(req);
}

/** 페이지: 네트워크 먼저. 받은 새 index.html은 저장해 두고, 안 되면 저장본. */
async function networkFirstPage(request) {
  const cache = await caches.open(SHELL);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) await cache.put('./', fresh.clone());
    return fresh;
  } catch {
    return (await cache.match('./', MATCH)) ?? Response.error();
  }
}

/** 해시 붙은 파일: 저장본 먼저, 없으면 받아서 저장 */
async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request, MATCH);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) {
    await cache.put(request, fresh.clone());
    void trim(ASSETS, MAX_ASSETS);
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // 다른 사이트(Supabase, 지도, 폰트 등)는 브라우저에 맡긴다
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  // 아이콘·manifest는 브라우저에 맡긴다 — 저장본 먼저로 두면 바꾼 아이콘이 안 퍼진다
  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirstAsset(request));
  }
});
