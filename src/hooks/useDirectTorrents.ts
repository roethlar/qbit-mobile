import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/directApi';
import type { Torrent, TorrentState } from '../types/qbittorrent';

const TORRENTS_KEY = ['torrents'] as const;
const GLOBAL_STATS_KEY = ['global-stats'] as const;

// Optimistic state transitions. We default to qB 5.x names ("stoppedDL");
// on legacy qB the server translates these, and the next poll will reconcile
// the row to whatever the upstream actually reports.
function optimisticPausedState(state: TorrentState): TorrentState {
  return state.endsWith('UP') ? 'stoppedUP' : 'stoppedDL';
}

function optimisticResumedState(state: TorrentState): TorrentState {
  return state.endsWith('UP') ? 'uploading' : 'downloading';
}

// Per-hash snapshot so concurrent mutations don't trample each other.
// A full-list rollback would undo other optimistic updates that were still
// in flight when this mutation failed.
interface HashSnapshot {
  hash: string;
  previous: Torrent | null;
}

// While healthy we poll every 5s. While the upstream is failing we back off
// to 30s so the UI still self-recovers when the server comes back — but
// without hammering the server during an outage.
const POLL_OK_MS = 5_000;
const POLL_ERROR_MS = 30_000;

export function useDirectTorrents() {
  return useQuery({
    queryKey: TORRENTS_KEY,
    queryFn: api.getTorrents,
    refetchInterval: (q) => (q.state.error ? POLL_ERROR_MS : POLL_OK_MS),
    refetchOnReconnect: true,
    staleTime: 3000,
    placeholderData: (previousData) => previousData,
    retry: false,
  });
}

export function useDirectGlobalStats() {
  return useQuery({
    queryKey: GLOBAL_STATS_KEY,
    queryFn: api.getGlobalStats,
    refetchInterval: (q) => (q.state.error ? POLL_ERROR_MS : POLL_OK_MS),
    refetchOnReconnect: true,
    staleTime: 3000,
    placeholderData: (previousData) => previousData,
    retry: false,
  });
}

export function useDirectTorrentActions() {
  const queryClient = useQueryClient();

  async function snapshotHash(hash: string): Promise<HashSnapshot> {
    await queryClient.cancelQueries({ queryKey: TORRENTS_KEY });
    const list = queryClient.getQueryData<Torrent[]>(TORRENTS_KEY) ?? [];
    return { hash, previous: list.find((t) => t.hash === hash) ?? null };
  }

  function patch(updater: (list: Torrent[]) => Torrent[]) {
    queryClient.setQueryData<Torrent[]>(TORRENTS_KEY, (old) =>
      old ? updater(old) : old,
    );
  }

  function revertHash(ctx: HashSnapshot | undefined) {
    if (!ctx) return;
    const restore = ctx.previous;
    patch((list) => {
      if (restore) {
        const hasIt = list.some((t) => t.hash === restore.hash);
        return hasIt
          ? list.map((t) => (t.hash === restore.hash ? restore : t))
          : [...list, restore];
      }
      return list.filter((t) => t.hash !== ctx.hash);
    });
  }

  const pauseTorrent = useMutation<unknown, Error, string, HashSnapshot>({
    mutationFn: (hash) => api.pauseTorrent(hash),
    onMutate: async (hash) => {
      const snap = await snapshotHash(hash);
      patch((list) =>
        list.map((t) =>
          t.hash === hash ? { ...t, state: optimisticPausedState(t.state) } : t,
        ),
      );
      return snap;
    },
    onError: (_err, _hash, ctx) => revertHash(ctx),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
    },
  });

  const resumeTorrent = useMutation<unknown, Error, string, HashSnapshot>({
    mutationFn: (hash) => api.resumeTorrent(hash),
    onMutate: async (hash) => {
      const snap = await snapshotHash(hash);
      patch((list) =>
        list.map((t) =>
          t.hash === hash ? { ...t, state: optimisticResumedState(t.state) } : t,
        ),
      );
      return snap;
    },
    onError: (_err, _hash, ctx) => revertHash(ctx),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
    },
  });

  const deleteTorrent = useMutation<
    unknown,
    Error,
    { hash: string; deleteFiles?: boolean },
    HashSnapshot
  >({
    mutationFn: ({ hash, deleteFiles }) => api.deleteTorrent(hash, deleteFiles),
    onMutate: async ({ hash }) => {
      const snap = await snapshotHash(hash);
      patch((list) => list.filter((t) => t.hash !== hash));
      return snap;
    },
    onError: (_err, _vars, ctx) => revertHash(ctx),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
      queryClient.invalidateQueries({ queryKey: GLOBAL_STATS_KEY });
    },
  });

  // Bulk variants. We skip optimistic patching here: a 50-row diff is harder
  // to roll back cleanly, and the user already sees the action button spinner
  // until the next 5s poll arrives.
  const pauseTorrents = useMutation({
    mutationFn: (hashes: string[]) => api.pauseTorrents(hashes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
    },
  });

  const resumeTorrents = useMutation({
    mutationFn: (hashes: string[]) => api.resumeTorrents(hashes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
    },
  });

  const deleteTorrents = useMutation({
    mutationFn: ({ hashes, deleteFiles }: { hashes: string[]; deleteFiles?: boolean }) =>
      api.deleteTorrents(hashes, deleteFiles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
      queryClient.invalidateQueries({ queryKey: GLOBAL_STATS_KEY });
    },
  });

  const addTorrentUrl = useMutation({
    mutationFn: ({ url, options }: { url: string; options?: api.AddTorrentOptions }) =>
      api.addTorrentUrl(url, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
    },
  });

  const addTorrentFile = useMutation({
    mutationFn: ({ file, options }: { file: File; options?: api.AddTorrentOptions }) =>
      api.addTorrentFile(file, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
    },
  });

  return {
    pauseTorrent,
    resumeTorrent,
    deleteTorrent,
    pauseTorrents,
    resumeTorrents,
    deleteTorrents,
    addTorrentUrl,
    addTorrentFile,
  };
}
