import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qbApi } from '../services/api';
import type { Torrent, GlobalTransferInfo } from '../types/qbittorrent';
import type { AddTorrentOptions } from '../components/AddTorrent';

export function useTorrents(filter?: string) {
  return useQuery({
    queryKey: ['torrents', filter],
    queryFn: () => qbApi.getTorrents(filter),
    refetchInterval: 5000, // Update every 5 seconds (slower for large lists)
    staleTime: 3000,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useGlobalStats() {
  return useQuery({
    queryKey: ['global-stats'],
    queryFn: () => qbApi.getGlobalTransferInfo(),
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

export function useTorrentActions() {
  const queryClient = useQueryClient();

  const pauseTorrent = useMutation({
    mutationFn: (hash: string) => qbApi.pauseTorrent(hash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const resumeTorrent = useMutation({
    mutationFn: (hash: string) => qbApi.resumeTorrent(hash),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
    },
  });

  const deleteTorrent = useMutation({
    mutationFn: ({ hash, deleteFiles }: { hash: string; deleteFiles?: boolean }) => 
      qbApi.deleteTorrent(hash, deleteFiles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.invalidateQueries({ queryKey: ['global-stats'] });
    },
  });

  const addTorrentUrl = useMutation({
    mutationFn: ({ url, options }: { url: string; options?: AddTorrentOptions }) => 
      qbApi.addTorrent(url, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.invalidateQueries({ queryKey: ['global-stats'] });
    },
  });

  const addTorrentFile = useMutation({
    mutationFn: ({ file, options }: { file: File; options?: AddTorrentOptions }) => 
      qbApi.addTorrent(file, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['torrents'] });
      queryClient.invalidateQueries({ queryKey: ['global-stats'] });
    },
  });

  const setGlobalDownloadLimit = useMutation({
    mutationFn: (limit: number) => qbApi.setGlobalDownloadLimit(limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-stats'] });
    },
  });

  const setGlobalUploadLimit = useMutation({
    mutationFn: (limit: number) => qbApi.setGlobalUploadLimit(limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-stats'] });
    },
  });

  return {
    pauseTorrent,
    resumeTorrent,
    deleteTorrent,
    addTorrentUrl,
    addTorrentFile,
    setGlobalDownloadLimit,
    setGlobalUploadLimit,
  };
}