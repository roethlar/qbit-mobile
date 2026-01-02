/**
 * Global transfer statistics and information from qBittorrent
 */
export interface GlobalTransferInfo {
  /** All-time downloaded data in bytes */
  alltime_dl: number;
  /** All-time uploaded data in bytes */
  alltime_ul: number;
  /** Average time torrents spend in queue in seconds */
  average_time_queue: number;
  /** Connection status (e.g., "connected", "firewalled") */
  connection_status: string;
  /** Number of DHT nodes */
  dht_nodes: number;
  /** Downloaded data in current session in bytes */
  dl_info_data: number;
  /** Current global download speed in bytes/s */
  dl_info_speed: number;
  /** Global download rate limit in bytes/s */
  dl_rate_limit: number;
  /** Free space on disk in bytes */
  free_space_on_disk: number;
  /** Global share ratio as string */
  global_ratio: string;
  /** Number of queued I/O jobs */
  queued_io_jobs: number;
  /** Whether queueing system is enabled */
  queueing: boolean;
  /** Read cache hit percentage as string */
  read_cache_hits: string;
  /** Read cache overload percentage as string */
  read_cache_overload: string;
  /** Refresh interval in milliseconds */
  refresh_interval: number;
  /** Total buffer size in bytes */
  total_buffers_size: number;
  /** Total number of peer connections */
  total_peer_connections: number;
  /** Total size of queued data in bytes */
  total_queued_size: number;
  /** Total wasted data in current session in bytes */
  total_wasted_session: number;
  /** Uploaded data in current session in bytes */
  up_info_data: number;
  /** Current global upload speed in bytes/s */
  up_info_speed: number;
  /** Global upload rate limit in bytes/s */
  up_rate_limit: number;
  /** Whether alternative speed limits are active */
  use_alt_speed_limits: boolean;
  /** Write cache overload percentage as string */
  write_cache_overload: string;
}