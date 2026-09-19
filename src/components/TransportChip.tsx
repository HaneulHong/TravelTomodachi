import { formatMinutes } from '@/domain/time';
import { TRANSPORT_LABEL, type TransportMode } from '@/domain/types';
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
  return (
    <span className={`chip chip--${mode}`}>
      <Icon />
      {TRANSPORT_LABEL[mode]}
      {minutes !== undefined && ` ${formatMinutes(minutes)}`}
      {manual && ' · 직접 입력'}
    </span>
  );
}
