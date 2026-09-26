/**
 * 지도에서 위치를 직접 고른다 — 검색에 안 나오는 가게·골목·숙소 입구.
 *
 * 지도를 움직여 가운데 고정된 핀에 맞추는 방식이다. 지도를 눌러 핀을 꽂는 방식은
 * 폰에서 손가락이 핀을 가려 어디에 꽂히는지 보이지 않고, 끌어서 움직이다 잘못
 * 누르면 엉뚱한 곳에 꽂힌다. 가운데 핀은 손가락을 떼고 확인한 뒤 누르면 된다.
 *
 * 국내면 카카오, 해외면 Google — 보고 있는 곳(검색으로 옮긴 곳)에 따라 바꾼다.
 * 한쪽 키만 있으면 그쪽 지도로 전부 본다(Google은 국내도 그린다, 덜 자세할 뿐).
 *
 * 앱 위에 겹쳐 띄운다(포털). 후보 추가 시트 안에서도 열리기 때문이다.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersDark } from '@/components/MapCanvas';
import { PlaceField } from '@/components/PlaceField';
import type { Coord } from '@/domain/types';
import { useT } from '@/i18n';
import { getMapRenderer, isInKorea, type MapHandle, type MapRenderer } from '@/providers';

/** 시작점을 모를 때 — 서울시청 */
const DEFAULT_CENTER: Coord = { lat: 37.5665, lng: 126.978 };

/** 보고 있는 곳에 맞는 지도. 그쪽 키가 없으면 다른 쪽, 둘 다 없으면 null */
function rendererFor(coord: Coord): MapRenderer | null {
  const kr = getMapRenderer('KR');
  const global = getMapRenderer('GLOBAL');
  const [first, second] = isInKorea(coord) ? [kr, global] : [global, kr];
  if (first.configured) return first;
  if (second.configured) return second;
  return null;
}

/** 지도에서 고를 수 있는지 — 실제 지도가 하나라도 있어야 한다(개략도로는 못 고른다) */
export function canPickOnMap(): boolean {
  return getMapRenderer('KR').configured || getMapRenderer('GLOBAL').configured;
}

interface Props {
  /** 이미 고른 좌표 — 있으면 그 자리에서 가까이 시작한다 */
  start?: Coord;
  /** 없으면 여기 근처에서 (같은 날 다른 일정 등) */
  near?: Coord;
  onPick(coord: Coord): void;
  onClose(): void;
}

type Status = 'loading' | 'ready' | 'error';

export function MapPickSheet({ start, near, onPick, onClose }: Props) {
  const t = useT();
  const [view, setView] = useState<{ coord: Coord; closeUp: boolean }>(() => ({
    coord: start ?? near ?? DEFAULT_CENTER,
    closeUp: Boolean(start),
  }));
  const [query, setQuery] = useState('');
  // 검색칸이 고른 곳 — 칸 오른쪽에 핀 표시
  const [queryCoord, setQueryCoord] = useState<Coord | undefined>();
  const [status, setStatus] = useState<Status>('loading');

  const renderer = rendererFor(view.coord);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MapHandle | null>(null);
  // 지도가 바뀌어 새로 뜰 때 어디를 보여 줄지 — effect 안에서 최신 값을 읽는다
  const viewRef = useRef(view);
  viewRef.current = view;

  // 지도를 띄운다. 국내↔해외로 지도가 바뀌면 새 칸(key)에 다시 띄운다
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !renderer) {
      setStatus('error');
      return;
    }
    let cancelled = false;
    let handle: MapHandle | null = null;
    setStatus('loading');
    renderer
      .mount(el, {
        dark: prefersDark(),
        greedy: true,
        onFailure: () => {
          if (!cancelled) setStatus('error');
        },
      })
      .then((h) => {
        if (cancelled) {
          h.destroy();
          return;
        }
        handle = h;
        handleRef.current = h;
        h.setView?.(viewRef.current.coord, viewRef.current.closeUp);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
      handle?.destroy();
      handleRef.current = null;
    };
  }, [renderer]);

  // 검색으로 다른 곳을 고르면 그리로 옮긴다
  useEffect(() => {
    handleRef.current?.setView?.(view.coord, view.closeUp);
  }, [view]);

  // 뒤 화면이 같이 스크롤되지 않게, Esc로 닫기
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const confirm = (): void => {
    const center = handleRef.current?.getCenter?.();
    if (center) onPick(center);
  };

  return createPortal(
    <div className="mappick" role="dialog" aria-modal="true" aria-label={t.mapPick.title}>
      <header className="header">
        <button type="button" className="header__action" onClick={onClose}>
          {t.common.cancel}
        </button>
        <h2 className="header__title">{t.mapPick.title}</h2>
        <span />
      </header>

      <div className="mappick__search">
        <PlaceField
          label={t.mapPick.search}
          placeholder={t.mapPick.searchPlaceholder}
          name={query}
          coord={queryCoord}
          onChange={(next, c) => {
            setQuery(next);
            setQueryCoord(c);
          }}
          onPicked={(place) => {
            if (place.coord) setView({ coord: place.coord, closeUp: true });
          }}
          pickOnMap={false}
          coordHint={false}
        />
      </div>

      <div className="mappick__map">
        <div key={renderer?.id ?? 'none'} ref={containerRef} className="mappick__canvas" />
        {status === 'ready' && (
          // 지도 가운데 — 핀 끝이 정확히 가운데에 오게 아래쪽을 맞춘다 (styles.css)
          <span className="mappick__pin" aria-hidden="true">
            <svg width="34" height="44" viewBox="0 0 34 44">
              <path
                d="M17 43s15-13.2 15-25.5C32 8.4 25.3 2 17 2S2 8.4 2 17.5C2 29.8 17 43 17 43z"
                className="mappick__pin-body"
              />
              <circle cx="17" cy="17" r="5.5" className="mappick__pin-hole" />
            </svg>
          </span>
        )}
        {status === 'loading' && <p className="mappick__msg">{t.common.loading}</p>}
        {status === 'error' && <p className="mappick__msg">{t.mapPick.unavailable}</p>}
      </div>

      <div className="mappick__foot">
        <p className="mappick__hint">{t.mapPick.hint}</p>
        <button
          type="button"
          className="btn btn--primary"
          disabled={status !== 'ready'}
          onClick={confirm}
        >
          {t.mapPick.confirm}
        </button>
      </div>
    </div>,
    document.body,
  );
}
