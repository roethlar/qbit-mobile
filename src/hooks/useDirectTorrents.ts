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

interface TorrentsSnapshot {
  previous?: Torrent[];
}

export function useDirectTorrents() {
  return useQuery({
    queryKey: TORRENTS_KEY,
    queryFn: api.getTorrents,
    refetchInterval: (q) => (q.state.error ? false : 5000),
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
    refetchInterval: (q) => (q.state.error ? false : 5000),
    refetchOnReconnect: true,
    staleTime: 3000,
    placeholderData: (previousData) => previousData,
    retry: false,
  });
}

export function useDirectTorrentActions() {
  const queryClient = useQueryClient();

  async function snapshot(): Promise<TorrentsSnapshot> {
    await queryClient.cancelQueries({ queryKey: TORRENTS_KEY });
    return { previous: queryClient.getQueryData<Torrent[]>(TORRENTS_KEY) };
  }

  function patch(updater: (list: Torrent[]) => Torrent[]) {
    queryClient.setQueryData<Torrent[]>(TORRENTS_KEY, (old) =>
      old ? updater(old) : old,
    );
  }

  function rollback(ctx: TorrentsSnapshot | undefined) {
    if (ctx?.previous) queryClient.setQueryData(TORRENTS_KEY, ctx.previous);
  }

  const pauseTorrent = useMutation<unknown, Error, string, TorrentsSnapshot>({
    mutationFn: (hash) => api.pauseTorrent(hash),
    onMutate: async (hash) => {
      const snap = await snapshot();
      patch((list) =>
        list.map((t) =>
          t.hash === hash ? { ...t, state: optimisticPausedState(t.state) } : t,
        ),
      );
      return snap;
    },
    onError: (_err, _hash, ctx) => rollback(ctx),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
    },
  });

  const resumeTorrent = useMutation<unknown, Error, string, TorrentsSnapshot>({
    mutationFn: (hash) => api.resumeTorrent(hash),
    onMutate: async (hash) => {
      const snap = await snapshot();
      patch((list) =>
        list.map((t) =>
          t.hash === hash ? { ...t, state: optimisticResumedState(t.state) } : t,
        ),
      );
      return snap;
    },
    onError: (_err, _hash, ctx) => rollback(ctx),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
    },
  });

  const deleteTorrent = useMutation<
    unknown,
    Error,
    { hash: string; deleteFiles?: boolean },
    TorrentsSnapshot
  >({
    mutationFn: ({ hash, deleteFiles }) => api.deleteTorrent(hash, deleteFiles),
    onMutate: async ({ hash }) => {
      const snap = await snapshot();
      patch((list) => list.filter((t) => t.hash !== hash));
      return snap;
    },
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: () => {
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
    addTorrentUrl,
    addTorrentFile,
  };
}
