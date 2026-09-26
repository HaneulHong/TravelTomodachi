import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * public/_headers(Cloudflare Pages 응답 헤더)의 `/*` 블록을 읽는다.
 * `vite preview`가 같은 헤더를 붙여, 배포 전에 로컬에서 보안 헤더(CSP 등)를 확인할 수 있다.
 */
function pagesHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  let inAll = false;
  for (const line of readFileSync(new URL('./public/_headers', import.meta.url), 'utf8').split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    if (!line.startsWith(' ')) {
      inAll = line.trim() === '/*';
      continue;
    }
    const i = line.indexOf(':');
    if (inAll && i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

export default defineConfig({
  // ── Capacitor 전환 제약 #2 ──────────────────────────────────────────
  // 네이티브 앱에서는 index.html이 로컬 파일/로컬 서버에서 로드된다.
  // base가 '/'이면 asset 경로가 전부 깨지므로 상대 경로가 필수.
  base: './',

  plugins: [react()],

  // 화면에 보이는 버전. package.json 한 곳에서만 올린다.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  // 배포본과 같은 응답 헤더 (위 pagesHeaders)
  preview: {
    headers: pagesHeaders(),
  },

  server: {
    host: true, // 같은 와이파이의 휴대폰에서 실기기 테스트 가능
    port: 5173,
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
