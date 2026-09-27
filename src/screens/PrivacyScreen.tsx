/**
 * 개인정보 처리방침.
 *
 * 로그인하지 않아도 열린다 — 가입하기 전에 읽을 수 있어야 한다(App.tsx).
 * 본문은 legal/privacyPolicy.ts. 한국어가 공식이고, 번역본이면 위에 밝힌다.
 */

import { AppHeader } from '@/components/AppHeader';
import { useLocale, useT } from '@/i18n';
import { CONTACT_EMAIL, EFFECTIVE_DATE, PRIVACY_POLICY } from '@/legal/privacyPolicy';

/** 문장 속 연락처 메일을 누를 수 있게 — 누르면 메일 앱이 받는 사람이 채워진 채로 열린다 */
function withMailLink(text: string) {
  const i = text.indexOf(CONTACT_EMAIL);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <a className="signin__link" href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
      {text.slice(i + CONTACT_EMAIL.length)}
    </>
  );
}

export function PrivacyScreen() {
  const t = useT();
  const locale = useLocale();
  const sections = PRIVACY_POLICY[locale];

  return (
    <div className="app">
      <AppHeader title={t.privacyPage.title} back />

      <main className="main main--no-tabs">
        <article className="policy">
          <p className="policy__meta">
            {t.privacyPage.effective}: {EFFECTIVE_DATE}
          </p>
          {t.privacyPage.authoritative && (
            <p className="policy__note">{t.privacyPage.authoritative}</p>
          )}

          {sections.map((s) => (
            <section key={s.title} className="policy__section">
              <h2 className="policy__title">{s.title}</h2>
              {s.paragraphs?.map((p) => <p key={p}>{withMailLink(p)}</p>)}
              {s.items && (
                <ul>
                  {s.items.map((i) => (
                    <li key={i}>{withMailLink(i)}</li>
                  ))}
                </ul>
              )}
              {s.table && (
                // 좁은 폰에서는 표가 옆으로 밀리지 않고 칸마다 쌓인다 (styles.css)
                <div className="policy__table" role="table">
                  <div className="policy__row policy__row--head" role="row">
                    {s.table.head.map((h) => (
                      <span key={h} role="columnheader">
                        {h}
                      </span>
                    ))}
                  </div>
                  {s.table.rows.map((row) => (
                    <div key={row.join('|')} className="policy__row" role="row">
                      {row.map((cell, i) => (
                        <span key={i} role="cell" data-label={s.table!.head[i]}>
                          {cell}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {s.note && <p className="policy__note">{s.note}</p>}
            </section>
          ))}
        </article>
      </main>
    </div>
  );
}
