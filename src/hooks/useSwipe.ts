/**
 * 가로 스와이프 감지.
 *
 * 라이브러리를 안 쓰는 이유: Pointer Event만으로 충분하고,
 * Capacitor 웹뷰에서도 동작이 같다. 제스처 라이브러리는 네이티브
 * 웹뷰에서 스크롤과 충돌하는 경우가 잦다.
 *
 * 세로 스크롤을 막지 않는 게 핵심이다 — 처음 몇 px의 방향으로
 * 이 제스처가 가로인지 세로인지 판정하고, 세로면 손을 뗀다.
 */

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** 이만큼 넘게 움직여야 스와이프로 본다 */
  thresholdPx?: number;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, thresholdPx = 56 }: SwipeOptions) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'undecided' | 'horizontal' | 'vertical'>('undecided');

  function onPointerDown(e: ReactPointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = 'undecided';
  }

  function onPointerMove(e: ReactPointerEvent) {
    const s = start.current;
    if (!s || axis.current === 'vertical') return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (axis.current === 'undecided' && Math.abs(dx) + Math.abs(dy) > 10) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s || axis.current !== 'horizontal') return;
    const dx = e.clientX - s.x;
    if (dx <= -thresholdPx) onSwipeLeft?.();
    else if (dx >= thresholdPx) onSwipeRight?.();
  }

  function onPointerCancel() {
    start.current = null;
    axis.current = 'undecided';
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
