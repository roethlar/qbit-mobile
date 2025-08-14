import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/simpleApi';

export function useSimpleTorrents() {
  return useQuery({
    queryKey: ['torrents'],
    queryFn: api.getTorrents,
    refetchInterval: 5000,
    staleTime: 3000,
  });
}

export function useSimpleGlobalStats() {
  return useQuery({
    queryKey: ['global-stats'],
    queryFn: api.getGlobalStats,
    refetchInterval: 5000,
    staleTime: 3000,
  });
}

export function useSimpleTorrentActions() {
  const queryClient = useQueryClient();

  const pauseTorrent = useMutation({
    mutationFn: (hash: string) => api.pauseTorrent(hash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const resumeTorrent = useMutation({
    mutationFn: (hash: string) => api.resumeTorrent(hash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const deleteTorrent = useMutation({
    mutationFn: ({ hash, deleteFiles }: { hash: string; deleteFiles?: boolean }) => 
      api.deleteTorrent(hash, deleteFiles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const addTorrentUrl = useMutation({
    mutationFn: (url: string) => api.addTorrentUrl(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const addTorrentFile = useMutation({
    mutationFn: (file: File) => api.addTorrentFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
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