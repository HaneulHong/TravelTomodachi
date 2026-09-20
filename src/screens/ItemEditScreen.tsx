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

  // ── 장소 검색 ────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const places = useMemo(() => getPlaceProvider('GLOBAL'), []);

  /**
   * 마지막 요청만 반영한다. 검색은 비동기라 늦게 시작한 요청이 먼저 끝날 수
   * 있고, 그러면 방금 지운 글자의 결과가 화면에 남는다.
   */
  const seqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
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
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, places, coord]);

  function pickPlace(place: Place): void {
    setPlaceName(place.name);
    setCoord(place.coord);
    // 제목이 비어 있을 때만 장소 이름으로 채운다. 이미 적어둔 제목
    // ("점심 · 분짜" 같은)을 장소 이름으로 덮으면 안 된다.
    if (title.trim().length === 0) setTitle(place.name);
    setQuery('');
    setResults([]);
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

            {placeName ? (
              <div className="picked">
                <span className="picked__name">
                  <PinIcon /> {placeName}
                </span>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setPlaceName('');
                    setCoord(undefined);
                  }}
                >
                  지우기
                </button>
              </div>
            ) : (
              <input
                className="form__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="장소 검색 (예: 호안끼엠)"
              />
            )}

            {!placeName && searching && <p className="form__hint">찾는 중…</p>}

            {!placeName && !searching && results.length > 0 && (
              <ul className="places">
                {results.map((place) => (
                  <li key={place.id}>
                    <button className="places__item" onClick={() => pickPlace(place)}>
                      <span className="places__name">{place.name}</span>
                      <span className="places__addr">{place.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!placeName && !searching && query.trim().length > 0 && results.length === 0 && (
              <p className="form__hint">결과가 없습니다. 제목만 적어도 됩니다.</p>
            )}

            {/*
              좌표가 없으면 지도에 마커가 생기지 않는다. 저장은 되지만 지도
              탭에서 안 보이는 이유를 여기서 미리 알려준다.
            */}
            {placeName && !coord && (
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
