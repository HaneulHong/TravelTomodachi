/**
 * 사용법 스크린샷 주소 — 언어마다 한 벌(scripts/guide-shots.mjs가 만든다).
 *
 * 빌드가 파일마다 해시 붙은 주소를 준다 — /assets/ 아래라 서비스 워커가 본 것을 저장해
 * 오프라인에서도 한 번 본 그림은 뜬다(public/sw.js). 주소만 들고 있어 가볍다.
 */

const SHOTS = import.meta.glob<string>('./*/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** n은 사용법 단계 번호(1부터) */
export function guideShot(locale: string, n: number): string | undefined {
  return SHOTS[`./${locale}/${n}.jpg`];
}
