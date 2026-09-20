/**
 * 프로필 — 닉네임과 로그아웃.
 *
 * 받는 정보가 닉네임 하나뿐이라 화면도 이만큼이면 된다. 설정할 게 늘어나면
 * 그때 항목을 붙인다.
 */

import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { colorOf, initialOf, type SignInMethod } from '@/auth';
import { useAuthStore } from '@/store/authStore';

const VIA_LABEL: Record<SignInMethod, string> = {
  google: 'Google 계정',
  apple: 'Apple 계정',
  dev: '개발용 계정',
};

export function ProfileScreen() {
  const account = useAuthStore((s) => s.account);
  const updateNickname = useAuthStore((s) => s.updateNickname);
  const signOut = useAuthStore((s) => s.signOut);
  const error = useAuthStore((s) => s.error);

  const [draft, setDraft] = useState(account?.nickname ?? '');
  const [saved, setSaved] = useState(false);

  if (!account) {
    return (
      <div className="app">
        <AppHeader title="프로필" back />
        <main className="main main--no-tabs">
          <p className="empty">로그인 상태가 아닙니다.</p>
        </main>
      </div>
    );
  }

  const trimmed = draft.trim();
  const changed = trimmed.length > 0 && trimmed !== account.nickname;

  const save = async (): Promise<void> => {
    if (!changed) return;
    await updateNickname(trimmed);
    // 저장됐다는 걸 알려준다. 버튼이 비활성으로 바뀌는 것만으로는 약하다.
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="app">
      <AppHeader title="프로필" back />

      <main className="main main--no-tabs">
        <div className="form">
          {/* 아바타는 닉네임에서 만든다 — 사진을 받지 않으므로 */}
          <div className="profile__head">
            <span
              className="profile__avatar"
              style={{ background: colorOf(trimmed || account.nickname) }}
            >
              {initialOf(trimmed || account.nickname)}
            </span>
            <span className="profile__via">{VIA_LABEL[account.via]}으로 로그인됨</span>
          </div>

          <label className="form__row">
            <span className="form__label">닉네임</span>
            <input
              className="form__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="친구들에게 보일 이름"
              maxLength={20}
            />
            <p className="form__hint">
              일정에서 누가 고쳤는지 구분하는 데만 씁니다. 언제든 바꿀 수 있습니다.
            </p>
          </label>

          {error && <p className="form__hint form__hint--error">{error}</p>}

          <div className="form__actions">
            <button className="btn btn--primary" onClick={() => void save()} disabled={!changed}>
              {saved ? '저장했습니다' : '닉네임 저장'}
            </button>
            <button className="btn" onClick={() => void signOut()}>
              로그아웃
            </button>
          </div>

          <p className="signin__privacy">
            저장하는 정보는 닉네임뿐입니다. 이메일과 실명은 받지 않습니다.
          </p>
        </div>
      </main>
    </div>
  );
}
