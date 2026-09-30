/**
 * 여행이 하나도 없을 때의 첫 카드 — 홈, 그리고 일정·지도 탭의 빈 화면.
 *
 * 빈 화면에 "없습니다" 한 줄만 두면 처음 온 사람은 무엇부터 할지 모른다.
 * 무엇을 하는 앱인지 한 줄, 할 수 있는 두 가지(만들기·참가)를 크게 둔다.
 */

import { useNavigate } from 'react-router-dom';
import { useT } from '@/i18n';
import { PlusIcon } from './icons';

interface Props {
  title: string;
  body: string;
  /** 만들기 → 초대 → 같이 채우기 세 단계를 보여줄지 (홈에서만) */
  steps?: boolean;
}

export function StartCard({ title, body, steps = false }: Props) {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="start-card">
      <span className="start-card__mark" aria-hidden>
        🧳
      </span>
      <h2 className="start-card__title">{title}</h2>
      <p className="start-card__body">{body}</p>

      {steps && (
        <ol className="start-card__steps">
          <li>{t.start.step1}</li>
          <li>{t.start.step2}</li>
          <li>{t.start.step3}</li>
        </ol>
      )}

      <div className="start-card__actions">
        <button className="btn btn--primary" onClick={() => navigate('/trip/new')}>
          <PlusIcon size={16} /> {t.home.newTrip}
        </button>
        {/* 친구에게 코드만 전해 들은 경우. 링크로 오면 이 화면을 거치지 않는다 */}
        <button className="btn" onClick={() => navigate('/invite')}>
          {t.home.joinByCode}
        </button>
      </div>
    </div>
  );
}
