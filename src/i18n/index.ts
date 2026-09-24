/**
 * 앱 언어 — 화면용.
 *
 * 화면에서는 useT()로 문구를, useLocale()로 날짜 포맷에 넘길 언어를 받는다.
 * React 밖에서는 i18n/store의 getMessages() · getLocale().
 * 규칙과 저장 방식은 i18n/store.ts 주석 참고.
 */

import { useStore } from 'zustand';
import { localeStore, MESSAGES, type LocaleState } from './store';
import type { Locale } from './locales';
import type { Messages } from './messages/ko';

export * from './locales';
export { getLocale, getMessages, translateServerError } from './store';
export type { Messages };

export function useLocale(): Locale {
  return useStore(localeStore, (s) => s.locale);
}

export function useT(): Messages {
  return MESSAGES[useLocale()];
}

export function useLocaleSettings(): Pick<
  LocaleState,
  'preference' | 'device' | 'locale' | 'setPreference'
> {
  const preference = useStore(localeStore, (s) => s.preference);
  const device = useStore(localeStore, (s) => s.device);
  const locale = useStore(localeStore, (s) => s.locale);
  const setPreference = useStore(localeStore, (s) => s.setPreference);
  return { preference, device, locale, setPreference };
}
