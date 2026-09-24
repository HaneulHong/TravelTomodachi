/**
 * 문구 안의 **굵게**를 <strong>으로.
 *
 * 문구 파일을 React 없이 두려고(데이터 계층도 읽는다) JSX 대신 이 표시만 쓴다.
 * 언어마다 굵게 할 자리가 문장 안에서 옮겨 다니므로, 문장을 조각내 두는 것보다
 * 한 문장 안에 표시하는 편이 번역하기도 쉽다.
 */

import { Fragment } from 'react';

export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        // split이 캡처한 조각은 홀수 번째에 온다
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}
