/**
 * 초대 링크용 공개 주소(VITE_PUBLIC_BASE_URL)를 다듬는다.
 *
 * 사람이 Cloudflare 대시보드에 손으로 넣는 값이라 흔한 실수를 여기서 흡수한다.
 * - 앞뒤 공백
 * - 끝의 `/` → `https://…pages.dev//#/invite/…`처럼 슬래시가 겹친다
 * - `https://` 빠짐 → 공유 메시지에서 링크로 인식되지 않는다
 * 값이 없거나 비어 있으면 빈 문자열 — 부르는 쪽이 대체값을 정한다.
 */
export function normalizeBaseUrl(raw: string | undefined): string {
  const v = (raw ?? '').trim().replace(/\/+$/, '');
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
