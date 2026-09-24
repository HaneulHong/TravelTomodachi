/**
 * 프로필 — 닉네임, 언어, 로그아웃.
 *
 * 받는 정보가 닉네임 하나뿐이라 화면도 이만큼이면 된다. 설정할 게 늘어나면
 * 그때 항목을 붙인다.
 */

import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { initialOf, NICKNAME_MAX, nicknameMessage, nicknameProblem } from '@/auth';
import { versionLabel } from '@/config';
import { LOCALE_NAME, LOCALES, useLocaleSettings, useT } from '@/i18n';
import { useAuthStore } from '@/store/authStore';

/**
 * 언어 설정. 기본은 기기 언어를 따르고, 끄면 세 언어 중에서 고른다.
 *
 * 끌 때는 지금 보이는 언어로 고정한다 — 끄자마자 화면이 다른 언어로 바뀌면
 * 무엇을 눌렀는지 헷갈린다. 바꾸고 싶으면 그다음에 고른다.
 */
function LanguageSetting() {
  const t = useT();
  const { preference, device, locale, setPreference } = useLocaleSettings();
  const auto = preference === 'auto';

  return (
    <div className="form__row">
      <span className="form__label">{t.profile.language}</span>
      <label className="form__check">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setPreference(e.target.checked ? 'auto' : locale)}
        />
        <span>
          {t.profile.languageAuto}
          <span className="form__check-sub">{t.profile.languageAutoHint(LOCALE_NAME[device])}</span>
        </span>
      </label>

      {!auto && (
        <>
          <div className="seg seg--3" role="radiogroup" aria-label={t.profile.language}>
            {LOCALES.map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={l === locale}
                // 언어 이름은 그 언어로 적는다 — 못 읽는 언어로 적혀 있으면 못 찾는다
                lang={l}
                className={`seg__btn${l === locale ? ' seg__btn--on' : ''}`}
                onClick={() => setPreference(l)}
              >
                {LOCALE_NAME[l]}
              </button>
            ))}
          </div>
          <p className="form__hint">{t.profile.languageManualHint}</p>
        </>
      )}
    </div>
  );
}

export function ProfileScreen() {
  const account = useAuthStore((s) => s.account);
  const updateNickname = useAuthStore((s) => s.updateNickname);
  const signOut = useAuthStore((s) => s.signOut);
  const error = useAuthStore((s) => s.error);
  const t = useT();

  const [draft, setDraft] = useState(account?.nickname ?? '');
  const [saved, setSaved] = useState(false);

  if (!account) {
    return (
      <div className="app">
        <AppHeader title={t.profile.title} back />
        <main className="main main--no-tabs">
          <p className="empty">{t.profile.notSignedIn}</p>
        </main>
      </div>
    );
  }

  const trimmed = draft.trim();
  // 저장을 누르기 전에 알려준다. 누른 뒤에 서버 오류로 알게 되면 늦다.
  const problem = trimmed === account.nickname ? null : nicknameProblem(draft);
  const changed = trimmed !== account.nickname && problem === null;

  const save = async (): Promise<void> => {
    if (!changed) return;
    await updateNickname(trimmed);
    // 저장됐다는 걸 알려준다. 버튼이 비활성으로 바뀌는 것만으로는 약하다.
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="app">
      <AppHeader title={t.profile.title} back />

      <main className="main main--no-tabs">
        <div className="form">
          {/* 아바타는 닉네임에서 만든다 — 사진을 받지 않으므로 */}
          <div className="profile__head">
            <span className="profile__avatar" style={{ background: account.color }}>
              {initialOf(trimmed || account.nickname)}
            </span>
            <span className="profile__name">
              {account.nickname}
              {account.tag && <span className="profile__tag">#{account.tag}</span>}
            </span>
            <span className="profile__via">{t.profile.via[account.via]}</span>
          </div>

          <label className="form__row">
            <span className="form__label">{t.profile.nickname}</span>
            <input
              className="form__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.profile.nicknamePlaceholder}
              maxLength={NICKNAME_MAX}
            />
            {problem ? (
              <p className="form__hint form__hint--error">
                {nicknameMessage(problem, t.nickname)}
              </p>
            ) : (
              <p className="form__hint">{t.profile.nicknameHint(account.tag || undefined)}</p>
            )}
          </label>

          {error && <p className="form__hint form__hint--error">{error}</p>}

          <div className="form__actions">
            <button className="btn btn--primary" onClick={() => void save()} disabled={!changed}>
              {saved ? t.profile.saved : t.profile.saveNickname}
            </button>
            <button className="btn" onClick={() => void signOut()}>
              {t.profile.signOut}
            </button>
          </div>

          <LanguageSetting />

          <p className="signin__privacy">{t.profile.privacy}</p>

          <p className="signin__version">TravelTomodachi {versionLabel(t.common.beta)}</p>
        </div>
      </main>
    </div>
  );
}
