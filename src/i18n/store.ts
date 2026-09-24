/**
 * 지금 언어 — React 밖에서도 읽는 저장소.
 *
 * 기본은 기기 언어를 따른다('auto'). 프로필에서 끄고 직접 고를 수 있고,
 * 고른 값은 이 기기에만 남는다 — 같은 여행에서도 사람마다 다른 언어로 본다.
 * 번역하는 건 앱 문구뿐이다. 일정 제목·메모처럼 사람이 쓴 내용은 그대로.
 *
 * 데이터 계층(오류 문구)도 여기서 읽으므로 React에 의존하지 않는 vanilla
 * 스토어로 둔다. 화면용 훅은 i18n/index.ts.
 */

import { createStore } from 'zustand/vanilla';
import { detectLocale, isLocalePreference, type Locale, type LocalePreference } from './locales';
import { ko, type Messages } from './messages/ko';
import { en } from './messages/en';
import { ja } from './messages/ja';

export const MESSAGES: Record<Locale, Messages> = { ko, en, ja };

const STORAGE_KEY = 'tt.locale';

function deviceLocale(): Locale {
  if (typeof navigator === 'undefined') return 'ko';
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return detectLocale(langs);
}

// 사생활 보호 모드 등에서 저장소가 막혀 있어도 앱은 떠야 한다
function readPreference(): LocalePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLocalePreference(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function writePreference(pref: LocalePreference): void {
  try {
    if (pref === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // 저장 못 해도 이번 실행 동안은 바뀐 언어로 보인다
  }
}

/** <html lang>도 맞춘다 — 화면 읽기 도구와 브라우저 번역 제안이 이걸 본다 */
function applyToDocument(locale: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

const resolve = (pref: LocalePreference, device: Locale): Locale =>
  pref === 'auto' ? device : pref;

export interface LocaleState {
  preference: LocalePreference;
  /** 기기 언어를 따랐을 때의 언어. 설정 화면에 "지금 기기 언어"로 보여준다. */
  device: Locale;
  /** 실제로 보여주는 언어 */
  locale: Locale;
  setPreference(pref: LocalePreference): void;
}

const initialPref = readPreference();
const initialDevice = deviceLocale();

export const localeStore = createStore<LocaleState>()((set, get) => ({
  preference: initialPref,
  device: initialDevice,
  locale: resolve(initialPref, initialDevice),

  setPreference: (preference) => {
    writePreference(preference);
    const locale = resolve(preference, get().device);
    applyToDocument(locale);
    set({ preference, locale });
  },
}));

applyToDocument(localeStore.getState().locale);

// 앱을 켜 둔 채 기기 언어를 바꾼 경우. 'auto'일 때만 따라간다.
if (typeof window !== 'undefined') {
  window.addEventListener('languagechange', () => {
    const device = deviceLocale();
    const locale = resolve(localeStore.getState().preference, device);
    applyToDocument(locale);
    localeStore.setState({ device, locale });
  });
}

export function getLocale(): Locale {
  return localeStore.getState().locale;
}

/** React 밖(스토어·데이터 계층의 오류 문구 등)에서 지금 언어의 문구 */
export function getMessages(): Messages {
  return MESSAGES[getLocale()];
}

/**
 * DB 함수(supabase/*.sql)가 던지는 한국어 오류를 지금 언어로.
 * SQL을 고치지 않고 앱에서 옮긴다 — 모르는 문구는 그대로 둔다.
 */
export function translateServerError(message: string): string {
  const t = getMessages().serverErrors;
  const known = (Object.keys(ko.serverErrors) as (keyof Messages['serverErrors'])[]).find((k) =>
    message.includes(ko.serverErrors[k]),
  );
  return known ? t[known] : message;
}
