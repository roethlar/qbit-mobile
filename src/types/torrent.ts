/**
 * Known torrent states from qBittorrent API
 */
export const TORRENT_STATES = [
  'allocating',
  'downloading',
  'metaDL',
  'pausedDL',
  'pausedUP',
  'queuedDL',
  'queuedUP',
  'stalledDL',
  'stalledUP',
  'uploading',
  'forcedDL',
  'forcedUP',
  'checkingDL',
  'checkingUP',
  'checkingResumeData',
  'error',
  'missingFiles',
  'unknown'
] as const;

/**
 * Torrent state type derived from known states
 */
export type TorrentState = typeof TORRENT_STATES[number];

/**
 * Torrent information from qBittorrent API
 */
export interface Torrent {
  /** Unix timestamp when torrent was added */
  added_on: number;
  /** Amount of data left to download in bytes */
  amount_left: number;
  /** Whether automatic torrent management is enabled */
  auto_tmm: boolean;
  /** Percentage of file pieces currently available (0-1) */
  availability: number;
  /** Torrent category */
  category: string;
  /** Amount of data downloaded in bytes */
  completed: number;
  /** Unix timestamp when torrent completed downloading */
  completion_on: number;
  /** Path to torrent content */
  content_path: string;
  /** Download speed limit in bytes/s (-1 for unlimited) */
  dl_limit: number;
  /** Current download speed in bytes/s */
  dlspeed: number;
  /** Total amount downloaded for this torrent in bytes */
  downloaded: number;
  /** Amount downloaded this session in bytes */
  downloaded_session: number;
  /** Estimated time to completion in seconds */
  eta: number;
  /** Whether first and last pieces are prioritized */
  f_l_piece_prio: boolean;
  /** Whether forced start is enabled */
  force_start: boolean;
  /** Torrent hash */
  hash: string;
  /** Maximum inactive seeding time in seconds */
  inactive_seeding_time_limit: number;
  /** Info hash v1 */
  infohash_v1: string;
  /** Info hash v2 */
  infohash_v2?: string;
  /** Unix timestamp of last activity */
  last_activity: number;
  /** Magnet URI for this torrent */
  magnet_uri: string;
  /** Maximum inactive seeding time in seconds */
  max_inactive_seeding_time: number;
  /** Maximum share ratio */
  max_ratio: number;
  /** Maximum seeding time in seconds */
  max_seeding_time: number;
  /** Torrent name */
  name: string;
  /** Number of seeds in the swarm */
  num_complete: number;
  /** Number of leechers in the swarm */
  num_incomplete: number;
  /** Number of connected leechers */
  num_leechs: number;
  /** Number of connected seeds */
  num_seeds: number;
  /** Queue priority */
  priority: number;
  /** Download progress (0-1) */
  progress: number;
  /** Share ratio */
  ratio: number;
  /** Share ratio limit */
  ratio_limit: number;
  /** Save path for downloaded files */
  save_path: string;
  /** Total seeding time in seconds */
  seeding_time: number;
  /** Seeding time limit in seconds */
  seeding_time_limit: number;
  /** Unix timestamp when torrent was last seen complete */
  seen_complete: number;
  /** Whether sequential download is enabled */
  seq_dl: boolean;
  /** Torrent size in bytes */
  size: number;
  /** Current torrent state */
  state: TorrentState;
  /** Whether super seeding is enabled */
  super_seeding: boolean;
  /** Comma-separated list of tags */
  tags: string;
  /** Total active time in seconds */
  time_active: number;
  /** Total size including unselected files in bytes */
  total_size: number;
  /** Main tracker URL */
  tracker: string;
  /** Number of trackers */
  trackers_count: number;
  /** Upload speed limit in bytes/s (-1 for unlimited) */
  up_limit: number;
  /** Total amount uploaded in bytes */
  uploaded: number;
  /** Amount uploaded this session in bytes */
  uploaded_session: number;
  /** Current upload speed in bytes/s */
  upspeed: number;
}

/**
 * Detailed torrent information from API
 */
export interface TorrentInfo {
  /** Unix timestamp when torrent was added */
  addition_date: number;
  /** Torrent comment */
  comment: string;
  /** Unix timestamp when torrent completed */
  completion_date: number;
  /** Creator of the torrent */
  created_by: string;
  /** Unix timestamp when torrent was created */
  creation_date: number;
  /** Download speed limit in bytes/s */
  dl_limit: number;
  /** Current download speed in bytes/s */
  dl_speed: number;
  /** Average download speed in bytes/s */
  dl_speed_avg: number;
  /** Estimated time to completion in seconds */
  eta: number;
  /** Torrent hash */
  hash: string;
  /** Whether torrent is private */
  is_private: boolean;
  /** Unix timestamp when torrent was last seen */
  last_seen: number;
  /** Torrent name */
  name: string;
  /** Current number of connections */
  nb_connections: number;
  /** Connection limit */
  nb_connections_limit: number;
  /** Current number of peers */
  peers: number;
  /** Total number of peers */
  peers_total: number;
  /** Size of pieces in bytes */
  piece_size: number;
  /** Number of pieces downloaded */
  pieces_have: number;
  /** Total number of pieces */
  pieces_num: number;
  /** Time until next tracker reannounce in seconds */
  reannounce: number;
  /** Save path for downloaded files */
  save_path: string;
  /** Total seeding time in seconds */
  seeding_time: number;
  /** Current number of seeds */
  seeds: number;
  /** Total number of seeds */
  seeds_total: number;
  /** Share ratio */
  share_ratio: number;
  /** Time elapsed since start in seconds */
  time_elapsed: number;
  /** Total downloaded in bytes */
  total_downloaded: number;
  /** Total downloaded this session in bytes */
  total_downloaded_session: number;
  /** Total size in bytes */
  total_size: number;
  /** Total uploaded in bytes */
  total_uploaded: number;
  /** Total uploaded this session in bytes */
  total_uploaded_session: number;
  /** Total wasted data in bytes */
  total_wasted: number;
  /** Main tracker URL */
  tracker: string;
  /** Comma-separated list of tracker URLs */
  trackers: string;
  /** Upload speed limit in bytes/s */
  up_limit: number;
  /** Current upload speed in bytes/s */
  up_speed: number;
  /** Average upload speed in bytes/s */
  up_speed_avg: number;
}