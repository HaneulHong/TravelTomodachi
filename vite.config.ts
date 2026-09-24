import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

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

  server: {
    host: true, // 같은 와이파이의 휴대폰에서 실기기 테스트 가능
    port: 5173,
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
