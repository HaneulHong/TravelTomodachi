/**
 * 환율 — ExchangeRate-API 공개판 (open.er-api.com).
 *
 * 무료, 키 없음. 조건: 출처 표시("Rates By Exchange Rate API" 링크), 받은 값을
 * 다시 배포하지 않기, 너무 자주 부르지 않기(속도 제한). 그래서 기기에 저장해
 * 두고 12시간에 한 번만 새로 받는다. 오프라인이면 저장해 둔 값을 쓴다 —
 * 여행지에서 데이터가 끊겨도 정산은 보여야 한다.
 *
 * 하루 한 번 갱신되는 기준 환율이라 카드사·환전소 값과는 조금 다르다.
 * 화면이 "오늘 기준 환율"이라고 밝힌다.
 */

import type { Rates } from '@/domain/settle';

const URL = 'https://open.er-api.com/v6/latest/USD';
const KEY = 'tt.rates';
const FRESH_MS = 12 * 60 * 60 * 1000;

export const RATES_ATTRIBUTION = {
  name: 'Rates By Exchange Rate API',
  url: 'https://www.exchangerate-api.com',
};

export interface RatesResult {
  rates: Rates;
  /** 환율 기준 시각(ISO) */
  asOf: string;
}

interface Stored {
  fetchedAt: number;
  result: RatesResult;
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** 같은 순간에 여러 화면이 불러도 요청은 하나 */
let inflight: Promise<RatesResult | null> | null = null;

export function getRates(): Promise<RatesResult | null> {
  const stored = readStored();
  if (stored && Date.now() - stored.fetchedAt < FRESH_MS) return Promise.resolve(stored.result);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(URL);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as {
        result?: string;
        rates?: Record<string, number>;
        time_last_update_unix?: number;
      };
      if (body.result !== 'success' || !body.rates) throw new Error('bad response');
      const result: RatesResult = {
        rates: body.rates,
        asOf: new Date((body.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString(),
      };
      try {
        localStorage.setItem(KEY, JSON.stringify({ fetchedAt: Date.now(), result }));
      } catch {
        // 저장 못 해도 이번엔 쓴다
      }
      return result;
    } catch {
      // 네트워크·API 실패 — 오래됐어도 저장해 둔 값이 낫다. 없으면 통화별 정산으로.
      return stored?.result ?? null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
