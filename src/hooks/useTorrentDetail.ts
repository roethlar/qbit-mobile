import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/directApi';

const TORRENTS_KEY = ['torrents'] as const;

function detailKey(hash: string, leaf: 'properties' | 'files' | 'trackers') {
  return ['torrent', hash, leaf] as const;
}

// While the detail drawer is open we poll the per-torrent endpoints; the
// general/properties pane updates fast, files and trackers change rarely.
const POLL_FAST = 5_000;
const POLL_SLOW = 10_000;

export function useTorrentDetail(hash: string | null) {
  const enabled = !!hash;
  const properties = useQuery({
    queryKey: enabled ? detailKey(hash!, 'properties') : ['torrent', '', 'properties'],
    queryFn: () => api.getTorrentProperties(hash!),
    enabled,
    refetchInterval: (q) => (q.state.error ? false : POLL_FAST),
    refetchOnReconnect: true,
    staleTime: 3_000,
    placeholderData: (prev) => prev,
    retry: false,
  });
  const files = useQuery({
    queryKey: enabled ? detailKey(hash!, 'files') : ['torrent', '', 'files'],
    queryFn: () => api.getTorrentFiles(hash!),
    enabled,
    refetchInterval: (q) => (q.state.error ? false : POLL_SLOW),
    refetchOnReconnect: true,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
    retry: false,
  });
  const trackers = useQuery({
    queryKey: enabled ? detailKey(hash!, 'trackers') : ['torrent', '', 'trackers'],
    queryFn: () => api.getTorrentTrackers(hash!),
    enabled,
    refetchInterval: (q) => (q.state.error ? false : POLL_SLOW),
    refetchOnReconnect: true,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
    retry: false,
  });
  return { properties, files, trackers };
}

export function useTorrentDetailActions() {
  const queryClient = useQueryClient();

  const recheck = useMutation({
    mutationFn: (hash: string) => api.recheckTorrent(hash),
    onSuccess: (_data, hash) => {
      queryClient.invalidateQueries({ queryKey: ['torrent', hash] });
      queryClient.invalidateQueries({ queryKey: TORRENTS_KEY });
    },
  });

  const reannounce = useMutation({
    mutationFn: (hash: string) => api.reannounceTorrent(hash),
    onSuccess: (_data, hash) => {
      queryClient.invalidateQueries({ queryKey: detailKey(hash, 'trackers') });
    },
  });

  return { recheck, reannounce };
}
