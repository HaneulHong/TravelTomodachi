/**
 * 지원 언어와 기기 언어 감지.
 *
 * React·브라우저에 의존하지 않는 순수 함수만 둔다 — 날짜 포맷(domain/time)이
 * 여기서 Locale 타입을 가져가고, 감지 규칙은 logic 테스트로 검증한다.
 */

export const LOCALES = ['ko', 'en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

/** 'auto'면 기기 언어를 따른다. 설정에서 끄면 고른 언어로 고정. */
export type LocalePreference = 'auto' | Locale;

/** 언어 선택지에는 그 언어 자신의 이름으로 적는다 — 못 읽는 언어로 적으면 못 찾는다. */
export const LOCALE_NAME: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
};

/** Intl에 넘길 BCP 47 태그 */
export const INTL_TAG: Record<Locale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
};

/**
 * 기기 언어 목록(navigator.languages)에서 지원하는 첫 언어.
 *
 * 순서대로 본다 — '프랑스어, 일본어' 순이면 일본어. 지원하는 게 하나도 없으면
 * 영어로 보여준다. 한국어를 모르는 사람에게 한국어보다는 영어가 읽힌다.
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const lang of languages) {
    const base = lang.toLowerCase().split(/[-_]/)[0];
    if ((LOCALES as readonly string[]).includes(base ?? '')) return base as Locale;
  }
  return 'en';
}

export function isLocalePreference(v: unknown): v is LocalePreference {
  return v === 'auto' || (LOCALES as readonly unknown[]).includes(v);
}
