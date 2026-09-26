/**
 * 장소 칸 — 누르면 검색·지도 화면(PlaceSearchSheet)이 열린다.
 *
 * 칸 자체에서 타이핑하지 않는 이유: 검색 결과를 지도로 봐야 어느 지점인지 알 수 있고,
 * 국내·해외를 골라야 엉뚱한 결과가 안 섞인다. 좁은 칸 아래 목록으로는 둘 다 안 된다.
 *
 * 컴포넌트로 뺀 이유: 구간 항목(기차·버스·배편)은 출발·도착 두 곳을 받고,
 * 후보 장소도 같은 칸을 쓴다.
 */

import { useState } from 'react';
import { PinIcon } from '@/components/icons';
import { PlaceSearchSheet } from '@/components/PlaceSearchSheet';
import { LIMITS } from '@/domain/limits';
import type { Coord } from '@/domain/types';
import { useT } from '@/i18n';
import type { Place } from '@/providers';

interface Props {
  label: string;
  placeholder: string;
  name: string;
  coord?: Coord;
  onChange(name: string, coord?: Coord): void;
  /** 장소를 새로 정했을 때. 제목 자동 채우기처럼 화면마다 다른 처리를 맡긴다. */
  onPicked?(place: Place): void;
  /** 글자 수 상한 (DB와 같게 — domain/limits.ts). 검색 결과를 골라도 이만큼만 넣는다. */
  maxLength?: number;
  /**
   * 검색 화면에서 처음 보여 줄 곳 — 같은 날 다른 일정의 좌표 등. 마지막 것 근처에서 열고,
   * 국내·해외도 이걸로 미리 고른다.
   */
  near?: Coord[];
}

export function PlaceField({
  label,
  placeholder,
  name,
  coord,
  onChange,
  onPicked,
  maxLength = LIMITS.placeName,
  near,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const filled = name.trim().length > 0;

  return (
    <div className="form__row">
      <span className="form__label">{label}</span>

      <div className="placefield">
        <button
          type="button"
          className={`form__input placefield__btn${filled ? '' : ' placefield__btn--empty'}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={filled ? `${label}: ${name}` : label}
        >
          <PinIcon size={15} className={`placefield__pin${coord ? ' placefield__pin--on' : ''}`} />
          <span className="placefield__text">{filled ? name : placeholder}</span>
        </button>
        {filled && (
          <button
            type="button"
            className="placefield__clear"
            onClick={() => onChange('', undefined)}
            aria-label={t.placeSearch.clear}
          >
            ×
          </button>
        )}
      </div>

      {filled && !coord && <p className="form__hint">{t.place.noCoord}</p>}

      {open && (
        <PlaceSearchSheet
          title={label}
          initialName={name}
          initialCoord={coord}
          near={near}
          maxLength={maxLength}
          onClose={() => setOpen(false)}
          onDone={(nextName, nextCoord, place) => {
            setOpen(false);
            onChange(nextName, nextCoord);
            if (nextName.length > 0) onPicked?.(place ?? { id: 'name', name: nextName, address: '' });
          }}
        />
      )}
    </div>
  );
}
