/**
 * 사용법 (#/guide).
 *
 * 로그인하지 않아도 열린다 — 초대 링크를 받은 친구가 "이게 뭔데 로그인하래?" 할 때,
 * 로그인 화면에서 먼저 볼 수 있어야 한다(App.tsx). 문구는 i18n의 guide, 한국어 문서판은
 * docs/GUIDE.md. 스크린샷은 언어마다 따로(src/assets/guide — scripts/guide-shots.mjs로 만든다).
 */

import { AppHeader } from '@/components/AppHeader';
import { useLocale, useT } from '@/i18n';
import { useAuthStore } from '@/store/authStore';

/*
 * 빌드가 파일마다 해시 붙은 주소를 준다 — /assets/ 아래라 서비스 워커가 본 것을 저장해
 * 오프라인에서도 한 번 본 사용법은 그림까지 뜬다(public/sw.js).
 */
const SHOTS = import.meta.glob<string>('../assets/guide/*/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
});

function shotUrl(locale: string, n: number): string | undefined {
  return SHOTS[`../assets/guide/${locale}/${n}.jpg`];
}

export function GuideScreen() {
  const t = useT();
  const locale = useLocale();
  const signedIn = useAuthStore((s) => Boolean(s.account));

  return (
    <div className="app">
      <AppHeader title={t.guide.title} back />

      <main className="main main--no-tabs">
        <article className="guide">
          <p className="guide__intro">{t.guide.intro}</p>

          <ol className="guide__steps">
            {t.guide.steps.map((step, i) => {
              const src = shotUrl(locale, i + 1);
              return (
                <li key={step.title} className="guide-step">
                  <h2 className="guide-step__title">
                    <span className="guide-step__no">{i + 1}</span>
                    {step.title}
                  </h2>
                  <p className="guide-step__body">{step.body}</p>
                  {src && (
                    <img
                      className="guide-step__shot"
                      src={src}
                      alt={t.guide.shotAlt(step.title)}
                      width={360}
                      height={740}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </li>
              );
            })}
          </ol>

          <section className="guide__tips">
            <h2 className="guide__tips-title">{t.guide.tipsTitle}</h2>
            <dl>
              {t.guide.tips.map((tip) => (
                <div key={tip.q} className="guide-tip">
                  <dt>{tip.q}</dt>
                  <dd>{tip.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* 로그인 전이면 여기서 바로 시작 — 주소만 바꾸면 App이 로그인 화면을 띄운다 */}
          {!signedIn && (
            <a className="btn btn--primary guide__start" href="#/">
              {t.guide.start}
            </a>
          )}
        </article>
      </main>
    </div>
  );
}
