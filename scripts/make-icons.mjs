/**
 * 앱 아이콘 만들기 — assets/icon.svg 하나에서 웹·iOS·Android 크기를 모두 뽑는다.
 *
 *   npx -y -p playwright@1 node scripts/make-icons.mjs
 *
 * 브라우저(Chromium)로 SVG를 그려 PNG로 찍는다. 이미지 라이브러리를 따로 두지 않으려고.
 * 크롬이 없으면 PLAYWRIGHT_CHROMIUM=/경로 로 지정한다.
 *
 *   웹  public/icon-192.png, icon-512.png   — 둥근 모서리(그대로 보이는 곳이 많다)
 *       public/icon-maskable-512.png       — 꽉 찬 정사각형, 그림은 안전 영역(80%) 안
 *       public/apple-touch-icon.png (180)  — 꽉 찬 정사각형(iOS가 깎는다)
 *       public/favicon.svg
 *   iOS ios/…/AppIcon-512@2x.png (1024)    — 꽉 찬 정사각형, 투명 없음
 *   Android mipmap-*: ic_launcher(_round).png, ic_launcher_foreground.png(적응형 앞면)
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = readFileSync(`${root}assets/icon.svg`, 'utf8').replace(/<!--[\s\S]*?-->\s*/g, '');
const BG = '#b2563a';
const glyph = /<g id="glyph"[\s\S]*<\/g>/.exec(src)[0];

/** 모양별 SVG. scale은 그림 크기(적응형·maskable은 안전 영역 안으로 줄인다). */
function svg({ radius = 0, background = true, scale = 1 }) {
  const t = `translate(${256 * (1 - scale)} ${256 * (1 - scale)}) scale(${scale})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    ${background ? `<rect width="512" height="512" rx="${radius}" fill="${BG}"/>` : ''}
    <g transform="${t}">${glyph}</g></svg>`;
}

const targets = [
  ['public/icon-192.png', 192, { radius: 112 }],
  ['public/icon-512.png', 512, { radius: 112 }],
  ['public/icon-maskable-512.png', 512, { scale: 0.8 }],
  ['public/apple-touch-icon.png', 180, {}],
  ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, {}],
];
// Android: 런처 아이콘(48dp)과 적응형 앞면(108dp, 그림은 가운데 66dp 안 — 그림 폭이 원래 절반이라 0.9면 들어간다)
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  const res = `android/app/src/main/res/mipmap-${d}`;
  targets.push([`${res}/ic_launcher.png`, 48 * k, { radius: 96 }]);
  targets.push([`${res}/ic_launcher_round.png`, 48 * k, { radius: 256 }]);
  targets.push([`${res}/ic_launcher_foreground.png`, 108 * k, { background: false, scale: 0.9 }]);
}

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const page = await browser.newPage();
for (const [out, size, shape] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(shape)}`,
  );
  // 둥근 모서리와 적응형 앞면만 투명. 나머지는 꽉 찬 배경이다.
  const transparent = Boolean(shape.radius) || shape.background === false;
  const png = await page.screenshot({ omitBackground: transparent });
  mkdirSync(dirname(`${root}${out}`), { recursive: true });
  writeFileSync(`${root}${out}`, png);
  console.log(`${out} (${size})`);
}
await browser.close();

writeFileSync(`${root}public/favicon.svg`, svg({ radius: 112 }).replace(/\s+/g, ' ').trim() + '\n');
console.log('public/favicon.svg');
