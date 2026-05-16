import { useState, useMemo, useEffect } from 'react';
import type { Torrent } from '../types/qbittorrent';
import { STATE_PRIORITY, getStateText } from '../utils/formatters';

const SORT_FIELDS = ['name', 'size', 'progress', 'dlspeed', 'upspeed', 'added_on', 'state'] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortField = typeof SORT_FIELDS[number];
export type SortOrder = typeof SORT_ORDERS[number];

export function useTorrentFilters(torrents: Torrent[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>(() => {
    const saved = localStorage.getItem('qbit-sort-by');
    return SORT_FIELDS.includes(saved as SortField) ? (saved as SortField) : 'name';
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = localStorage.getItem('qbit-sort-order');
    return SORT_ORDERS.includes(saved as SortOrder) ? (saved as SortOrder) : 'asc';
  });
  const [selectedTag, setSelectedTag] = useState<string>(() => {
    return localStorage.getItem('qbit-selected-tag') || '';
  });

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
          aValue = STATE_PRIORITY[a.state] ?? 99;
          bValue = STATE_PRIORITY[b.state] ?? 99;
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
  };

  return {
    searchQuery,
    setSearchQuery,
    sortBy,
    sortOrder,
    selectedTag,
    setSelectedTag,
    availableTags,
    filteredAndSortedTorrents,
    handleSort,
  };
}
