/**
 * 장소 입력 — 자동완성이 붙은 한 칸.
 *
 * 컴포넌트로 뺀 이유: 구간 항목(기차·버스·배편)은 출발 터미널과 도착 터미널
 * 두 곳을 받아야 한다. 화면에 같은 로직을 두 벌 두면 디바운스·경쟁 요청 처리
 * 같은 까다로운 부분이 한쪽만 고쳐지는 일이 반드시 생긴다.
 *
 * 입력칸 하나가 검색과 표시를 겸한다. 고른 뒤에도 그 자리에서 바로 고쳐 다시
 * 찾을 수 있어야 하는데, "검색"과 "선택됨" 두 모양으로 칸을 갈라 두면 고칠
 * 때마다 지우기를 먼저 눌러야 한다.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { PinIcon } from '@/components/icons';
import { canPickOnMap, MapPickSheet } from '@/components/MapPickSheet';
import { LIMITS } from '@/domain/limits';
import type { Coord } from '@/domain/types';
import { getMessages, useT } from '@/i18n';
import { getPlaceProvider, type Place } from '@/providers';

/** 입력이 멈추고 이만큼 지나야 조회한다. */
const SEARCH_DEBOUNCE_MS = 250;

interface Props {
  label: string;
  placeholder: string;
  name: string;
  coord?: Coord;
  onChange(name: string, coord?: Coord): void;
  /** 장소를 새로 골랐을 때. 제목 자동 채우기처럼 화면마다 다른 처리를 맡긴다. */
  onPicked?(place: Place): void;
  autoFocus?: boolean;
  /** 글자 수 상한 (DB와 같게 — domain/limits.ts). 검색 결과를 골라도 이만큼만 넣는다. */
  maxLength?: number;
  /**
   * 지도에서 고를 때 처음 보여 줄 곳 — 같은 날 다른 일정의 좌표 등. 마지막 것 근처에서 연다
   * (보통 바로 앞 일정이라 다음 장소도 그 근처다).
   */
  near?: Coord[];
  /** 지도에서 직접 고르기를 끈다 — 지도 고르기 화면 안의 검색칸처럼 */
  pickOnMap?: boolean;
  /** "좌표가 없어 지도에 안 뜬다" 안내. 지도 고르기 화면의 검색칸은 저장할 칸이 아니라 끈다 */
  coordHint?: boolean;
}

export function PlaceField({
  label,
  placeholder,
  name,
  coord,
  onChange,
  onPicked,
  autoFocus,
  maxLength = LIMITS.placeName,
  near,
  pickOnMap = true,
  coordHint = true,
}: Props) {
  const t = useT();
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  /** 키보드로 훑고 있는 후보. -1이면 아무것도 안 고른 상태. */
  const [active, setActive] = useState(-1);
  /** 검색이 실패한 이유. 결과 0건과 구분해서 보여줘야 원인을 알 수 있다. */
  const [searchError, setSearchError] = useState<string | null>(null);
  const places = useMemo(() => getPlaceProvider('GLOBAL'), []);
  /**
   * "더 찾기"(한글 이름 검색)를 어느 검색어로 했는지와 몇 건 나왔는지. null이면 찾는 중.
   * 같은 검색어로는 버튼을 다시 보이지 않는다 — 결과가 같고, 공개 서버에 부담만 준다.
   */
  const [more, setMore] = useState<{ q: string; count: number | null } | null>(null);
  /** 지도에서 고르는 중 (MapPickSheet) */
  const [picking, setPicking] = useState(false);
  const mapPickable = pickOnMap && canPickOnMap();

  /**
   * 직전에 고른 장소의 이름. 입력값이 여기서 벗어나면 좌표를 버린다.
   * 이름만 고치고 좌표는 남겨두면 "분짜 흐엉리엔"이라 적힌 마커가 엉뚱한
   * 곳에 찍힌다.
   */
  const pickedNameRef = useRef(name);

  /**
   * 마지막 요청만 반영한다. 검색은 비동기라 늦게 시작한 요청이 먼저 끝날 수
   * 있고, 그러면 방금 지운 글자의 결과가 화면에 남는다.
   */
  const seqRef = useRef(0);

  useEffect(() => {
    const q = name.trim();
    // 고른 장소를 그대로 두고 있을 때는 다시 찾지 않는다.
    if (q.length === 0 || q === pickedNameRef.current) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(null);
    const seq = ++seqRef.current;
    const timer = setTimeout(() => {
      void places
        .search(q, coord)
        .then((found) => {
          if (seq !== seqRef.current) return;
          setResults(found);
          setActive(-1);
          setSearching(false);
        })
        .catch((err: unknown) => {
          if (seq !== seqRef.current) return;
          // 서비스가 막혔거나 죽은 경우. "결과 없음"으로 뭉뚱그리면 검색어를
          // 계속 바꿔보게 되므로 이유를 그대로 보여준다.
          setSearchError(err instanceof Error ? err.message : getMessages().place.searchFailed);
          setResults([]);
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [name, places, coord]);

  function pick(chosen: Place): void {
    // 검색 결과 이름이 상한보다 길면 잘라 넣는다 — 안 그러면 저장할 때 DB가 거부한다
    const place = { ...chosen, name: [...chosen.name].slice(0, maxLength).join('') };
    pickedNameRef.current = place.name;
    onChange(place.name, place.coord);
    onPicked?.(place);
    setResults([]);
    setOpen(false);
    setActive(-1);

    /*
     * 좌표가 목록에 없는 프로바이더도 있다(Google은 상세 조회에서만 준다).
     * 고른 하나만 채운다 — 목록 전부를 조회하면 대부분 버리는 호출이 된다.
     * 이름은 이미 넣었으므로 좌표가 늦게 와도 화면은 먼저 반응한다.
     */
    if (place.coord) return;
    void places
      .resolve(place)
      .then((full) => {
        // 그 사이 사용자가 다른 곳을 골랐으면 덮지 않는다
        if (pickedNameRef.current !== place.name) return;
        onChange(place.name, full.coord);
      })
      .catch(() => {
        // 좌표만 못 받은 것이므로 입력을 막지는 않는다. 지도에 안 뜬다는
        // 안내는 아래 힌트가 이미 보여준다.
      });
  }

  /**
   * 지도에서 찍은 곳. 적어 둔 이름은 그대로 두고 좌표만 붙인다 — 검색에 안 나와서
   * 찍는 경우가 대부분이라 이름은 사용자가 친 게 맞다. 이름칸이 비었으면 가까운
   * 건물·거리 이름을 빌려 온다(좌표는 찍은 그대로).
   */
  async function pickedOnMap(point: Coord): Promise<void> {
    setPicking(false);
    setResults([]);
    setOpen(false);
    let label = name.trim();
    if (label.length === 0) {
      const nearest = await places.reverse?.(point).catch(() => null);
      label = nearest?.name ?? t.place.pinnedName;
    }
    label = [...label].slice(0, maxLength).join('');
    pickedNameRef.current = label;
    onChange(label, point);
    onPicked?.({ id: `pin:${point.lat},${point.lng}`, name: label, address: '', coord: point });
  }

  /** 버튼을 눌렀을 때만 — 입력할 때마다 부르면 안 되는 서비스다 (nominatimPlaceProvider.ts) */
  function findMore(): void {
    const q = name.trim();
    if (!places.searchMore || q.length === 0) return;
    const seq = ++seqRef.current;
    setMore({ q, count: null });
    setSearching(true);
    setSearchError(null);
    void places
      .searchMore(q)
      .then((found) => {
        if (seq !== seqRef.current) return;
        // 새로 찾은 것을 위에, 이미 있던 후보는 아래에
        setResults((prev) => [...found, ...prev.filter((p) => !found.some((f) => f.id === p.id))]);
        setMore({ q, count: found.length });
        setActive(-1);
        setSearching(false);
      })
      .catch((err: unknown) => {
        if (seq !== seqRef.current) return;
        setSearchError(err instanceof Error ? err.message : getMessages().place.searchFailed);
        setMore({ q, count: 0 });
        setSearching(false);
      });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // 화살표로 목록을 훑는 동안 커서가 글자 끝으로 튀지 않게 막는다
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((cur) => (cur + step + results.length) % results.length);
      return;
    }
    if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      const picked = results[active];
      if (picked) pick(picked);
      return;
    }
    if (e.key === 'Escape') setOpen(false);
  }

  const typedSomethingNew = name.trim().length > 0 && name.trim() !== pickedNameRef.current;
  const moreHere = more?.q === name.trim() ? more : null;
  const canFindMore = Boolean(places.searchMore) && typedSomethingNew && !moreHere;

  return (
    <div className="form__row">
      <span className="form__label">{label}</span>

      <div className="ac">
        <span className="ac__field">
          <input
            className="form__input"
            value={name}
            maxLength={maxLength}
            onChange={(e) => {
              // 이름을 손대는 순간 앞서 고른 좌표는 더 이상 이 이름의 좌표가
              // 아니다. 다시 고를 때까지 비워둔다.
              const next = e.target.value;
              onChange(next, next.trim() === pickedNameRef.current ? coord : undefined);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-autocomplete="list"
          />
          {mapPickable ? (
            <button
              type="button"
              className={`ac__pin ac__pinbtn${coord ? ' ac__pinbtn--on' : ''}`}
              onClick={() => setPicking(true)}
              aria-label={coord ? t.place.adjustOnMap : t.place.pickOnMap}
              title={coord ? t.place.adjustOnMap : t.place.pickOnMap}
            >
              <PinIcon size={17} />
            </button>
          ) : (
            coord && <PinIcon className="ac__pin" />
          )}
        </span>

        {open && (searching || results.length > 0 || canFindMore || moreHere || (mapPickable && typedSomethingNew)) && (
          /*
           * 목록은 흐름에서 띄운다(absolute). 흐름 안에 두면 글자를 칠 때마다
           * 아래 입력칸들이 밀려 내려가서, 시각을 넣으려고 겨눈 자리가 움직인다.
           *
           * mousedown을 막는 이유: 클릭이 완료되기 전에 blur가 먼저 일어나
           * 목록이 닫히면 선택이 통째로 무시된다.
           */
          <ul className="ac__list" onMouseDown={(e) => e.preventDefault()}>
            {searching && <li className="ac__msg">{t.place.searching}</li>}

            {!searching &&
              results.map((place, i) => (
                <li key={place.id}>
                  <button
                    // 후보 추가 시트는 <form>이다 — type이 없으면 고르는 순간 폼이 제출된다
                    type="button"
                    className={`ac__item${i === active ? ' ac__item--on' : ''}`}
                    onClick={() => pick(place)}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className="ac__name">{place.name}</span>
                    <span className="ac__addr">{place.address}</span>
                  </button>
                </li>
              ))}

            {/*
              한글로 해외 장소를 치면 대부분 여기로 온다. OSM에는 해외 지명의
              한글 표기가 거의 없어서다. 그냥 "없음"이라고만 하면 검색이 고장난
              줄 알고 같은 말을 계속 바꿔 치게 된다. 목록 안에 둔다 — 밖에 두면
              목록(더 찾기 버튼)이 덮는다.
            */}
            {!searching && !searchError && results.length === 0 && !moreHere && (
              <li className="ac__msg">{t.place.noResults}</li>
            )}
            {!searching && moreHere?.count === 0 && <li className="ac__msg">{t.place.moreNone}</li>}

            {!searching && canFindMore && (
              <li>
                <button type="button" className="ac__more" onClick={findMore}>
                  {t.place.searchMore}
                </button>
              </li>
            )}

            {/* 그래도 없으면 직접 — 검색에 안 나오는 골목 가게·숙소 입구 */}
            {!searching && mapPickable && typedSomethingNew && (
              <li>
                <button type="button" className="ac__more ac__more--map" onClick={() => setPicking(true)}>
                  {t.place.pickOnMap}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {searchError && <p className="form__hint">{searchError}</p>}

      {coordHint && name.trim().length > 0 && !coord && (
        <p className="form__hint">{t.place.noCoord}</p>
      )}
      {picking && (
        <MapPickSheet
          start={coord}
          near={near?.[near.length - 1]}
          onPick={(point) => void pickedOnMap(point)}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
