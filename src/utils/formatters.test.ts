import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatTime,
  formatRatio,
  formatProgress,
  STATE_PRIORITY,
} from './formatters';

describe('formatBytes', () => {
  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns 0 B for the qBittorrent "no limit" sentinel (-1)', () => {
    expect(formatBytes(-1)).toBe('0 B');
  });

  it('returns 0 B for NaN', () => {
    expect(formatBytes(NaN)).toBe('0 B');
  });

  it('returns 0 B for Infinity', () => {
    expect(formatBytes(Infinity)).toBe('0 B');
  });

  it('formats exactly 1 KB', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('keeps fractional precision', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('respects decimals argument', () => {
    expect(formatBytes(1234567, 0)).toBe('1 MB');
  });

  it('clamps to the last unit for extreme values', () => {
    expect(formatBytes(Number.MAX_VALUE)).toMatch(/YB$/);
  });
});

describe('formatTime', () => {
  it('treats the qBittorrent INFINITE sentinel (8640000) as ∞', () => {
    expect(formatTime(8640000)).toBe('∞');
  });

  it('treats negative seconds as ∞', () => {
    expect(formatTime(-1)).toBe('∞');
  });

  it('returns "0s" for zero', () => {
    expect(formatTime(0)).toBe('0s');
  });

  it('formats hours and minutes', () => {
    expect(formatTime(3700)).toBe('1h 1m');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(125)).toBe('2m 5s');
  });

  it('formats seconds only when under a minute', () => {
    expect(formatTime(45)).toBe('45s');
  });
});

describe('formatRatio', () => {
  it('returns ∞ for the -1 sentinel', () => {
    expect(formatRatio(-1)).toBe('∞');
  });

  it('returns ∞ for Infinity', () => {
    expect(formatRatio(Infinity)).toBe('∞');
  });

  it('formats with 2 decimals', () => {
    expect(formatRatio(1.234567)).toBe('1.23');
  });
});

describe('formatProgress', () => {
  it('formats as percent with 1 decimal', () => {
    expect(formatProgress(0.5)).toBe('50.0%');
  });

  it('handles 0', () => {
    expect(formatProgress(0)).toBe('0.0%');
  });

  it('handles 1', () => {
    expect(formatProgress(1)).toBe('100.0%');
  });
});

describe('STATE_PRIORITY (sort ordering)', () => {
  it('ranks active states first', () => {
    expect(STATE_PRIORITY.downloading).toBeLessThan(STATE_PRIORITY.pausedDL);
    expect(STATE_PRIORITY.uploading).toBeLessThan(STATE_PRIORITY.stoppedUP);
  });

  it('groups paused and stopped together', () => {
    expect(STATE_PRIORITY.pausedDL).toBe(STATE_PRIORITY.stoppedDL);
    expect(STATE_PRIORITY.pausedUP).toBe(STATE_PRIORITY.stoppedUP);
  });

  it('ranks errors last', () => {
    expect(STATE_PRIORITY.error).toBeGreaterThan(STATE_PRIORITY.downloading);
    expect(STATE_PRIORITY.missingFiles).toBeGreaterThan(STATE_PRIORITY.uploading);
  });
});
