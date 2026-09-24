/**
 * 통화 — 고를 수 있는 목록, 여행지의 기본 통화, 보여주는 모양.
 */

import { INTL_TAG, type Locale } from '../i18n/locales';

/** 고를 수 있는 통화. 여행에서 자주 쓰는 것만 — 타임존 목록(timezones.ts)과 맞춘다. */
export const CURRENCIES = [
  'KRW', 'JPY', 'USD', 'EUR', 'CNY', 'TWD', 'HKD', 'THB', 'VND', 'SGD',
  'IDR', 'PHP', 'MYR', 'INR', 'AED', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF',
] as const;

/** 타임존으로 짐작하는 현지 통화. 지출을 적을 때 기본값으로 쓴다. */
const BY_TIMEZONE: Record<string, string> = {
  'Asia/Seoul': 'KRW',
  'Asia/Tokyo': 'JPY',
  'Asia/Shanghai': 'CNY',
  'Asia/Taipei': 'TWD',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Bangkok': 'THB',
  'Asia/Ho_Chi_Minh': 'VND',
  'Asia/Singapore': 'SGD',
  'Asia/Jakarta': 'IDR',
  'Asia/Manila': 'PHP',
  'Asia/Kuala_Lumpur': 'MYR',
  'Asia/Kolkata': 'INR',
  'Asia/Dubai': 'AED',
  'Europe/London': 'GBP',
  'Europe/Paris': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/Madrid': 'EUR',
  'Europe/Zurich': 'CHF',
  'America/New_York': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Toronto': 'CAD',
  'Australia/Sydney': 'AUD',
  'Pacific/Auckland': 'NZD',
};

export function currencyForTimezone(timezone: string | undefined): string | undefined {
  return timezone ? BY_TIMEZONE[timezone] : undefined;
}

/** 화면 언어 사람의 기본 정산 통화. 각자 설정에서 바꾼다. */
export function homeCurrency(locale: Locale): string {
  return locale === 'ja' ? 'JPY' : locale === 'en' ? 'USD' : 'KRW';
}

/** ₩12,000 · ¥4,800 · $12.50 */
export function formatMoney(amount: number, currency: string, locale: Locale): string {
  try {
    return new Intl.NumberFormat(INTL_TAG[locale], { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** 통화 이름 — 선택 목록에 'JPY · 일본 엔'처럼 */
export function currencyName(currency: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([INTL_TAG[locale]], { type: 'currency' }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}
