import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Torrent, TorrentState } from '../types/qbittorrent';

// Mock the direct API surface so mutations don't try to make real HTTP calls.
vi.mock('../services/directApi', () => ({
  pauseTorrent: vi.fn(),
  resumeTorrent: vi.fn(),
  deleteTorrent: vi.fn(),
  pauseTorrents: vi.fn(),
  resumeTorrents: vi.fn(),
  deleteTorrents: vi.fn(),
  setTorrentLocation: vi.fn(),
  addTorrentUrl: vi.fn(),
  addTorrentFile: vi.fn(),
  getTorrents: vi.fn(),
  getGlobalStats: vi.fn(),
  getLocationPresets: vi.fn(),
  putLocationPresets: vi.fn(),
}));

import * as api from '../services/directApi';
import { useDirectTorrentActions } from './useDirectTorrents';

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

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      // Keep cache alive across the test — gcTime:0 would garbage-collect
      // the seeded list as soon as the only observer (the mutation) finishes.
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useDirectTorrentActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pauseTorrent applies an optimistic patch and reverts on error', async () => {
    const client = makeClient();
    const initial = [
      makeTorrent({ hash: 'a', name: 'A', state: 'downloading' }),
      makeTorrent({ hash: 'b', name: 'B', state: 'downloading' }),
    ];
    client.setQueryData(['torrents'], initial);

    // Hold the rejection until we've observed the optimistic patch — otherwise
    // onMutate -> onError races through synchronously and the patch is gone
    // before any waitFor runs.
    let reject!: (e: Error) => void;
    vi.mocked(api.pauseTorrent).mockImplementationOnce(
      () => new Promise<void>((_res, rej) => { reject = rej; }),
    );

    const { result } = renderHook(() => useDirectTorrentActions(), {
      wrapper: wrap(client),
    });

    result.current.pauseTorrent.mutate('a');

    await waitFor(() => {
      const list = client.getQueryData<Torrent[]>(['torrents']);
      expect(list?.find((t) => t.hash === 'a')?.state).toBe('stoppedDL');
    });
    // The other hash must not be touched.
    expect(
      client.getQueryData<Torrent[]>(['torrents'])?.find((t) => t.hash === 'b')?.state,
    ).toBe('downloading');

    reject(new Error('boom'));

    await waitFor(() => expect(result.current.pauseTorrent.isError).toBe(true));

    const list = client.getQueryData<Torrent[]>(['torrents']);
    expect(list?.find((t) => t.hash === 'a')?.state).toBe('downloading');
  });

  it('resumeTorrent applies an optimistic patch and reverts on error', async () => {
    const client = makeClient();
    const initial = [
      makeTorrent({ hash: 'a', name: 'A', state: 'stoppedDL' }),
    ];
    client.setQueryData(['torrents'], initial);

    let reject!: (e: Error) => void;
    vi.mocked(api.resumeTorrent).mockImplementationOnce(
      () => new Promise<void>((_res, rej) => { reject = rej; }),
    );

    const { result } = renderHook(() => useDirectTorrentActions(), {
      wrapper: wrap(client),
    });

    result.current.resumeTorrent.mutate('a');

    await waitFor(() => {
      const list = client.getQueryData<Torrent[]>(['torrents']);
      expect(list?.find((t) => t.hash === 'a')?.state).toBe('downloading');
    });

    reject(new Error('boom'));

    await waitFor(() => expect(result.current.resumeTorrent.isError).toBe(true));

    const list = client.getQueryData<Torrent[]>(['torrents']);
    expect(list?.find((t) => t.hash === 'a')?.state).toBe('stoppedDL');
  });

  it('deleteTorrent removes the torrent optimistically and restores on error', async () => {
    const client = makeClient();
    const initial = [
      makeTorrent({ hash: 'a' }),
      makeTorrent({ hash: 'b' }),
    ];
    client.setQueryData(['torrents'], initial);

    let reject!: (e: Error) => void;
    vi.mocked(api.deleteTorrent).mockImplementationOnce(
      () => new Promise<void>((_res, rej) => { reject = rej; }),
    );

    const { result } = renderHook(() => useDirectTorrentActions(), {
      wrapper: wrap(client),
    });

    result.current.deleteTorrent.mutate({ hash: 'a' });

    await waitFor(() => {
      const list = client.getQueryData<Torrent[]>(['torrents']) ?? [];
      expect(list.find((t) => t.hash === 'a')).toBeUndefined();
    });

    reject(new Error('nope'));

    await waitFor(() => expect(result.current.deleteTorrent.isError).toBe(true));

    const list = client.getQueryData<Torrent[]>(['torrents']) ?? [];
    expect(list.find((t) => t.hash === 'a')).toBeDefined();
  });

  it('bulk pauseTorrents invalidates torrents on settle for both success and failure', async () => {
    const client = makeClient();
    client.setQueryData(['torrents'], [makeTorrent({ hash: 'a' })]);
    const spy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDirectTorrentActions(), {
      wrapper: wrap(client),
    });

    vi.mocked(api.pauseTorrents).mockResolvedValueOnce(undefined);
    result.current.pauseTorrents.mutate(['a']);
    await waitFor(() => expect(result.current.pauseTorrents.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['torrents'] });

    spy.mockClear();
    vi.mocked(api.pauseTorrents).mockRejectedValueOnce(new Error('boom'));
    result.current.pauseTorrents.mutate(['a']);
    await waitFor(() => expect(result.current.pauseTorrents.isError).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['torrents'] });
  });
});
