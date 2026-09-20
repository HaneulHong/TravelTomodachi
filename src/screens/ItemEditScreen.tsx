/**
 * 일정 추가 · 수정.
 *
 * 한 화면이 두 가지를 다 맡는다. 만들 때와 고칠 때 입력 항목이 같은데
 * 화면을 나누면 폼이 두 벌이 되고, 한쪽만 고치는 실수가 반드시 생긴다.
 * 구분은 URL이 한다 — itemId가 없으면 추가, 있으면 수정.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { PinIcon } from '@/components/icons';
import { ITEM_KIND_LABEL, type Coord, type ItemKind } from '@/domain/types';
import { getPlaceProvider, type Place } from '@/providers';
import { useTripStore } from '@/store/tripStore';

const KINDS: ItemKind[] = ['place', 'flight', 'train'];

/** 장소 검색 입력이 멈추고 이만큼 지나야 조회한다. */
const SEARCH_DEBOUNCE_MS = 250;

export function ItemEditScreen() {
  const { tripId = '', itemId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const trip = useTripStore((s) => s.getTrip(tripId));
  const existing = useTripStore((s) => (itemId ? s.getItem(itemId) : undefined));
  const addItem = useTripStore((s) => s.addItem);
  const updateItem = useTripStore((s) => s.updateItem);
  const removeItem = useTripStore((s) => s.removeItem);

  const isEdit = Boolean(itemId);
  // 추가일 때 어느 날짜에 넣을지는 쿼리로 받는다. 수정이면 항목이 이미 안다.
  const date = existing?.date ?? params.get('date') ?? trip?.startDate ?? '';

  const [kind, setKind] = useState<ItemKind>(existing?.kind ?? 'place');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [placeName, setPlaceName] = useState(existing?.placeName ?? '');
  const [coord, setCoord] = useState<Coord | undefined>(existing?.coord);
  const [localTime, setLocalTime] = useState(existing?.localTime ?? '');
  const [duration, setDuration] = useState(
    existing?.durationMin !== undefined ? String(existing.durationMin) : '',
  );
  const [carrierCode, setCarrierCode] = useState(existing?.carrierCode ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');

  // ── 장소 자동완성 ────────────────────────────────────────────────
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  /** 키보드로 훑고 있는 후보. -1이면 아무것도 안 고른 상태. */
  const [active, setActive] = useState(-1);
  const places = useMemo(() => getPlaceProvider('GLOBAL'), []);

  /**
   * 직전에 고른 장소의 이름. 입력값이 여기서 벗어나면 좌표를 버린다.
   * 이름만 고치고 좌표는 남겨두면 "분짜 흐엉리엔"이라 적힌 마커가 엉뚱한
   * 곳에 찍힌다.
   */
  const pickedNameRef = useRef(existing?.placeName ?? '');

  /**
   * 마지막 요청만 반영한다. 검색은 비동기라 늦게 시작한 요청이 먼저 끝날 수
   * 있고, 그러면 방금 지운 글자의 결과가 화면에 남는다.
   */
  const seqRef = useRef(0);

  useEffect(() => {
    const q = placeName.trim();
    // 고른 장소를 그대로 두고 있을 때는 다시 찾지 않는다.
    if (q.length === 0 || q === pickedNameRef.current) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const seq = ++seqRef.current;
    const timer = setTimeout(() => {
      void places.search(q, coord).then((found) => {
        if (seq !== seqRef.current) return;
        setResults(found);
        setActive(-1);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [placeName, places, coord]);

  function pickPlace(place: Place): void {
    pickedNameRef.current = place.name;
    setPlaceName(place.name);
    setCoord(place.coord);
    // 제목이 비어 있을 때만 장소 이름으로 채운다. 이미 적어둔 제목
    // ("점심 · 분짜" 같은)을 장소 이름으로 덮으면 안 된다.
    if (title.trim().length === 0) setTitle(place.name);
    setResults([]);
    setOpen(false);
    setActive(-1);
  }

  function onPlaceKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
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
      if (picked) pickPlace(picked);
      return;
    }
    if (e.key === 'Escape') setOpen(false);
  }

  if (!trip) {
    return (
      <div className="app">
        <AppHeader title="일정" back />
        <main className="main main--no-tabs">
          <p className="empty">여행을 찾을 수 없습니다.</p>
        </main>
      </div>
    );
  }

  if (isEdit && !existing) {
    return (
      <div className="app">
        <AppHeader title="일정 수정" back />
        <main className="main main--no-tabs">
          <p className="empty">항목을 찾을 수 없습니다.</p>
        </main>
      </div>
    );
  }

  const canSave = title.trim().length > 0;

  const save = (): void => {
    if (!canSave) return;

    const minutes = duration.trim() === '' ? undefined : Number(duration);
    const patch = {
      kind,
      title: title.trim(),
      placeName: placeName.trim() || undefined,
      coord,
      localTime: localTime || undefined,
      durationMin: Number.isFinite(minutes) ? minutes : undefined,
      description: description.trim() || undefined,
      // 편명은 항공·기차일 때만 의미가 있다. 종류를 장소로 되돌렸는데 값이
      // 남아 있으면 화면에 엉뚱한 배지가 뜬다.
      carrierCode: kind === 'place' ? undefined : carrierCode.trim() || undefined,
    };

    if (isEdit && itemId) {
      updateItem(itemId, patch);
      navigate(-1);
      return;
    }

    const id = addItem(trip.id, date, patch);
    // 추가 직후에는 방금 만든 항목을 보여준다. 목록으로 되돌리면 어디에
    // 들어갔는지 확인하러 다시 들어가야 한다.
    navigate(`/trip/${trip.id}/item/${id}`, { replace: true });
  };

  const destroy = (): void => {
    if (!itemId) return;
    removeItem(itemId);
    // 상세 화면은 이미 사라진 항목을 가리키므로 목록까지 되돌린다.
    navigate(`/trip/${trip.id}?date=${date}`, { replace: true });
  };

  return (
    <div className="app">
      <AppHeader
        title={isEdit ? '일정 수정' : '일정 추가'}
        back
        action={{ label: '저장', onClick: save, disabled: !canSave }}
      />

      <main className="main main--no-tabs">
        <div className="form">
          <div className="form__row">
            <span className="form__label">종류</span>
            <div className="seg">
              {KINDS.map((k) => (
                <button
                  key={k}
                  className={`seg__btn${k === kind ? ' seg__btn--on' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {ITEM_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <label className="form__row">
            <span className="form__label">제목</span>
            <input
              className="form__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 점심 · 분짜"
              autoFocus={!isEdit}
            />
          </label>

          <div className="form__row">
            <span className="form__label">장소</span>

            {/*
              입력칸 하나로 검색과 표시를 겸한다. 고른 뒤에도 그 자리에서
              바로 고쳐 다시 찾을 수 있어야 하는데, 칸을 "검색"과 "선택됨"
              두 모양으로 갈라 두면 고칠 때마다 지우기를 눌러야 한다.
            */}
            <div className="ac">
              <span className="ac__field">
                <input
                  className="form__input"
                  value={placeName}
                  onChange={(e) => {
                    setPlaceName(e.target.value);
                    // 이름을 손대는 순간 앞서 고른 좌표는 더 이상 이 이름의
                    // 좌표가 아니다. 다시 고를 때까지 비워둔다.
                    if (e.target.value.trim() !== pickedNameRef.current) setCoord(undefined);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => setOpen(false)}
                  onKeyDown={onPlaceKeyDown}
                  placeholder="장소 검색 (예: 호안끼엠)"
                  role="combobox"
                  aria-expanded={open && results.length > 0}
                  aria-autocomplete="list"
                />
                {coord && <PinIcon className="ac__pin" />}
              </span>

              {open && (searching || results.length > 0) && (
                /*
                 * 목록은 흐름에서 띄운다(absolute). 흐름 안에 두면 글자를
                 * 칠 때마다 아래 입력칸들이 밀려 내려가서, 시각을 넣으려고
                 * 겨눈 자리가 움직인다.
                 *
                 * mousedown을 막는 이유: 클릭이 완료되기 전에 blur가 먼저
                 * 일어나 목록이 닫히면 선택이 통째로 무시된다.
                 */
                <ul className="ac__list" onMouseDown={(e) => e.preventDefault()}>
                  {searching && <li className="ac__msg">찾는 중…</li>}

                  {!searching &&
                    results.map((place, i) => (
                      <li key={place.id}>
                        <button
                          className={`ac__item${i === active ? ' ac__item--on' : ''}`}
                          onClick={() => pickPlace(place)}
                          onMouseEnter={() => setActive(i)}
                        >
                          <span className="ac__name">{place.name}</span>
                          <span className="ac__addr">{place.address}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {!searching &&
              open &&
              results.length === 0 &&
              placeName.trim().length > 0 &&
              placeName.trim() !== pickedNameRef.current && (
                <p className="form__hint">
                  후보가 없습니다. 지금 장소 검색은 목(mock) 데이터라 등록된 11곳만 찾습니다.
                </p>
              )}

            {/*
              좌표가 없으면 지도에 마커가 생기지 않는다. 저장은 되지만 지도
              탭에서 안 보이는 이유를 여기서 미리 알려준다.
            */}
            {placeName.trim().length > 0 && !coord && (
              <p className="form__hint">좌표가 없어 지도에는 표시되지 않습니다.</p>
            )}
          </div>

          <div className="form__pair">
            <label className="form__row">
              <span className="form__label">시각</span>
              <input
                className="form__input"
                type="time"
                value={localTime}
                onChange={(e) => setLocalTime(e.target.value)}
              />
            </label>

            <label className="form__row">
              <span className="form__label">머무는 시간</span>
              <span className="form__suffixed">
                <input
                  className="form__input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="60"
                />
                <span className="form__suffix">분</span>
              </span>
            </label>
          </div>

          {kind !== 'place' && (
            <label className="form__row">
              <span className="form__label">{kind === 'flight' ? '편명' : '열차편'}</span>
              <input
                className="form__input"
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                placeholder={kind === 'flight' ? '예: KE1201' : '예: KTX 101'}
              />
            </label>
          )}

          <label className="form__row">
            <span className="form__label">메모</span>
            <textarea
              className="form__input form__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="예약 번호, 준비물, 주의할 점…"
            />
          </label>

          <div className="form__actions">
            <button className="btn btn--primary" onClick={save} disabled={!canSave}>
              {isEdit ? '저장' : '추가'}
            </button>

            {isEdit && (
              <button className="btn btn--danger" onClick={destroy}>
                삭제
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
