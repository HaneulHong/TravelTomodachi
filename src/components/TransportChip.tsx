import { formatMinutes } from '@/domain/time';
import type { TransportMode } from '@/domain/types';
import { useLocale, useT } from '@/i18n';
import { CarIcon, TransitIcon, WalkIcon } from './icons';

export const MODE_ICON: Record<TransportMode, typeof WalkIcon> = {
  walk: WalkIcon,
  transit: TransitIcon,
  car: CarIcon,
};

interface Props {
  mode: TransportMode;
  minutes?: number;
  /** 사용자가 직접 입력한 값 */
  manual?: boolean;
}

export function TransportChip({ mode, minutes, manual = false }: Props) {
  const Icon = MODE_ICON[mode];
  const t = useT();
  const locale = useLocale();
  return (
    <span className={`chip chip--${mode}`}>
      <Icon />
      {t.transport[mode]}
      {minutes !== undefined && ` ${formatMinutes(minutes, locale)}`}
      {manual && ` · ${t.leg.manual}`}
    </span>
  );
}
