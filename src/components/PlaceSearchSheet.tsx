/**
 * 장소 고르기 — 검색과 지도를 한 화면에서.
 *
 * 장소 칸(PlaceField)을 누르면 전체 화면으로 열린다.
 *   위   [국내 | 해외] 전환 + 검색칸. 전환은 여행 위치로 미리 골라 둔다.
 *   가운데 지도. 검색 결과가 번호 핀으로 뜨고, 가운데 고정 핀이 "고를 위치"다.
 *   아래  고른 곳 이름 + "이 위치로" / "이름만 넣기"
 *
 * 왜 지도와 같이 두나:
 *   - 지역을 알면 그쪽 검색만 한다. 둘 다 찾아 합치면 "오사카성"에 서울 분식집이 섞였다.
 *   - 체인점·같은 이름 가게가 여럿이면 목록 글자로는 어느 지점인지 모른다. 지도에 뜨면 안다.
 *   - 검색에 없는 골목 가게는 그 자리에서 지도를 밀어 찍으면 된다.
 *
 * 가운데 고정 핀: 지도를 눌러 꽂는 방식은 폰에서 손가락이 핀을 가리고 잘못 누르기 쉽다.
 *
 * 국내는 카카오 지도, 해외는 Google 지도. 한쪽 키만 있으면 그쪽 지도로 본다.
 * 앱 위에 겹쳐 띄운다(포털) — 후보 추가 시트 안에서도 열리기 때문이다.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersDark } from '@/components/MapCanvas';
import { haversineMeters } from '@/domain/geo';
import type { Coord, Region } from '@/domain/types';
import { getMessages, useLocale, useT } from '@/i18n';
import {
  getMapRenderer,
  getPlaceProvider,
  isInKorea,
  resolveRegion,
  type MapHandle,
  type MapRenderer,
  type Place,
} from '@/providers';

/** 입력이 멈추고 이만큼 지나야 찾는다 */
const SEARCH_DEBOUNCE_MS = 300;

/** 그 지역에 처음 들어갔는데 볼 곳을 모를 때 — 서울시청 / 도쿄역 */
const DEFAULT_CENTER: Record<Region, Coord> = {
  KR: { lat: 37.5665, lng: 126.978 },
  GLOBAL: { lat: 35.6812, lng: 139.7671 },
};

/**
 * 고른 결과에서 이만큼 안쪽이면 "안 옮겼다"고 보고 결과 좌표를 그대로 쓴다.
 * 지도 가운데를 다시 읽으면 화면 픽셀 단위로 반올림돼 몇 cm씩 어긋난다.
 */
const SAME_SPOT_M = 3;

/** 이 지역을 보여 줄 지도. 그쪽 키가 없으면 다른 쪽, 둘 다 없으면 null */
function rendererFor(region: Region): MapRenderer | null {
  const kr = getMapRenderer('KR');
  const global = getMapRenderer('GLOBAL');
  const [first, second] = region === 'KR' ? [kr, global] : [global, kr];
  if (first.configured) return first;
  if (second.configured) return second;
  return null;
}

interface Props {
  /** 화면 제목 (장소 · 출발 · 도착 등) */
  title: string;
  initialName: string;
  initialCoord?: Coord;
  /** 처음 보여 줄 곳 — 같은 날 다른 일정 등. 마지막 것 근처에서 연다 */
  near?: Coord[];
  maxLength: number;
  onDone(name: string, coord: Coord | undefined, place?: Place): void;
  onClose(): void;
}

type MapStatus = 'loading' | 'ready' | 'error';

export function PlaceSearchSheet({
  title,
  initialName,
  initialCoord,
  near,
  maxLength,
  onDone,
  onClose,
}: Props) {
  const t = useT();
  const locale = useLocale();

  // 처음 볼 곳: 이미 고른 곳 → 같은 날 다른 일정 → (없으면) 한국어면 국내
  const startCoord = initialCoord ?? near?.[near.length - 1];
  const [region, setRegion] = useState<Region>(() =>
    startCoord ? resolveRegion(startCoord) : locale === 'ko' ? 'KR' : 'GLOBAL',
  );

  /** 지역마다 마지막으로 보던 곳 — 국내↔해외를 오가도 제자리로 돌아온다 */
  const viewsRef = useRef<Record<Region, { coord: Coord; closeUp: boolean }>>({
    KR:
      startCoord && isInKorea(startCoord)
        ? { coord: startCoord, closeUp: Boolean(initialCoord) }
        : { coord: nearestIn('KR', near) ?? DEFAULT_CENTER.KR, closeUp: false },
    GLOBAL:
      startCoord && !isInKorea(startCoord)
        ? { coord: startCoord, closeUp: Boolean(initialCoord) }
        : { coord: nearestIn('GLOBAL', near) ?? DEFAULT_CENTER.GLOBAL, closeUp: false },
  });

  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /** "더 찾기"(해외 한글 이름)를 어느 검색어로 했는지와 몇 건 나왔는지 */
  const [more, setMore] = useState<{ q: string; count: number | null } | null>(null);
  /** 목록에서(또는 지도 핀에서) 고른 곳. 이미 저장된 장소로 열었으면 그걸로 시작 */
  const [selected, setSelected] = useState<Place | null>(() =>
    initialCoord ? { id: 'current', name: initialName, address: '', coord: initialCoord } : null,
  );
  const [listOpen, setListOpen] = useState(!initialCoord);
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [saving, setSaving] = useState(false);

  const places = getPlaceProvider(region);
  const renderer = rendererFor(region);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MapHandle | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 마지막 검색만 반영한다 — 늦게 시작한 요청이 먼저 끝날 수 있다 */
  const seqRef = useRef(0);
  /** 새 결과가 오면 한 번 그 결과들이 다 보이게 맞춘다 */
  const fitPendingRef = useRef(false);

  const currentCenter = (): Coord =>
    handleRef.current?.getCenter?.() ?? viewsRef.current[region].coord;

  // ── 지도 띄우기. 국내↔해외로 바뀌면 새 칸(key)에 다시 ──
  const pickRef = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !renderer) {
      setMapStatus('error');
      return;
    }
    let cancelled = false;
    let handle: MapHandle | null = null;
    setMapStatus('loading');
    renderer
      .mount(el, {
        dark: prefersDark(),
        greedy: true,
        onStopClick: (id) => pickRef.current(id),
        onFailure: () => {
          if (!cancelled) setMapStatus('error');
        },
      })
      .then((h) => {
        if (cancelled) {
          h.destroy();
          return;
        }
        handle = h;
        handleRef.current = h;
        const view = viewsRef.current[region];
        h.setView?.(view.coord, view.closeUp);
        setMapStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setMapStatus('error');
      });
    return () => {
      cancelled = true;
      // 돌아왔을 때 제자리로 — 떠나기 전 위치를 적어 둔다
      const c = handle?.getCenter?.();
      if (c) viewsRef.current[region] = { coord: c, closeUp: viewsRef.current[region].closeUp };
      handle?.destroy();
      handleRef.current = null;
    };
    // region이 바뀌면 renderer도 바뀐다(같은 지도로 떨어지는 경우까지 다시 띄운다)
  }, [renderer, region]);

  // ── 검색 ──
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    // 고른 곳 이름 그대로면 다시 찾지 않는다 — 다른 결과 핀은 남겨 두어 견줘 볼 수 있게
    if (selected && q === selected.name) {
      seqRef.current++;
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const seq = ++seqRef.current;
    const timer = setTimeout(() => {
      void places
        .search(q, currentCenter())
        .then((found) => {
          if (seq !== seqRef.current) return;
          setResults(found);
          fitPendingRef.current = true;
          setSearching(false);
        })
        .catch((err: unknown) => {
          if (seq !== seqRef.current) return;
          setSearchError(err instanceof Error ? err.message : getMessages().place.searchFailed);
          setResults([]);
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // currentCenter는 부를 때의 지도 위치를 읽는다 — 의존성에 넣으면 지도를 밀 때마다 다시 찾는다
  }, [query, places, selected]);

  // ── 결과를 지도에 번호 핀으로. 고른 곳은 가운데 핀이 대신한다 ──
  useEffect(() => {
    const h = handleRef.current;
    if (!h || mapStatus !== 'ready') return;
    const stops = results
      .map((p, i) => ({ p, label: String(i + 1) }))
      .filter(({ p }) => p.coord && p.id !== selected?.id)
      .map(({ p, label }) => ({ id: p.id, coord: p.coord!, label, title: p.name }));
    h.setStops(stops);
    if (fitPendingRef.current && stops.length > 0 && !selected) {
      fitPendingRef.current = false;
      h.fit();
    }
  }, [results, selected, mapStatus]);

  function pick(place: Place): void {
    if (!place.coord) return;
    setSelected(place);
    setQuery(place.name);
    setListOpen(false);
    inputRef.current?.blur(); // 키보드를 내려 지도가 보이게
    viewsRef.current[region] = { coord: place.coord, closeUp: true };
    handleRef.current?.setView?.(place.coord, true);
  }
  pickRef.current = (id: string) => {
    const place = results.find((p) => p.id === id);
    if (place) pick(place);
  };

  function switchRegion(next: Region): void {
    if (next === region) return;
    setRegion(next);
    setResults([]);
    setMore(null);
    // 다른 지역에서 고른 곳은 놓는다 — 이름은 검색칸에 남아 그 지역에서 다시 찾는다
    if (selected?.coord && isInKorea(selected.coord) !== (next === 'KR')) setSelected(null);
  }

  function findMore(): void {
    const q = query.trim();
    if (!places.searchMore || q.length === 0) return;
    const seq = ++seqRef.current;
    setMore({ q, count: null });
    setSearching(true);
    setSearchError(null);
    void places
      .searchMore(q)
      .then((found) => {
        if (seq !== seqRef.current) return;
        setResults((prev) => [...found, ...prev.filter((p) => !found.some((f) => f.id === p.id))]);
        fitPendingRef.current = true;
        setMore({ q, count: found.length });
        setSearching(false);
      })
      .catch((err: unknown) => {
        if (seq !== seqRef.current) return;
        setSearchError(err instanceof Error ? err.message : getMessages().place.searchFailed);
        setMore({ q, count: 0 });
        setSearching(false);
      });
  }

  const clip = (s: string): string => [...s.trim()].slice(0, maxLength).join('');

  /** 가운데 핀 위치로 정한다 */
  async function confirm(): Promise<void> {
    const center = handleRef.current?.getCenter?.();
    if (!center) return;
    // 고른 결과에서 안 옮겼으면 결과 좌표 그대로, 옮겼으면 옮긴 자리(이름은 그대로)
    if (selected?.coord) {
      const same = haversineMeters(center, selected.coord) < SAME_SPOT_M;
      const coord = same ? selected.coord : center;
      onDone(clip(selected.name), coord, { ...selected, coord });
      return;
    }
    // 검색에 없는 곳 — 친 이름 그대로, 비었으면 가까운 건물·거리 이름을 빌린다
    let name = query.trim();
    if (name.length === 0) {
      setSaving(true);
      const nearest = await places.reverse?.(center).catch(() => null);
      name = nearest?.name ?? t.place.pinnedName;
    }
    const label = clip(name);
    onDone(label, center, { id: `pin:${center.lat},${center.lng}`, name: label, address: '', coord: center });
  }

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

  const q = query.trim();
  const moreHere = more?.q === q ? more : null;
  const typedNew = q.length > 0 && !(selected && q === selected.name);
  const canFindMore = Boolean(places.searchMore) && typedNew && !moreHere;
  const showList = listOpen && typedNew;

  return createPortal(
    <div className="psearch" role="dialog" aria-modal="true" aria-label={title}>
      <header className="header">
        <button type="button" className="header__action" onClick={onClose}>
          {t.common.cancel}
        </button>
        <h2 className="header__title">{title}</h2>
        <span />
      </header>

      <div className="psearch__top">
        <div className="seg psearch__region" role="tablist" aria-label={t.placeSearch.region}>
          {(['KR', 'GLOBAL'] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={region === r}
              className={`seg__btn${region === r ? ' seg__btn--on' : ''}`}
              onClick={() => switchRegion(r)}
            >
              {r === 'KR' ? t.placeSearch.domestic : t.placeSearch.overseas}
            </button>
          ))}
        </div>
        <input
          ref={inputRef}
          className="form__input"
          value={query}
          maxLength={maxLength}
          placeholder={
            region === 'KR' ? t.placeSearch.domesticPlaceholder : t.placeSearch.overseasPlaceholder
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setListOpen(true);
          }}
          onFocus={() => setListOpen(true)}
          onBlur={() => setListOpen(false)}
          enterKeyHint="search"
          aria-label={title}
        />
      </div>

      <div className="psearch__map">
        <div key={`${region}-${renderer?.id ?? 'none'}`} ref={containerRef} className="psearch__canvas" />
        {mapStatus === 'ready' && (
          // 지도 가운데 — 핀 끝이 정확히 가운데에 오게 아래쪽을 맞춘다 (styles.css)
          <span className="psearch__pin" aria-hidden="true">
            <svg width="34" height="44" viewBox="0 0 34 44">
              <path
                d="M17 43s15-13.2 15-25.5C32 8.4 25.3 2 17 2S2 8.4 2 17.5C2 29.8 17 43 17 43z"
                className="psearch__pin-body"
              />
              <circle cx="17" cy="17" r="5.5" className="psearch__pin-hole" />
            </svg>
          </span>
        )}
        {mapStatus === 'loading' && <p className="psearch__msg">{t.common.loading}</p>}
        {mapStatus === 'error' && <p className="psearch__msg">{t.placeSearch.mapUnavailable}</p>}

        {showList && (
          /*
           * 목록은 지도 위에 겹친다. 지도 칸 크기를 바꾸면 카카오 지도가 타일을 다시
           * 맞추지 못해 비어 보인다. mousedown을 막아야 누르는 사이 검색칸이 blur되어
           * 목록이 먼저 닫히지 않는다.
           */
          <ul className="psearch__list" onMouseDown={(e) => e.preventDefault()}>
            {searching && <li className="psearch__msg-row">{t.place.searching}</li>}
            {!searching &&
              results.map((place, i) => (
                <li key={place.id}>
                  <button type="button" className="psearch__item" onClick={() => pick(place)}>
                    <span className="psearch__num">{i + 1}</span>
                    <span className="psearch__text">
                      <span className="psearch__name">{place.name}</span>
                      <span className="psearch__addr">{place.address}</span>
                    </span>
                  </button>
                </li>
              ))}
            {!searching && searchError && <li className="psearch__msg-row">{searchError}</li>}
            {!searching && !searchError && results.length === 0 && !moreHere && (
              <li className="psearch__msg-row">
                {region === 'KR' ? t.placeSearch.noResultsKr : t.placeSearch.noResultsGlobal}
              </li>
            )}
            {!searching && moreHere?.count === 0 && (
              <li className="psearch__msg-row">{t.place.moreNone}</li>
            )}
            {!searching && canFindMore && (
              <li>
                <button type="button" className="psearch__more" onClick={findMore}>
                  {t.place.searchMore}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="psearch__foot">
        <p className="psearch__picked">
          {selected ? (
            <>
              <b>{selected.name}</b>
              {selected.address && <span> · {selected.address}</span>}
            </>
          ) : (
            t.placeSearch.hint
          )}
        </p>
        <button
          type="button"
          className="btn btn--primary"
          disabled={mapStatus !== 'ready' || saving}
          onClick={() => void confirm()}
        >
          {saving ? t.common.processing : t.placeSearch.confirm}
        </button>
        {q.length > 0 && (
          // 장소가 아닌 일정(예: "체크인", "자유 시간")이나 위치를 모르는 곳
          <button
            type="button"
            className="psearch__nameonly"
            onClick={() => onDone(clip(query), undefined)}
          >
            {t.placeSearch.nameOnly}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** 이 지역에 속한 좌표 중 마지막 것 (보통 바로 앞 일정) */
function nearestIn(region: Region, coords?: Coord[]): Coord | undefined {
  if (!coords) return undefined;
  for (let i = coords.length - 1; i >= 0; i--) {
    const c = coords[i]!;
    if (isInKorea(c) === (region === 'KR')) return c;
  }
  return undefined;
}
