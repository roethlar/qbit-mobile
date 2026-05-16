import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/directApi';

export function useDirectTorrents() {
  return useQuery({
    queryKey: ['torrents'],
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
    queryKey: ['global-stats'],
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
    mutationFn: ({ url, options }: { url: string; options?: api.AddTorrentOptions }) => 
      api.addTorrentUrl(url, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const addTorrentFile = useMutation({
    mutationFn: ({ file, options }: { file: File; options?: api.AddTorrentOptions }) => 
      api.addTorrentFile(file, options),
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