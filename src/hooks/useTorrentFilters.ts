import { useState, useMemo, useEffect } from 'react';
import type { Torrent } from '../types/qbittorrent';
import { getStateText } from '../utils/formatters';

export type SortField = 'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'added_on' | 'state';
export type SortOrder = 'asc' | 'desc';

export function useTorrentFilters(torrents: Torrent[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>(() => {
    const saved = localStorage.getItem('qbit-sort-by');
    return (saved as SortField) || 'name';
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = localStorage.getItem('qbit-sort-order');
    return (saved as SortOrder) || 'asc';
  });
  const [selectedTag, setSelectedTag] = useState<string>(() => {
    return localStorage.getItem('qbit-selected-tag') || '';
  });
  const itemsPerPage = 5000;

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    torrents.forEach(torrent => {
      if (torrent.tags) {
        torrent.tags.split(',').forEach(tag => {
          const trimmedTag = tag.trim();
          if (trimmedTag) tagSet.add(trimmedTag);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [torrents]);

  const filteredAndSortedTorrents = useMemo(() => {
    let filtered = torrents;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(torrent =>
        torrent.name.toLowerCase().includes(query) ||
        torrent.category.toLowerCase().includes(query) ||
        torrent.tags.toLowerCase().includes(query) ||
        getStateText(torrent.state).toLowerCase().includes(query)
      );
    }

    if (selectedTag) {
      filtered = filtered.filter(torrent =>
        torrent.tags.split(',').map(t => t.trim()).includes(selectedTag)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number, bValue: string | number;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'progress':
          aValue = a.progress;
          bValue = b.progress;
          break;
        case 'dlspeed':
          aValue = a.dlspeed;
          bValue = b.dlspeed;
          break;
        case 'upspeed':
          aValue = a.upspeed;
          bValue = b.upspeed;
          break;
        case 'added_on':
          aValue = a.added_on;
          bValue = b.added_on;
          break;
        case 'state':
          aValue = getStateText(a.state);
          bValue = getStateText(b.state);
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue);
      } else {
        return sortOrder === 'asc'
          ? aValue - (bValue as number)
          : (bValue as number) - aValue;
      }
    });

    return sorted;
  }, [torrents, searchQuery, selectedTag, sortBy, sortOrder]);

  const paginatedTorrents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedTorrents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedTorrents, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedTorrents.length / itemsPerPage);

  useEffect(() => {
    localStorage.setItem('qbit-sort-by', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('qbit-sort-order', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem('qbit-selected-tag', selectedTag);
  }, [selectedTag]);

  const handleSort = (newSortBy: SortField) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  return {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    sortBy,
    sortOrder,
    selectedTag,
    setSelectedTag,
    availableTags,
    filteredAndSortedTorrents,
    paginatedTorrents,
    totalPages,
    handleSort,
  };
}
