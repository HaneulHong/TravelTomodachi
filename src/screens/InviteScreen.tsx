/**
 * 초대 참가.
 *
 * 두 가지 길로 들어온다.
 *   링크  — #/invite/5G5D5UNX  (공유 버튼이 만드는 주소)
 *   직접  — #/invite           (코드를 손으로 입력)
 *
 * 링크로 들어오면 바로 참가시킨다. 코드를 이미 들고 왔는데 "참가" 버튼을
 * 한 번 더 누르게 하는 건 의미 없는 단계다.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { useTripStore } from '@/store/tripStore';

type Status = 'idle' | 'joining' | 'failed';

export function InviteScreen() {
  const { code: codeFromLink } = useParams();
  const navigate = useNavigate();
  const joinTrip = useTripStore((s) => s.joinTrip);
  const trips = useTripStore((s) => s.trips);

  const [code, setCode] = useState(codeFromLink ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  /** 링크로 들어온 자동 참가는 한 번만. 실패했는데 계속 다시 시도하면 안 된다. */
  const triedRef = useRef(false);

  const join = async (raw: string): Promise<void> => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;

    setStatus('joining');
    setError(null);
    try {
      const tripId = await joinTrip(trimmed);
      /*
       * 참가 직후 그 여행으로 보낸다. 목록으로 돌려보내면 어느 게 방금
       * 들어간 여행인지 찾아야 한다.
       * 날짜는 스토어가 새로 읽어온 것에서 꺼낸다 — joinTrip이 전체를
       * 다시 읽으므로 이 시점엔 들어와 있다.
       */
      const joined = useTripStore.getState().trips.find((t) => t.id === tripId);
      navigate(`/trip/${tripId}${joined ? `?date=${joined.startDate}` : ''}`, { replace: true });
    } catch (err: unknown) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : '참가하지 못했습니다');
    }
  };

  useEffect(() => {
    if (!codeFromLink || triedRef.current) return;
    triedRef.current = true;
    void join(codeFromLink);
    // join은 매 렌더마다 새로 만들어지지만 한 번만 돌아야 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromLink]);

  // 이미 들어가 있는 여행인지 — 코드를 다시 받은 경우를 알려주기 위해
  const alreadyIn = trips.length > 0;

  return (
    <div className="app">
      <AppHeader title="초대 참가" back />

      <main className="main main--no-tabs">
        <div className="form">
          {status === 'joining' && <p className="empty">참가하는 중…</p>}

          {status !== 'joining' && (
            <>
              <label className="form__row">
                <span className="form__label">초대 코드</span>
                <input
                  className="form__input invite__code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="예: 5G5D5UNX"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={12}
                  autoFocus={!codeFromLink}
                />
                <p className="form__hint">
                  대소문자는 가리지 않습니다. 친구에게 받은 링크를 열면 이 화면이 알아서
                  참가시킵니다.
                </p>
              </label>

              {error && <p className="form__hint form__hint--error">{error}</p>}

              <div className="form__actions">
                <button
                  className="btn btn--primary"
                  onClick={() => void join(code)}
                  disabled={code.trim().length === 0}
                >
                  참가하기
                </button>
                {alreadyIn && (
                  <button className="btn" onClick={() => navigate('/')}>
                    홈으로
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
