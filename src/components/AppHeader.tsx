import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu, UserIcon } from './icons';

interface Props {
  title: string;
  /** 뒤로가기 버튼 표시 (스케치의 '<') */
  back?: boolean;
  /** 메뉴 버튼 표시 (스케치의 '≡') */
  onMenu?: () => void;
  /**
   * 오른쪽 텍스트 버튼 (예: 수정 · 저장).
   * 자리를 메뉴 버튼과 공유하므로 onMenu와 같이 쓰지 않는다.
   */
  action?: { label: string; onClick(): void; disabled?: boolean };
  /**
   * 오른쪽 프로필 버튼. 닉네임 첫 글자 대신 사람 아이콘을 쓴다 — 기본 닉네임
   * '여행자'면 '여' 한 글자만 떠서 무슨 버튼인지 알 수 없었다.
   */
  onProfile?: () => void;
}

export function AppHeader({ title, back = false, onMenu, action, onProfile }: Props) {
  const navigate = useNavigate();

  return (
    <header className="header">
      {back ? (
        <button className="header__btn" onClick={() => navigate(-1)} aria-label="뒤로">
          <ChevronLeft />
        </button>
      ) : (
        <span />
      )}

      <h1 className="header__title">{title}</h1>

      {onProfile ? (
        <button className="header__btn header__profile" onClick={onProfile} aria-label="프로필">
          <UserIcon size={20} />
        </button>
      ) : onMenu ? (
        <button className="header__btn" onClick={onMenu} aria-label="메뉴">
          <Menu />
        </button>
      ) : action ? (
        <button
          className="header__action"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ) : (
        <span />
      )}
    </header>
  );
}
