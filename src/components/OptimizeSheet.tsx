/**
 * 동선 최적화 제안. 계산은 domain/optimize.ts.
 *
 * 바로 바꾸지 않고 보여 준 뒤 사람이 고른다 — 직선거리 기준이라 강·바다를 돌아가는
 * 길에서는 틀릴 수 있고, 일부러 정한 순서(해 질 녘 전망대)는 앱이 모른다.
 */

import { useMemo } from 'react';
import { MenuSheet } from '@/components/MenuSheet';
import { formatDistance } from '@/domain/geo';
import { optimizeDay } from '@/domain/optimize';
import { timeConflicts } from '@/domain/order';
import type { Item } from '@/domain/types';
import { useT } from '@/i18n';

interface Props {
  items: Item[];
  onApply(order: string[]): void;
  onClose(): void;
}

/** 이 정도는 줄어야 제안할 가치가 있다 — 몇십 미터 차이로 순서를 뒤섞지 않는다 */
const MIN_GAIN = 0.05;

export function OptimizeSheet({ items, onApply, onClose }: Props) {
  const t = useT();
  const result = useMemo(() => optimizeDay(items), [items]);
  const gain = result.before > 0 ? (result.before - result.after) / result.before : 0;
  const worth = gain >= MIN_GAIN;
  const byId = new Map(items.map((i) => [i.id, i]));
  // 거리만 보고 정해서 적어 둔 시각과 어긋날 수 있다 — 적용 전에 알린다
  const breaksTimes = timeConflicts(result.order.map((id) => byId.get(id)?.localTime)).some(Boolean);

  return (
    <MenuSheet open onClose={onClose} label={t.optimize.title}>
      <div className="form confirm">
        <div className="confirm__title">{t.optimize.title}</div>

        {worth ? (
          <>
            <div className="confirm__body">
              <p>
                <strong>
                  {t.optimize.distance(formatDistance(result.before), formatDistance(result.after))}
                </strong>
                <br />
                {t.optimize.saving(Math.round(gain * 100))}
              </p>
              <ol className="optimize-list">
                {result.order.map((id, i) => {
                  const item = byId.get(id)!;
                  const moved = items[i]?.id !== id;
                  return (
                    <li key={id} className={moved ? 'optimize-list__moved' : undefined}>
                      <span className="optimize-list__title">{item.title}</span>
                      {item.localTime && <span className="optimize-list__time">{item.localTime}</span>}
                      {moved && <span className="chip chip--accent">{t.optimize.moved}</span>}
                    </li>
                  );
                })}
              </ol>
              {breaksTimes && <p className="form__hint form__hint--warn">{t.optimize.timesOff}</p>}
              <p className="form__hint">{t.optimize.note}</p>
            </div>
            <div className="form__actions">
              <button className="btn btn--primary" onClick={() => onApply(result.order)}>
                {t.optimize.apply}
              </button>
              <button className="btn" onClick={onClose}>
                {t.common.cancel}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="confirm__body">
              <p>{t.optimize.noGain}</p>
              <p className="form__hint">{t.optimize.note}</p>
            </div>
            <div className="form__actions">
              <button className="btn" onClick={onClose}>
                {t.optimize.close}
              </button>
            </div>
          </>
        )}
      </div>
    </MenuSheet>
  );
}
