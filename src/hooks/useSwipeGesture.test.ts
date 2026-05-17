import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSwipeGesture } from './useSwipeGesture';

// Build the shape useSwipeGesture actually touches — only e.touches[0].clientX,
// .clientY, and e.touches.length. Casting through unknown keeps strict mode
// happy without pulling in the full React.TouchEvent shape.
function touch(x: number, y: number) {
  return { touches: [{ clientX: x, clientY: y }] } as unknown as React.TouchEvent;
}

function multiTouch() {
  return { touches: [{ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 10 }] } as unknown as React.TouchEvent;
}

describe('useSwipeGesture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('horizontal drag past +90 px fires onMove exactly once on touchend', () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ enabled: true, onMove, onDelete }),
    );

    act(() => {
      result.current.handlers.onTouchStart(touch(0, 0));
      result.current.handlers.onTouchMove(touch(100, 0));
      result.current.handlers.onTouchEnd();
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(result.current.swipeDx).toBe(0);
  });

  it('horizontal drag past -90 px fires onDelete exactly once', () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ enabled: true, onMove, onDelete }),
    );

    act(() => {
      result.current.handlers.onTouchStart(touch(0, 0));
      result.current.handlers.onTouchMove(touch(-120, 0));
      result.current.handlers.onTouchEnd();
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onMove).not.toHaveBeenCalled();
    expect(result.current.swipeDx).toBe(0);
  });

  it('a drag below the commit threshold fires nothing and snaps back to 0', () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ enabled: true, onMove, onDelete }),
    );

    act(() => {
      result.current.handlers.onTouchStart(touch(0, 0));
      result.current.handlers.onTouchMove(touch(70, 0));
      result.current.handlers.onTouchEnd();
    });

    expect(onMove).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(result.current.swipeDx).toBe(0);
  });

  it('vertical movement past the decide threshold disengages the gesture', () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ enabled: true, onMove, onDelete }),
    );

    act(() => {
      result.current.handlers.onTouchStart(touch(0, 0));
      // Vertical-dominant first move disengages: locks 'v' path -> startRef=null.
      result.current.handlers.onTouchMove(touch(0, 40));
      // Subsequent horizontal moves should be ignored.
      result.current.handlers.onTouchMove(touch(200, 40));
      result.current.handlers.onTouchEnd();
    });

    expect(result.current.swipeDx).toBe(0);
    expect(onMove).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('touch cancel resets state without firing the action even past threshold', () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ enabled: true, onMove, onDelete }),
    );

    act(() => {
      result.current.handlers.onTouchStart(touch(0, 0));
      result.current.handlers.onTouchMove(touch(150, 0));
      result.current.handlers.onTouchCancel();
    });

    expect(onMove).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(result.current.swipeDx).toBe(0);
    expect(result.current.isDragging).toBe(false);
  });

  it('multi-finger touchstart immediately resets state and does not commit', () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ enabled: true, onMove, onDelete }),
    );

    act(() => {
      result.current.handlers.onTouchStart(multiTouch());
      // No start point captured -> moves are no-ops.
      result.current.handlers.onTouchMove(touch(200, 0));
      result.current.handlers.onTouchEnd();
    });

    expect(onMove).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(result.current.swipeDx).toBe(0);
  });

  it('guardClick swallows the click after a committed swipe, then re-arms', () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ enabled: true, onMove, onDelete }),
    );

    // Commit a swipe.
    act(() => {
      result.current.handlers.onTouchStart(touch(0, 0));
      result.current.handlers.onTouchMove(touch(120, 0));
      result.current.handlers.onTouchEnd();
    });

    const real = vi.fn();
    const guarded = result.current.guardClick(real);
    guarded();
    expect(real).not.toHaveBeenCalled();

    // Next click should fire.
    guarded();
    expect(real).toHaveBeenCalledTimes(1);
  });

  it('guardClick is also cleared by the 300ms backstop timer', () => {
    const onMove = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ enabled: true, onMove, onDelete }),
    );

    act(() => {
      result.current.handlers.onTouchStart(touch(0, 0));
      result.current.handlers.onTouchMove(touch(120, 0));
      result.current.handlers.onTouchEnd();
    });

    // Advance past the 300ms backstop without ever firing the synthetic click.
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const real = vi.fn();
    const guarded = result.current.guardClick(real);
    guarded();
    expect(real).toHaveBeenCalledTimes(1);
  });
});
