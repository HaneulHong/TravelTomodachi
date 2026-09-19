import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu } from './icons';

interface Props {
  title: string;
  /** 뒤로가기 버튼 표시 (스케치의 '<') */
  back?: boolean;
  /** 메뉴 버튼 표시 (스케치의 '≡') */
  onMenu?: () => void;
}

export function AppHeader({ title, back = false, onMenu }: Props) {
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

      {onMenu ? (
        <button className="header__btn" onClick={onMenu} aria-label="메뉴">
          <Menu />
        </button>
      ) : (
        <span />
      )}
    </header>
  );
}
