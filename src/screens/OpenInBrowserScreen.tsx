/**
 * 앱 안 브라우저(카카오톡 등)에서 열렸을 때 — 기본 브라우저로 옮긴다.
 *
 * 왜: Google이 앱 안 브라우저 로그인을 막아서, 카카오톡으로 받은 초대 링크로는
 * 가입조차 못 한다(domain/inAppBrowser.ts).
 *
 *   자동   카카오톡·라인·안드로이드 — 들어오자마자 기본 브라우저로 같은 주소(초대 코드 포함)를
 *          연다. 이 창에는 "열었어요"와 돌아가기. 안 넘어가면 안내·링크 복사
 *   안내   iOS의 인스타그램 등 강제할 방법이 없는 곳 — Google 버튼을 누르기 **전에** 알려 준다
 */

import { useEffect, useRef, useState } from 'react';
import { externalOpenUrl, KAKAOTALK_CLOSE_URL, type InAppKind } from '@/domain/inAppBrowser';
import { useT } from '@/i18n';

interface Props {
  kind: InAppKind;
  ua: string;
}

/** 이 시간 안에 안 넘어가면 안내를 보여 준다 */
const FALLBACK_MS = 1500;

export function OpenInBrowserScreen({ kind, ua }: Props) {
  const t = useT();
  const href = window.location.href;
  const target = externalOpenUrl(kind, href, ua);
  const [showHelp, setShowHelp] = useState(target === null);
  const [copied, setCopied] = useState(false);
  const tried = useRef(false);

  const open = (): void => {
    if (target) window.location.href = target;
  };

  useEffect(() => {
    if (!target) return;
    // 여는 건 한 번만 — 개발 모드(StrictMode)는 효과를 두 번 돌린다
    if (!tried.current) {
      tried.current = true;
      open();
    }
    // 안내 타이머는 매번 건다. 한 번만 걸면 두 번째 실행 전 정리에서 지워져 안내가 영영 안 뜬다
    const timer = setTimeout(() => setShowHelp(true), FALLBACK_MS);
    return () => clearTimeout(timer);
    // 들어왔을 때 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      // 앱 안 브라우저에서 클립보드가 막혀 있으면 아래 주소 칸을 길게 눌러 복사한다
      document.getElementById('open-in-browser-url')?.focus();
    }
  };

  const appName = t.inApp.apps[kind];

  return (
    <div className="app">
      <main className="main main--no-tabs signin">
        <div className="signin__brand">
          <span className="signin__mark">🧳</span>
          <h1 className="signin__title">TravelTomodachi</h1>
        </div>

        {target && !showHelp && <p className="signin__sub">{t.inApp.opening}</p>}

        {target && showHelp && (
          <>
            <p className="signin__sub">{t.inApp.openedTitle}</p>
            <p className="signin__note">{t.inApp.openedBody(appName)}</p>
            <div className="signin__methods">
              {kind === 'kakaotalk' && (
                <button
                  className="btn btn--primary"
                  onClick={() => (window.location.href = KAKAOTALK_CLOSE_URL)}
                >
                  {t.inApp.backToKakao}
                </button>
              )}
              <button className="btn" onClick={open}>
                {t.inApp.retry}
              </button>
            </div>
          </>
        )}

        {!target && (
          <>
            <p className="signin__sub">{t.inApp.manualTitle(appName)}</p>
            <p className="signin__note">{t.inApp.manualBody}</p>
          </>
        )}

        {showHelp && (
          <div className="inapp__copy">
            <p className="form__hint">{t.inApp.steps}</p>
            <input
              id="open-in-browser-url"
              className="form__input"
              value={href}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              aria-label={t.inApp.linkLabel}
            />
            <button className="btn btn--primary" onClick={() => void copy()}>
              {copied ? t.inApp.copied : t.inApp.copyLink}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
