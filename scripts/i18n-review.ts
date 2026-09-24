/**
 * 번역 검토용 목록. 한국어 원문과 번역을 번호 붙여 나란히 뽑는다.
 *
 *   npm run i18n:review -- en > review-en.md
 *   npm run i18n:review -- ja > review-ja.md
 *
 * 메신저에 그대로 붙여 넣어 "12번은 이렇게"로 답을 받는 용도라 표 대신 목록으로 쓴다.
 * 문구 파일(src/i18n/messages)에서 바로 만들므로 따로 관리할 사본이 없다.
 */

import { formatDateLabel, formatMinutes, formatOffsetDelta, formatRelative } from '../src/domain/time';
import type { Locale } from '../src/i18n/locales';
import { en } from '../src/i18n/messages/en';
import { ja } from '../src/i18n/messages/ja';
import { ko, type Messages } from '../src/i18n/messages/ko';

const target = process.argv[2] as Locale;
if (target !== 'en' && target !== 'ja') {
  console.error('사용법: npm run i18n:review -- en | ja');
  process.exit(1);
}
const other: Messages = target === 'en' ? en : ja;
const TAG = target.toUpperCase();

/** 묶음마다 어느 화면인지. 검토하는 사람은 코드를 안 보니 화면 이름으로 알려준다. */
const SECTION: Record<keyof Messages, [ko: string, en: string, ja: string]> = {
  common: ['공통 (여러 화면)', 'Shared', '共通'],
  tabs: ['아래 탭', 'Bottom tabs', '下のタブ'],
  kind: ['일정 종류', 'Plan types', '予定の種類'],
  transport: ['이동 수단', 'Ways to travel', '移動手段'],
  carrierLabel: ['편명 칸 이름', 'Carrier field label', '便名欄の名前'],
  carrierPlaceholder: ['편명 칸 예시', 'Carrier field example', '便名欄の例'],
  region: ['지역 표시', 'Region badge', '地域の表示'],
  leg: ['일정 사이 이동 표시', 'Between plans', '予定の間の移動'],
  signIn: ['로그인 화면', 'Sign-in screen', 'ログイン画面'],
  unavailable: ['점검 화면', 'Maintenance screen', 'メンテナンス画面'],
  home: ['홈', 'Home', 'ホーム'],
  today: ['홈의 오늘 카드 (여행 중)', 'Today card', '今日のカード'],
  trip: ['일정 화면', 'Plan screen', '予定画面'],
  optimize: ['동선 최적화', 'Optimize route', 'ルート最適化'],
  dayEdit: ['날짜 설정', 'Day settings', '日付の設定'],
  tripCreate: ['새 여행 만들기', 'New trip', '新しい旅行'],
  itemEdit: ['일정 추가·수정', 'Add / edit plan', '予定の追加・編集'],
  itemDetail: ['일정 상세', 'Plan details', '予定の詳細'],
  edited: ['누가 고쳤는지', 'Edited by', '編集した人'],
  map: ['지도', 'Map', '地図'],
  place: ['장소 검색', 'Place search', '場所検索'],
  credits: ['데이터 출처', 'Data sources', 'データの出典'],
  ledger: ['가계부', 'Expenses', '家計簿'],
  ideas: ['후보 장소 (투표)', 'Place ideas', '行きたい場所'],
  comments: ['일정 댓글', 'Comments', 'コメント'],
  checklist: ['체크리스트', 'Checklist', 'チェックリスト'],
  members: ['멤버·초대', 'Members', 'メンバー'],
  invite: ['초대 참가', 'Join a trip', '招待に参加'],
  share: ['초대 메시지 (친구에게 보내는 글)', 'Invite message', '招待メッセージ'],
  profile: ['프로필', 'Profile', 'プロフィール'],
  nicknameSetup: ['첫 로그인 닉네임 정하기', 'Pick a nickname', 'ニックネーム設定'],
  offline: ['오프라인 알림', 'Offline notice', 'オフラインのお知らせ'],
  nickname: ['닉네임 오류', 'Nickname errors', 'ニックネームのエラー'],
  errors: ['오류 메시지', 'Error messages', 'エラーメッセージ'],
  serverErrors: ['서버 오류 메시지', 'Server errors', 'サーバーエラー'],
};

/** 개발 서버에서만 보이는 문구 — 검토할 필요가 없다 */
const DEV_ONLY = new Set(['signIn.method.dev', 'signIn.devNote', 'profile.via.dev']);

/**
 * 값을 끼워 넣는 문구는 {이름} 자리표시로 보여준다.
 * 숫자 자리는 복수형(1 day / 2 days)이 달라지므로 2를 넣는다.
 */
const NUMERIC = new Set(['n', 'max', 'status']);
function sample(fn: (...args: unknown[]) => unknown): string {
  const params = /^\s*(?:function[^(]*)?\(?([^)=]*)\)?\s*=>/.exec(fn.toString())?.[1] ?? '';
  const names = params.split(',').map((p) => p.trim().split(/[:=\s]/)[0] ?? '').filter(Boolean);
  const args = names.map((p) => (NUMERIC.has(p) ? 2 : `{${p}}`));
  return String(fn(...args));
}

function text(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'function') return sample(v as (...args: unknown[]) => unknown);
  return null;
}

const out: string[] = [];
const heading = target === 'en' ? '영어 번역 검토 · English review' : '일본어 번역 검토 · 日本語チェック';
out.push(`# TravelTomodachi — ${heading}`, '');
out.push(
  target === 'en'
    ? '여행 일정 앱의 화면 문구입니다. KO가 원문, EN이 번역입니다. 어색한 곳은 번호로 알려 주세요.'
    : '旅行プランアプリの画面の文言です。KOが原文(韓国語)、JAが翻訳です。不自然なところは番号で教えてください。',
  '',
  target === 'en'
    ? '- `{name}`처럼 중괄호는 앱이 채워 넣는 자리입니다 (여행 이름, 숫자 등). 그대로 두세요.\n- `**굵게**` 표시는 화면에서 굵은 글씨가 되는 부분입니다.\n- 좁은 폰에서도 한 줄에 들어가야 해서 버튼·탭 문구는 짧을수록 좋습니다.'
    : '- `{name}`のような波かっこは、アプリが入れる部分です(旅行名や数字など)。そのままにしてください。\n- `**太字**`の部分は画面で太字になります。\n- 狭いスマホでも1行に収まるよう、ボタンやタブの文言は短いほど助かります。',
  '',
);

let no = 0;
for (const section of Object.keys(ko) as (keyof Messages)[]) {
  const [skoName, senName, sjaName] = SECTION[section];
  const lines: string[] = [];
  const walk = (a: unknown, b: unknown, path: string): void => {
    const ta = text(a);
    if (ta !== null) {
      if (ta === '' || DEV_ONLY.has(path)) return;
      no += 1;
      lines.push(`${no}. KO: ${ta}`, `    ${TAG}: ${text(b)}`, '');
      return;
    }
    if (a && typeof a === 'object') {
      for (const k of Object.keys(a)) {
        walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      }
    }
  };
  walk(ko[section], other[section], section);
  if (lines.length === 0) continue;
  out.push(`## ${skoName} · ${target === 'en' ? senName : sjaName}`, '', ...lines);
}

// 날짜·시간은 문구 파일이 아니라 브라우저의 형식을 쓴다. 모양만 확인받는다.
const now = Date.parse('2026-11-03T12:00:00Z');
const samples: [string, (l: Locale) => string][] = [
  ['날짜', (l) => formatDateLabel('2026-11-03', l)],
  ['소요 시간', (l) => formatMinutes(95, l)],
  ['시차', (l) => formatOffsetDelta(-120, l)],
  ['몇 분 전', (l) => formatRelative(new Date(now - 5 * 60_000).toISOString(), now, l)],
  ['몇 시간 전', (l) => formatRelative(new Date(now - 3 * 3_600_000).toISOString(), now, l)],
];
out.push(`## 날짜·시간 표시 · ${target === 'en' ? 'Dates & times' : '日付・時刻'}`, '');
for (const [label, f] of samples) {
  no += 1;
  out.push(`${no}. KO: ${f('ko')}  (${label})`, `    ${TAG}: ${f(target)}`, '');
}

console.log(out.join('\n'));
