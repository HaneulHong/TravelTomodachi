/**
 * 로그인하는 동안 초대 코드를 붙잡아 둔다.
 *
 * 친구가 초대 링크(#/invite/CODE)를 열었는데 로그인이 안 돼 있으면 로그인
 * 화면이 뜬다. 그런데 Google 로그인은 페이지를 떠났다가 **앱 루트로**
 * 돌아온다 — 해시에 있던 코드가 그 사이에 사라진다. 그러면 친구는 로그인은
 * 했는데 여행에는 들어가지 못한 채 빈 홈 화면을 보게 된다.
 *
 * 초대받은 사람이 처음 겪는 화면이라, 여기서 막히면 초대 자체가 실패한다.
 * 그래서 로그인 전에 코드를 저장해 두고, 로그인 후 한 번만 꺼내 쓴다.
 *
 * localStorage를 쓰는 이유: OAuth는 같은 탭으로 돌아오지만, 브라우저에
 * 따라 새 탭에서 열리는 경우가 있다. sessionStorage는 탭을 넘지 못한다.
 */

const KEY = 'tt.pending-invite';

/** 주소에서 초대 코드를 뽑는다. #/invite/ABCD1234 형태가 아니면 null. */
export function inviteCodeFromHash(hash: string): string | null {
  const m = /^#\/invite\/([^/?#]+)/.exec(hash);
  return m ? decodeURIComponent(m[1]!) : null;
}

/**
 * 앱 딥링크에서 초대 코드를 뽑는다. com.traveltomodachi.app://invite/ABCD1234
 * 로그인 콜백(…://auth) 같은 다른 딥링크면 null.
 */
export function inviteCodeFromAppUrl(url: string, scheme: string): string | null {
  const prefix = `${scheme}://invite/`;
  if (!url.startsWith(prefix)) return null;
  const code = url.slice(prefix.length).split(/[/?#]/)[0];
  return code ? decodeURIComponent(code) : null;
}

export function stashInvite(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // 저장소가 막혀 있으면 로그인 후 코드를 다시 입력해야 할 뿐이다
  }
}

/** 한 번 꺼내면 지운다. 남겨두면 다음 로그인 때마다 같은 여행으로 끌려간다. */
export function takeStashedInvite(): string | null {
  try {
    const code = localStorage.getItem(KEY);
    if (code) localStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}
