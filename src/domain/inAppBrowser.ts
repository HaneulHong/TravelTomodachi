/**
 * 앱 안 브라우저(인앱 브라우저) 감지와 "기본 브라우저로 열기" 주소.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────────
 * 친구에게 초대 링크를 카카오톡으로 보내면, 받은 사람이 누를 때 카카오톡 **안의**
 * 브라우저에서 열린다. Google은 이런 앱 안 브라우저에서 로그인을 막는다
 * (403 disallowed_useragent). 초대받은 친구가 가입조차 못 한다.
 *
 * 링크를 어디서 열지는 카카오톡이 정해서 보내는 쪽에서는 못 바꾼다. 대신 페이지가
 * 열린 직후 스스로 기본 브라우저로 옮겨 간다:
 *
 *   카카오톡           kakaotalk://web/openExternal?url=…   iOS·안드로이드 모두
 *   라인               주소에 openExternalBrowser=1         iOS·안드로이드 모두
 *   안드로이드 그 밖   intent://…                          기본 브라우저(또는 선택 창)
 *   iOS 그 밖          강제할 방법이 없다 → 안내 + 링크 복사
 *
 * 공개 라이브러리(open-external-browser)의 방식을 참고했지만 그대로 쓰지 않는다 —
 * 주소를 인코딩하지 않아 `#/invite/코드` 같은 해시가 잘리고, 라인 감지가 너무 넓다.
 */

export type InAppKind =
  | 'kakaotalk'
  | 'line'
  | 'instagram'
  | 'facebook'
  | 'naver'
  | 'band'
  | 'daum'
  | 'everytime'
  | 'webview';

/** 앞에 있는 것부터 본다 — 카카오톡 UA에도 안드로이드 웹뷰 표시(wv)가 붙어 있다 */
const PATTERNS: readonly [InAppKind, RegExp][] = [
  ['kakaotalk', /\bKAKAOTALK\b/i],
  // "Line/13.1.0" — 'line'만 찾으면 "Online" 같은 글자에도 걸린다
  ['line', /\bLine\/\d/],
  ['instagram', /\bInstagram\b/i],
  ['facebook', /\bFB(AN|AV|_IAB)\b/],
  ['naver', /\bNAVER\(inapp/i],
  ['band', /\bBAND\/\d/],
  ['daum', /\bDaumApps\b/i],
  ['everytime', /\beverytimeApp\b/i],
  // 그 밖의 안드로이드 웹뷰: "...; wv) AppleWebKit"
  ['webview', /;\s?wv\)/],
];

export function detectInApp(ua: string): InAppKind | null {
  for (const [kind, re] of PATTERNS) if (re.test(ua)) return kind;
  return null;
}

export function isIOS(ua: string): boolean {
  return /iPhone|iPad|iPod/.test(ua);
}

export function isAndroid(ua: string): boolean {
  return /Android/.test(ua);
}

/**
 * 해시(#/invite/코드)를 쿼리로 옮겨 싣는 이름. 안드로이드 intent 주소는 `#`을 자기
 * 구분자로 쓰므로 해시를 그대로 실을 수 없다. 앱이 켜질 때 되돌린다(restoreHashFromQuery).
 */
export const HASH_PARAM = 'tt_hash';

/**
 * 이 기기·앱에서 기본 브라우저로 여는 주소. 강제할 방법이 없으면 null(안내를 보여 준다).
 * `href`는 지금 페이지의 전체 주소 — 초대 코드가 담긴 해시까지 그대로 넘긴다.
 */
export function externalOpenUrl(kind: InAppKind, href: string, ua: string): string | null {
  if (kind === 'kakaotalk') {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  }

  const url = new URL(href);

  if (kind === 'line') {
    // 쿼리는 해시 **앞에** 있어야 한다 — URL 객체가 알아서 자리를 맞춘다
    url.searchParams.set('openExternalBrowser', '1');
    return url.toString();
  }

  if (isAndroid(ua)) {
    if (url.hash) {
      url.searchParams.set(HASH_PARAM, url.hash.slice(1));
      url.hash = '';
    }
    const target = `${url.host}${url.pathname}${url.search}`;
    const fallback = encodeURIComponent(href);
    // 패키지를 지정하지 않는다 — 크롬이 아니라 그 사람의 기본 브라우저(없으면 선택 창)
    return (
      `intent://${target}#Intent;scheme=${url.protocol.replace(':', '')};` +
      `action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;` +
      `S.browser_fallback_url=${fallback};end`
    );
  }

  return null;
}

/**
 * intent로 넘어오며 쿼리에 실린 해시를 되돌린다. 되돌릴 게 없으면 null.
 * 예: https://x.dev/?tt_hash=%2Finvite%2FAB12 → https://x.dev/#/invite/AB12
 */
export function restoreHashFromQuery(href: string): string | null {
  const url = new URL(href);
  const hash = url.searchParams.get(HASH_PARAM);
  if (hash === null) return null;
  url.searchParams.delete(HASH_PARAM);
  url.hash = hash;
  return url.toString();
}

/** 카카오톡 안 브라우저를 닫고 대화방으로 돌아간다 */
export const KAKAOTALK_CLOSE_URL = 'kakaotalk://inappbrowser/close';
