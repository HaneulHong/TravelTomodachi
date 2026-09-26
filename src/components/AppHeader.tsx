import { useNavigate } from 'react-router-dom';
import { useT } from '@/i18n';
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
  const t = useT();

  /*
   * 앞 화면이 없으면(링크로 바로 들어온 경우 — 카톡으로 받은 처리방침·초대 링크 등)
   * 뒤로 갈 곳이 없어 버튼이 아무 일도 안 했다. 그때는 홈으로.
   * React Router가 history.state.idx에 이 앱 안에서 몇 번째 화면인지 적어 둔다.
   */
  const goBack = (): void => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    // 라우터의 navigate는 hashchange를 내지 않아, 로그인 전 화면(App이 해시를 직접 지켜봄)이
    // 바뀌지 않았다. 주소를 직접 바꾸면 hashchange가 나고 라우터도 따라온다.
    else window.location.replace('#/');
  };

  return (
    <header className="header">
      {back ? (
        <button className="header__btn" onClick={goBack} aria-label={t.common.back}>
          <ChevronLeft />
        </button>
      ) : (
        <span />
      )}

      <h1 className="header__title">{title}</h1>

      {onProfile ? (
        <button className="header__btn header__profile" onClick={onProfile} aria-label={t.common.profile}>
          <UserIcon size={20} />
        </button>
      ) : onMenu ? (
        <button className="header__btn" onClick={onMenu} aria-label={t.common.menu}>
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
