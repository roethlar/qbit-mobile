import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTorrentFilters } from './useTorrentFilters';
import type { Torrent, TorrentState } from '../types/qbittorrent';

function makeTorrent(overrides: Partial<Torrent>): Torrent {
  return {
    added_on: 0,
    amount_left: 0,
    auto_tmm: false,
    availability: 0,
    category: '',
    completed: 0,
    completion_on: 0,
    content_path: '',
    dl_limit: 0,
    dlspeed: 0,
    downloaded: 0,
    downloaded_session: 0,
    eta: 0,
    f_l_piece_prio: false,
    force_start: false,
    hash: 'h',
    inactive_seeding_time_limit: 0,
    infohash_v1: '',
    infohash_v2: '',
    last_activity: 0,
    magnet_uri: '',
    max_inactive_seeding_time: 0,
    max_ratio: 0,
    max_seeding_time: 0,
    name: 'name',
    num_complete: 0,
    num_incomplete: 0,
    num_leechs: 0,
    num_seeds: 0,
    priority: 0,
    progress: 0,
    ratio: 0,
    ratio_limit: 0,
    save_path: '',
    seeding_time: 0,
    seeding_time_limit: 0,
    seen_complete: 0,
    seq_dl: false,
    size: 0,
    state: 'downloading' as TorrentState,
    super_seeding: false,
    tags: '',
    time_active: 0,
    total_size: 0,
    tracker: '',
    trackers_count: 0,
    up_limit: 0,
    uploaded: 0,
    uploaded_session: 0,
    upspeed: 0,
    ...overrides,
  };
}

describe('useTorrentFilters', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ignores a garbage qbit-sort-by value and defaults to name', () => {
    localStorage.setItem('qbit-sort-by', 'not-a-real-field');
    const { result } = renderHook(() => useTorrentFilters([]));
    expect(result.current.sortBy).toBe('name');
  });

  it('ignores a garbage qbit-sort-order value and defaults to asc', () => {
    localStorage.setItem('qbit-sort-order', 'sideways');
    const { result } = renderHook(() => useTorrentFilters([]));
    expect(result.current.sortOrder).toBe('asc');
  });

  it('persists sortBy to localStorage when changed', () => {
    const { result } = renderHook(() => useTorrentFilters([]));
    act(() => result.current.handleSort('size'));
    expect(localStorage.getItem('qbit-sort-by')).toBe('size');
  });

  it('combines search, tag filter, and sort on the input list', () => {
    const torrents = [
      makeTorrent({ hash: 'a', name: 'Alpha report', size: 100, tags: 'work' }),
      makeTorrent({ hash: 'b', name: 'Beta movie', size: 50, tags: 'fun' }),
      makeTorrent({ hash: 'c', name: 'Alpha track', size: 30, tags: 'fun' }),
      makeTorrent({ hash: 'd', name: 'Gamma', size: 5, tags: 'fun' }),
    ];
    const { result } = renderHook(() => useTorrentFilters(torrents));

    act(() => {
      result.current.setSearchQuery('alpha');
      result.current.setSelectedTag('fun');
      result.current.handleSort('size');
    });

    const out = result.current.filteredAndSortedTorrents;
    expect(out.map((t) => t.hash)).toEqual(['c']);
  });

  it('handleSort toggles asc<->desc on the same field and resets to asc on a new field', () => {
    const { result } = renderHook(() => useTorrentFilters([]));
    expect(result.current.sortBy).toBe('name');
    expect(result.current.sortOrder).toBe('asc');

    act(() => result.current.handleSort('name'));
    expect(result.current.sortOrder).toBe('desc');

    act(() => result.current.handleSort('name'));
    expect(result.current.sortOrder).toBe('asc');

    act(() => result.current.handleSort('size'));
    expect(result.current.sortBy).toBe('size');
    expect(result.current.sortOrder).toBe('asc');

    act(() => {
      result.current.handleSort('size');
    });
    expect(result.current.sortOrder).toBe('desc');
    act(() => {
      result.current.handleSort('progress');
    });
    expect(result.current.sortBy).toBe('progress');
    expect(result.current.sortOrder).toBe('asc');
  });

  it('state sort matches STATE_META priorities (downloading < uploading < paused < error)', () => {
    const torrents = [
      makeTorrent({ hash: 'err', state: 'error' }),
      makeTorrent({ hash: 'paus', state: 'pausedDL' }),
      makeTorrent({ hash: 'up', state: 'uploading' }),
      makeTorrent({ hash: 'dl', state: 'downloading' }),
    ];
    const { result } = renderHook(() => useTorrentFilters(torrents));
    act(() => result.current.handleSort('state'));

    expect(result.current.filteredAndSortedTorrents.map((t) => t.hash)).toEqual([
      'dl',
      'up',
      'paus',
      'err',
    ]);
  });
});
