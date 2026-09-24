/**
 * 첫 로그인 닉네임 정하기. 누가 보여주는지는 auth/onboarding.ts.
 *
 * 초대 링크로 온 사람도 여기를 먼저 거친다. 닉네임을 정한 뒤 들어가야 같은
 * 여행 친구들 목록에 처음부터 제 이름으로 보인다. (초대 코드는 App이 주소에
 * 붙들고 있어서, 이 화면이 끝나면 바로 참가 화면으로 이어진다.)
 */

import { useEffect, useState } from 'react';
import { NICKNAME_MAX, nicknameMessage, nicknameProblem } from '@/auth';
import { markNicknameAsked } from '@/auth/onboarding';
import { inviteCodeFromHash } from '@/auth/pendingInvite';
import { useT } from '@/i18n';
import { useAuthStore } from '@/store/authStore';

interface Props {
  userId: string;
  onDone(): void;
}

/**
 * 초대 링크로 들어왔는지 — 끝나면 그 여행으로 간다고 알려준다.
 * 로그인하고 돌아오면 App의 효과가 이 화면이 뜬 **뒤에** 초대 코드를 주소로
 * 옮겨 놓는다. 처음 한 번만 읽으면 놓치므로 주소가 바뀔 때마다 다시 본다.
 */
function useInvitedByLink(): boolean {
  const read = () => inviteCodeFromHash(window.location.hash) !== null;
  const [invited, setInvited] = useState(read);
  useEffect(() => {
    const onChange = () => setInvited(read());
    window.addEventListener('hashchange', onChange);
    onChange();
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return invited;
}

export function NicknameSetupScreen({ userId, onDone }: Props) {
  const invited = useInvitedByLink();
  const t = useT();
  const updateNickname = useAuthStore((s) => s.updateNickname);
  const error = useAuthStore((s) => s.error);

  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  // 빈 칸에서 시작하므로 처음부터 '입력해 주세요'를 띄우지 않는다
  const problem = draft.length === 0 ? null : nicknameProblem(draft);
  const canSave = draft.trim().length > 0 && problem === null && !saving;

  const finish = (): void => {
    markNicknameAsked(userId);
    onDone();
  };

  const save = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    await updateNickname(draft.trim());
    // 실패하면 스토어에 오류가 남는다 — 화면에 두고 다시 시도하게 한다
    if (useAuthStore.getState().error) {
      setSaving(false);
      return;
    }
    finish();
  };

  return (
    <div className="app">
      <main className="main main--no-tabs signin">
        <div className="signin__brand">
          <span className="signin__mark">👋</span>
          <h1 className="signin__title nickname-setup__title">{t.nicknameSetup.title}</h1>
          <p className="signin__sub">{t.nicknameSetup.sub}</p>
        </div>

        <form
          className="form nickname-setup__form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="form__row">
            <span className="form__label">{t.profile.nickname}</span>
            <input
              className="form__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.nicknameSetup.placeholder}
              maxLength={NICKNAME_MAX}
              autoFocus
              enterKeyHint="done"
            />
            {problem ? (
              <p className="form__hint form__hint--error">{nicknameMessage(problem, t.nickname)}</p>
            ) : (
              <p className="form__hint">{t.nicknameSetup.hint}</p>
            )}
          </label>

          {error && <p className="form__hint form__hint--error">{error}</p>}
          {invited && <p className="signin__invited">{t.nicknameSetup.invited}</p>}

          <div className="form__actions">
            <button className="btn btn--primary" type="submit" disabled={!canSave}>
              {saving ? t.common.processing : t.nicknameSetup.start}
            </button>
            <button className="btn btn--ghost" type="button" onClick={finish} disabled={saving}>
              {t.nicknameSetup.later}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
