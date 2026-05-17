import { useRef, useState } from 'react';

// Per-row swipe state machine. Right swipe past SWIPE_COMMIT_PX fires onMove;
// left past the threshold fires onDelete. Below threshold, the row snaps back.
// touch-action: pan-y on the swipe container is what lets us run alongside
// vertical scrolling without preventDefault dances.

const SWIPE_COMMIT_PX = 90;
const SWIPE_MAX_PX = 180;
// Threshold for deciding the gesture is horizontal vs vertical scroll. Smaller
// than COMMIT so the reveal starts before the user is sure they'll commit.
const SWIPE_DECIDE_PX = 8;

interface SwipeStart {
  x: number;
  y: number;
  locked: 'h' | 'v' | null;
}

export interface UseSwipeGestureOptions {
  enabled: boolean;
  onMove: () => void;
  onDelete: () => void;
}

export interface SwipeGestureHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export interface UseSwipeGestureReturn {
  handlers: SwipeGestureHandlers;
  swipeDx: number;
  isDragging: boolean;
  // Wrap an onClick handler so it no-ops the synthetic click that browsers
  // emit after a committed-swipe touchend.
  guardClick: <T extends (...args: never[]) => void>(handler: T) => T;
}

export function useSwipeGesture({ enabled, onMove, onDelete }: UseSwipeGestureOptions): UseSwipeGestureReturn {
  const [swipeDx, setSwipeDx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<SwipeStart | null>(null);
  const justSwipedRef = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!enabled) return;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, locked: null };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const start = startRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (start.locked === null) {
      if (Math.abs(dx) > SWIPE_DECIDE_PX && Math.abs(dx) > Math.abs(dy) * 1.3) {
        start.locked = 'h';
        setIsDragging(true);
      } else if (Math.abs(dy) > SWIPE_DECIDE_PX) {
        // Vertical scroll wins. Release this gesture so we don't fight the
        // browser's scroll while the finger keeps moving.
        startRef.current = null;
        return;
      } else {
        return;
      }
    }
    if (start.locked === 'h') {
      setSwipeDx(Math.max(-SWIPE_MAX_PX, Math.min(SWIPE_MAX_PX, dx)));
    }
  };

  const onTouchEnd = () => {
    const dx = swipeDx;
    startRef.current = null;
    setIsDragging(false);
    if (dx <= -SWIPE_COMMIT_PX) {
      onDelete();
      justSwipedRef.current = true;
    } else if (dx >= SWIPE_COMMIT_PX) {
      onMove();
      justSwipedRef.current = true;
    }
    setSwipeDx(0);
  };

  // Browser-initiated cancellation (system gesture, alert popup, etc.) is not
  // a "user committed the swipe" signal — just snap back without firing the
  // action even if dx had crossed the threshold.
  const onTouchCancel = () => {
    startRef.current = null;
    setIsDragging(false);
    setSwipeDx(0);
  };

  const guardClick = <T extends (...args: never[]) => void>(handler: T): T => {
    return ((...args: never[]) => {
      if (justSwipedRef.current) {
        justSwipedRef.current = false;
        return;
      }
      handler(...args);
    }) as T;
  };

  return {
    swipeDx,
    isDragging,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
    guardClick,
  };
}
