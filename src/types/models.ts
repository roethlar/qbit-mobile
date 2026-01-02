/**
 * Domain models with idiomatic TypeScript naming conventions
 * These models use camelCase and richer types for internal application use
 */

import type { Torrent, TorrentInfo, TorrentState } from './torrent';
import type { GlobalTransferInfo } from './globalTransfer';
import type { Preferences } from './preferences';

/**
 * Domain model for torrent with camelCase properties and richer types
 */
export interface TorrentModel {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  priority: number;
  seeds: number;
  peers: number;
  ratio: number;
  eta: number;
  state: TorrentState;
  category: string;
  tags: string[];
  savePath: string;
  contentPath: string;
  addedOn: Date;
  completionOn: Date | null;
  lastActivity: Date;
  downloadLimit: number;
  uploadLimit: number;
  downloaded: number;
  uploaded: number;
  downloadedSession: number;
  uploadedSession: number;
  amountLeft: number;
  completed: number;
  autoManaged: boolean;
  sequentialDownload: boolean;
  firstLastPiecePriority: boolean;
  forceStart: boolean;
  superSeeding: boolean;
  tracker: string;
  trackersCount: number;
  availability: number;
  seedingTime: number;
  timeActive: number;
  magnetUri: string;
  infoHashV1: string;
  infoHashV2?: string;
}

/**
 * Domain model for global transfer information
 */
export interface GlobalTransferModel {
  downloadSpeed: number;
  uploadSpeed: number;
  downloadedData: number;
  uploadedData: number;
  downloadedAllTime: number;
  uploadedAllTime: number;
  downloadRateLimit: number;
  uploadRateLimit: number;
  freeSpaceOnDisk: number;
  globalRatio: number;
  connectionStatus: 'connected' | 'firewalled' | 'disconnected';
  dhtNodes: number;
  peerConnections: number;
  queueing: boolean;
  useAltSpeedLimits: boolean;
  altDownloadLimit: number;
  altUploadLimit: number;
  refreshInterval: number;
  queuedIOJobs: number;
  averageTimeInQueue: number;
  totalBuffersSize: number;
  totalQueuedSize: number;
  wastedSessionData: number;
  readCacheHits: number;
  readCacheOverload: number;
  writeCacheOverload: number;
}

/**
 * Domain model for detailed torrent information
 */
export interface TorrentInfoModel {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  downloadSpeedAvg: number;
  uploadSpeedAvg: number;
  eta: number;
  seeds: number;
  seedsTotal: number;
  peers: number;
  peersTotal: number;
  shareRatio: number;
  connections: number;
  connectionsLimit: number;
  downloadLimit: number;
  uploadLimit: number;
  downloaded: number;
  uploaded: number;
  downloadedSession: number;
  uploadedSession: number;
  wastedData: number;
  savePath: string;
  comment: string;
  createdBy: string;
  isPrivate: boolean;
  pieceSize: number;
  piecesHave: number;
  piecesTotal: number;
  addedDate: Date;
  completionDate: Date | null;
  creationDate: Date;
  lastSeenComplete: Date | null;
  timeElapsed: number;
  seedingTime: number;
  reannounce: number;
  tracker: string;
  trackers: string[];
}

/**
 * Maps API torrent response to domain model
 */
export function mapTorrentToDomain(torrent: Torrent): TorrentModel {
  return {
    hash: torrent.hash,
    name: torrent.name,
    size: torrent.size,
    progress: torrent.progress,
    downloadSpeed: torrent.dlspeed,
    uploadSpeed: torrent.upspeed,
    priority: torrent.priority,
    seeds: torrent.num_seeds,
    peers: torrent.num_leechs,
    ratio: torrent.ratio,
    eta: torrent.eta,
    state: torrent.state,
    category: torrent.category,
    tags: torrent.tags ? torrent.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    savePath: torrent.save_path,
    contentPath: torrent.content_path,
    addedOn: new Date(torrent.added_on * 1000),
    completionOn: torrent.completion_on > 0 ? new Date(torrent.completion_on * 1000) : null,
    lastActivity: new Date(torrent.last_activity * 1000),
    downloadLimit: torrent.dl_limit,
    uploadLimit: torrent.up_limit,
    downloaded: torrent.downloaded,
    uploaded: torrent.uploaded,
    downloadedSession: torrent.downloaded_session,
    uploadedSession: torrent.uploaded_session,
    amountLeft: torrent.amount_left,
    completed: torrent.completed,
    autoManaged: torrent.auto_tmm,
    sequentialDownload: torrent.seq_dl,
    firstLastPiecePriority: torrent.f_l_piece_prio,
    forceStart: torrent.force_start,
    superSeeding: torrent.super_seeding,
    tracker: torrent.tracker,
    trackersCount: torrent.trackers_count,
    availability: torrent.availability,
    seedingTime: torrent.seeding_time,
    timeActive: torrent.time_active,
    magnetUri: torrent.magnet_uri,
    infoHashV1: torrent.infohash_v1,
    infoHashV2: torrent.infohash_v2
  };
}

/**
 * Maps API global transfer info to domain model
 */
export function mapGlobalTransferToDomain(info: GlobalTransferInfo): GlobalTransferModel {
  const parseRatio = (ratio: string): number => {
    const parsed = parseFloat(ratio);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parsePercentage = (percentage: string): number => {
    const parsed = parseFloat(percentage.replace('%', ''));
    return isNaN(parsed) ? 0 : parsed / 100;
  };

  const parseConnectionStatus = (status: string): 'connected' | 'firewalled' | 'disconnected' => {
    const normalized = status.toLowerCase();
    if (normalized.includes('connected')) return 'connected';
    if (normalized.includes('firewalled')) return 'firewalled';
    return 'disconnected';
  };

  return {
    downloadSpeed: info.dl_info_speed,
    uploadSpeed: info.up_info_speed,
    downloadedData: info.dl_info_data,
    uploadedData: info.up_info_data,
    downloadedAllTime: info.alltime_dl,
    uploadedAllTime: info.alltime_ul,
    downloadRateLimit: info.dl_rate_limit,
    uploadRateLimit: info.up_rate_limit,
    freeSpaceOnDisk: info.free_space_on_disk,
    globalRatio: parseRatio(info.global_ratio),
    connectionStatus: parseConnectionStatus(info.connection_status),
    dhtNodes: info.dht_nodes,
    peerConnections: info.total_peer_connections,
    queueing: info.queueing,
    useAltSpeedLimits: info.use_alt_speed_limits,
    altDownloadLimit: 0, // Not provided in GlobalTransferInfo
    altUploadLimit: 0, // Not provided in GlobalTransferInfo
    refreshInterval: info.refresh_interval,
    queuedIOJobs: info.queued_io_jobs,
    averageTimeInQueue: info.average_time_queue,
    totalBuffersSize: info.total_buffers_size,
    totalQueuedSize: info.total_queued_size,
    wastedSessionData: info.total_wasted_session,
    readCacheHits: parsePercentage(info.read_cache_hits),
    readCacheOverload: parsePercentage(info.read_cache_overload),
    writeCacheOverload: parsePercentage(info.write_cache_overload)
  };
}

/**
 * Maps API torrent info to domain model
 */
export function mapTorrentInfoToDomain(info: TorrentInfo): TorrentInfoModel {
  const progress = info.pieces_num > 0 ? info.pieces_have / info.pieces_num : 0;
  
  return {
    hash: info.hash,
    name: info.name,
    size: info.total_size,
    progress,
    downloadSpeed: info.dl_speed,
    uploadSpeed: info.up_speed,
    downloadSpeedAvg: info.dl_speed_avg,
    uploadSpeedAvg: info.up_speed_avg,
    eta: info.eta,
    seeds: info.seeds,
    seedsTotal: info.seeds_total,
    peers: info.peers,
    peersTotal: info.peers_total,
    shareRatio: info.share_ratio,
    connections: info.nb_connections,
    connectionsLimit: info.nb_connections_limit,
    downloadLimit: info.dl_limit,
    uploadLimit: info.up_limit,
    downloaded: info.total_downloaded,
    uploaded: info.total_uploaded,
    downloadedSession: info.total_downloaded_session,
    uploadedSession: info.total_uploaded_session,
    wastedData: info.total_wasted,
    savePath: info.save_path,
    comment: info.comment,
    createdBy: info.created_by,
    isPrivate: info.is_private,
    pieceSize: info.piece_size,
    piecesHave: info.pieces_have,
    piecesTotal: info.pieces_num,
    addedDate: new Date(info.addition_date * 1000),
    completionDate: info.completion_date > 0 ? new Date(info.completion_date * 1000) : null,
    creationDate: new Date(info.creation_date * 1000),
    lastSeenComplete: info.last_seen > 0 ? new Date(info.last_seen * 1000) : null,
    timeElapsed: info.time_elapsed,
    seedingTime: info.seeding_time,
    reannounce: info.reannounce,
    tracker: info.tracker,
    trackers: info.trackers ? info.trackers.split(',').map(t => t.trim()).filter(Boolean) : []
  };
}

/**
 * Maps domain model back to API format for updates
 */
export function mapDomainToTorrentUpdate(model: Partial<TorrentModel>): Record<string, any> {
  const update: Record<string, any> = {};
  
  if (model.downloadLimit !== undefined) update.dl_limit = model.downloadLimit;
  if (model.uploadLimit !== undefined) update.up_limit = model.uploadLimit;
  if (model.priority !== undefined) update.priority = model.priority;
  if (model.category !== undefined) update.category = model.category;
  if (model.tags !== undefined) update.tags = model.tags.join(',');
  if (model.savePath !== undefined) update.save_path = model.savePath;
  if (model.autoManaged !== undefined) update.auto_tmm = model.autoManaged;
  if (model.sequentialDownload !== undefined) update.seq_dl = model.sequentialDownload;
  if (model.firstLastPiecePriority !== undefined) update.f_l_piece_prio = model.firstLastPiecePriority;
  if (model.forceStart !== undefined) update.force_start = model.forceStart;
  if (model.superSeeding !== undefined) update.super_seeding = model.superSeeding;
  
  return update;
}