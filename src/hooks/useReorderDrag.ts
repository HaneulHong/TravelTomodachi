/**
 * 손잡이를 끌어 목록 순서 바꾸기.
 *
 * 라이브러리를 안 쓰는 이유는 useSwipe와 같다 — Pointer Event만으로 충분하고
 * Capacitor 웹뷰에서도 똑같이 돈다. 손잡이에서만 시작하므로(touch-action: none)
 * 카드 나머지 부분의 세로 스크롤은 그대로다.
 *
 * 끄는 동안에는 DOM 순서를 바꾸지 않고 transform으로만 보여준다. 놓을 때
 * 한 번만 onDrop을 부른다 — 저장은 한 번, 되돌리기도 한 번이면 된다.
 *
 * 키보드: 손잡이에 초점을 두고 ↑↓로 한 칸씩 옮긴다.
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { dropIndex } from '@/domain/order';

interface DragState {
  from: number;
  to: number;
  dy: number;
  /** 다른 항목이 비켜 줄 거리 = 끄는 항목 높이 + 항목 사이 간격 */
  shift: number;
}

interface Start {
  pageY: number;
  from: number;
  centers: number[];
  shift: number;
}

/** 화면 가장자리에서 이만큼 안쪽으로 들어오면 자동으로 스크롤한다 */
const EDGE_PX = 72;
const SCROLL_STEP = 9;

export function useReorderDrag(onDrop: (from: number, to: number) => void) {
  const rows = useRef<(HTMLElement | null)[]>([]);
  const start = useRef<Start | null>(null);
  const lastClientY = useRef(0);
  const frame = useRef<number>();
  const [drag, setDrag] = useState<DragState | null>(null);
  /** 놓을 때 읽을 마지막 상태. state 갱신 함수 안에서 onDrop을 부르면 StrictMode에서 두 번 돈다. */
  const latest = useRef<DragState | null>(null);

  const stopScroll = () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  };
  useEffect(() => stopScroll, []);

  function update(clientY: number): void {
    const s = start.current;
    if (!s) return;
    // 페이지 좌표로 비교한다 — 끄는 도중 자동 스크롤이 돌아도 어긋나지 않는다
    const dy = clientY + window.scrollY - s.pageY;
    const to = dropIndex(s.centers, s.from, s.centers[s.from]! + dy);
    latest.current = { from: s.from, to, dy, shift: s.shift };
    setDrag(latest.current);
  }

  function autoScroll(): void {
    const y = lastClientY.current;
    const v = y < EDGE_PX ? -SCROLL_STEP : y > window.innerHeight - EDGE_PX ? SCROLL_STEP : 0;
    if (v !== 0) {
      window.scrollBy(0, v);
      update(y);
    }
    frame.current = requestAnimationFrame(autoScroll);
  }

  function finish(): void {
    const d = latest.current;
    start.current = null;
    latest.current = null;
    stopScroll();
    setDrag(null);
    if (d && d.to !== d.from) onDrop(d.from, d.to);
  }

  function handleProps(index: number, count: number) {
    return {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);

        const rects = rows.current.slice(0, count).map((el) => el?.getBoundingClientRect());
        const centers = rects.map((r) => (r ? r.top + window.scrollY + r.height / 2 : 0));
        const mine = rects[index];
        const next = rects[index + 1] ?? rects[index - 1];
        const gap = mine && next ? Math.max(0, Math.abs(next.top - mine.top) - mine.height) : 0;

        start.current = {
          pageY: e.clientY + window.scrollY,
          from: index,
          centers,
          shift: (mine?.height ?? 0) + gap,
        };
        lastClientY.current = e.clientY;
        update(e.clientY);
        stopScroll();
        frame.current = requestAnimationFrame(autoScroll);
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        if (!start.current) return;
        lastClientY.current = e.clientY;
        update(e.clientY);
      },
      onPointerUp: finish,
      onPointerCancel: finish,
      onKeyDown(e: KeyboardEvent<HTMLElement>) {
        if (e.key === 'ArrowUp' && index > 0) {
          e.preventDefault();
          onDrop(index, index - 1);
        } else if (e.key === 'ArrowDown' && index < count - 1) {
          e.preventDefault();
          onDrop(index, index + 1);
        }
      },
    };
  }

  /** 각 항목의 모양 — 끄는 항목은 손가락을 따라가고, 나머지는 비켜 준다 */
  function rowStyle(index: number): CSSProperties | undefined {
    if (!drag) return undefined;
    const { from, to, dy, shift } = drag;
    if (index === from) {
      return { transform: `translateY(${dy}px)`, position: 'relative', zIndex: 5 };
    }
    let offset = 0;
    if (from < to && index > from && index <= to) offset = -shift;
    if (to < from && index >= to && index < from) offset = shift;
    // 끄는 동안에만 부드럽게. 놓는 순간 DOM 순서가 바뀌므로 그때 애니메이션이 돌면 튄다.
    return { transform: `translateY(${offset}px)`, transition: 'transform 0.15s ease' };
  }

  const rowRef = (index: number) => (el: HTMLElement | null) => {
    rows.current[index] = el;
  };

  return { drag, handleProps, rowStyle, rowRef };
}
