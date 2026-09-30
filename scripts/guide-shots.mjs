/**
 * 사용법(#/guide)·docs/GUIDE.md에 붙는 스크린샷을 만든다. 화면을 바꾸면 다시 돌린다.
 *
 *   npm run dev                       (다른 창에서, 백엔드 설정 없이 — 목 데이터로 찍는다)
 *   npm i --no-save playwright        (한 번만. package.json에 넣지 않는다)
 *   node scripts/guide-shots.mjs
 *
 * 한·영·일 세 벌을 src/assets/guide/{ko,en,ja}/{1..7}.jpg로 쓴다. 번호는 사용법 단계 순서
 * (src/i18n/messages/ko.ts의 guide.steps)와 같다. 시계를 여행 중인 날(방콕 오전 10시)에 맞춰
 * 오늘 카드·"지금" 표시까지 보이게 한다. 목 데이터의 여행 이름은 한국어라 번역되지 않는다.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright').catch(() => null);
if (!pw) {
  console.error('playwright가 없습니다: npm i --no-save playwright');
  process.exit(1);
}

const BASE = process.env.GUIDE_BASE_URL ?? 'http://localhost:5173/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'guide');
// 2026-11-04 03:00 UTC = 방콕 10:00, 동남아 여행 2일차
const NOW = new Date('2026-11-04T03:00:00Z');
const TRIP = '#/trip/t-sea';
const DAY = '?date=2026-11-04';

/** 단계 번호 → 찍을 화면. 번호는 guide.steps 순서 */
const SHOTS = [
  { n: 1, hash: '#/trip/new' },
  { n: 2, hash: `${TRIP}/members` },
  { n: 3, hash: `${TRIP}/item/new${DAY}` },
  { n: 4, hash: `${TRIP}${DAY}`, wait: 3500 },
  { n: 5, hash: `${TRIP}/map${DAY}`, wait: 2500 },
  { n: 6, hash: `${TRIP}${DAY}`, click: '.header > :last-child' },
  { n: 7, hash: '#/' },
];

const LOCALES = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

/**
 * 공개 경로 서버(Valhalla)는 찍을 때마다 답이 다르고, 막힌 환경에서는 이동 시간 칸이 빈다.
 * 직선거리로 만든 답을 준다(도보 시속 4.5km, 차 시속 25km — 모양만 보이면 된다).
 * 대중교통(Transitous)은 없는 것으로.
 */
async function fakeRoutes(page) {
  await page.route('https://valhalla1.openstreetmap.de/**', (route) => {
    const q = JSON.parse(new URL(route.request().url()).searchParams.get('json'));
    const [a, b] = q.locations;
    const rad = (d) => (d * Math.PI) / 180;
    const km =
      6371 *
      2 *
      Math.asin(
        Math.sqrt(
          Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2,
        ),
      ) *
      1.3;
    const kmh = q.costing === 'pedestrian' ? 4.5 : 25;
    return route.fulfill({
      json: { trip: { summary: { length: km, time: (km / kmh) * 3600 }, legs: [{}] } },
    });
  });
  await page.route('https://api.transitous.org/**', (route) => route.fulfill({ status: 503 }));
  // 개발 서버에서만 뜨는 지도 키 안내는 사용법에 맞지 않다
  await page.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.mapstage__note { display: none !important; }';
      document.head.append(style);
    });
  });
}

const browser = await pw.chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
for (const [lang, locale] of Object.entries(LOCALES)) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    locale,
    // 새 여행의 기본 타임존이 기기 것을 따른다 — 한국에서 쓰는 사람 기준
    timezoneId: 'Asia/Seoul',
    colorScheme: 'light',
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  await fakeRoutes(page);
  await page.goto(BASE);

  // 개발용 계정으로 들어가고, 첫 로그인 닉네임은 건너뛴다
  await page.locator('.signin__methods button').first().click();
  const later = page.locator('.signin button.btn--ghost');
  await later.first().click({ timeout: 3000 }).catch(() => {});

  mkdirSync(join(OUT, lang), { recursive: true });
  for (const shot of SHOTS) {
    await page.evaluate((h) => {
      window.location.hash = h;
    }, shot.hash);
    await page.waitForTimeout(shot.wait ?? 900);
    await page.evaluate(() => window.scrollTo(0, 0));
    if (shot.click) {
      await page.locator(shot.click).first().click();
      await page.waitForTimeout(600);
    }
    const file = join(OUT, lang, `${shot.n}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 72 });
    console.log(file);
    // 메뉴 시트 등을 닫는다
    await page.keyboard.press('Escape');
  }
  await ctx.close();
}
await browser.close();
