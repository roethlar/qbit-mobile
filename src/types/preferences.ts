/**
 * qBittorrent preferences and configuration settings
 */
export interface Preferences {
  /** UI locale/language code (e.g., "en_US") */
  locale: string;
  
  // Downloads settings
  /** Whether to create subfolder for multi-file torrents */
  create_subfolder_enabled: boolean;
  /** Whether to start torrents in paused state */
  start_paused_enabled: boolean;
  /** Auto delete mode (0: disabled, 1: delete files, 2: delete files + .torrent) */
  auto_delete_mode: number;
  /** Whether to preallocate disk space for all files */
  preallocate_all: boolean;
  /** Whether to append .!qB extension to incomplete files */
  incomplete_files_ext: boolean;
  
  // Automatic Torrent Management
  /** Whether Automatic Torrent Management is enabled globally */
  auto_tmm_enabled: boolean;
  /** Whether to relocate torrent when its category changes */
  torrent_changed_tmm_enabled: boolean;
  /** Whether to relocate torrent when default save path changes */
  save_path_changed_tmm_enabled: boolean;
  /** Whether to relocate torrent when its category save path changes */
  category_changed_tmm_enabled: boolean;
  
  // Paths
  /** Default save path for downloads */
  save_path: string;
  /** Whether to use temporary path for incomplete downloads */
  temp_path_enabled: boolean;
  /** Path for incomplete downloads */
  temp_path: string;
  /** Watched folders (path -> download behavior: 0=monitor, 1=default save path, 2=custom path) */
  scan_dirs: Record<string, number>;
  /** Directory to copy .torrent files to */
  export_dir: string;
  /** Directory to copy .torrent files of completed downloads to */
  export_dir_fin: string;
  
  // Email notifications
  /** Whether email notifications are enabled */
  mail_notification_enabled: boolean;
  /** Sender email address */
  mail_notification_sender: string;
  /** Recipient email address */
  mail_notification_email: string;
  /** SMTP server address */
  mail_notification_smtp: string;
  /** Whether to use SSL for SMTP */
  mail_notification_ssl_enabled: boolean;
  /** Whether SMTP authentication is required */
  mail_notification_auth_enabled: boolean;
  /** SMTP username */
  mail_notification_username: string;
  /** SMTP password */
  mail_notification_password: string;
  
  // Run external program
  /** Whether to run external program on torrent completion */
  autorun_enabled: boolean;
  /** Command to run on torrent completion */
  autorun_program: string;
  
  // Queueing system
  /** Whether torrent queueing is enabled */
  queueing_enabled: boolean;
  /** Maximum number of active downloads */
  max_active_downloads: number;
  /** Maximum number of active torrents (downloads + uploads) */
  max_active_torrents: number;
  /** Maximum number of active uploads */
  max_active_uploads: number;
  /** Whether to exclude slow torrents from queue limits */
  dont_count_slow_torrents: boolean;
  /** Download rate threshold for slow torrents in KiB/s */
  slow_torrent_dl_rate_threshold: number;
  /** Upload rate threshold for slow torrents in KiB/s */
  slow_torrent_ul_rate_threshold: number;
  /** Time in seconds a torrent should be inactive before considered slow */
  slow_torrent_inactive_timer: number;
  
  // Share ratio limiting
  /** Whether share ratio limiting is enabled */
  max_ratio_enabled: boolean;
  /** Maximum share ratio */
  max_ratio: number;
  /** Action when ratio is reached (0: pause, 1: remove) */
  max_ratio_act: number;
  
  // Connection settings
  /** Port for incoming connections */
  listen_port: number;
  /** Whether to use UPnP/NAT-PMP port forwarding */
  upnp: boolean;
  /** Whether to use random port on startup */
  random_port: boolean;
  /** Global download rate limit in KiB/s (0: unlimited) */
  dl_limit: number;
  /** Global upload rate limit in KiB/s (0: unlimited) */
  up_limit: number;
  /** Maximum number of connections globally */
  max_connec: number;
  /** Maximum number of connections per torrent */
  max_connec_per_torrent: number;
  /** Maximum number of upload slots globally */
  max_uploads: number;
  /** Maximum number of upload slots per torrent */
  max_uploads_per_torrent: number;
  /** Timeout in seconds for stopped trackers */
  stop_tracker_timeout: number;
  /** Whether to enable piece extent affinity */
  enable_piece_extent_affinity: boolean;
  /** BitTorrent protocol to use (0: TCP+uTP, 1: TCP, 2: uTP) */
  bittorrent_protocol: number;
  /** Whether to apply rate limit to uTP connections */
  limit_utp_rate: boolean;
  /** Whether to apply rate limit to transport overhead */
  limit_tcp_overhead: boolean;
  /** Whether to apply rate limit to peers on LAN */
  limit_lan_peers: boolean;
  
  // Alternative rate limits
  /** Alternative download rate limit in KiB/s */
  alt_dl_limit: number;
  /** Alternative upload rate limit in KiB/s */
  alt_up_limit: number;
  /** Whether scheduled times for alternative rate limits are enabled */
  scheduler_enabled: boolean;
  /** Start hour for alternative rate limits (0-23) */
  schedule_from_hour: number;
  /** Start minute for alternative rate limits (0-59) */
  schedule_from_min: number;
  /** End hour for alternative rate limits (0-23) */
  schedule_to_hour: number;
  /** End minute for alternative rate limits (0-59) */
  schedule_to_min: number;
  /** Days when scheduler is active (bitmask: 1=Mon, 2=Tue, 4=Wed, etc.) */
  scheduler_days: number;
  
  // BitTorrent features
  /** Whether DHT is enabled */
  dht: boolean;
  /** Whether Peer Exchange (PeX) is enabled */
  pex: boolean;
  /** Whether Local Peer Discovery is enabled */
  lsd: boolean;
  /** Encryption mode (0: prefer, 1: force on, 2: force off) */
  encryption: number;
  /** Whether anonymous mode is enabled */
  anonymous_mode: boolean;
  
  // Proxy settings
  /** Proxy type (0: None, 1: SOCKS4, 2: SOCKS5, 3: HTTP) */
  proxy_type: number;
  /** Proxy server IP/hostname */
  proxy_ip: string;
  /** Proxy server port */
  proxy_port: number;
  /** Whether to use proxy for peer connections */
  proxy_peer_connections: boolean;
  /** Whether proxy requires authentication */
  proxy_auth_enabled: boolean;
  /** Proxy username */
  proxy_username: string;
  /** Proxy password */
  proxy_password: string;
  /** Whether to use proxy only for torrents */
  proxy_torrents_only: boolean;
  
  // IP filtering
  /** Whether IP filtering is enabled */
  ip_filter_enabled: boolean;
  /** Path to IP filter file */
  ip_filter_path: string;
  /** Whether to apply IP filter to trackers */
  ip_filter_trackers: boolean;
  
  // Web UI settings
  /** Comma-separated whitelist of domains for CORS */
  web_ui_domain_list: string;
  /** IP address to bind Web UI to */
  web_ui_address: string;
  /** Port for Web UI */
  web_ui_port: number;
  /** Whether to use UPnP for Web UI port */
  web_ui_upnp: boolean;
  /** Web UI username */
  web_ui_username: string;
  /** Web UI password (write-only, returns empty on read) */
  web_ui_password: string;
  /** Whether CSRF protection is enabled */
  web_ui_csrf_protection_enabled: boolean;
  /** Whether clickjacking protection is enabled */
  web_ui_clickjacking_protection_enabled: boolean;
  /** Whether secure cookie flag is enabled (requires HTTPS) */
  web_ui_secure_cookie_enabled: boolean;
  /** Maximum number of authentication failures before ban */
  web_ui_max_auth_fail_count: number;
  /** Ban duration in seconds */
  web_ui_ban_duration: number;
  /** Session timeout in seconds */
  web_ui_session_timeout: number;
  /** Whether to validate Host header */
  web_ui_host_header_validation_enabled: boolean;
  
  // Authentication bypass
  /** Whether to bypass authentication for clients on localhost */
  bypass_local_auth: boolean;
  /** Whether to bypass authentication for clients in whitelisted subnets */
  bypass_auth_subnet_whitelist_enabled: boolean;
  /** Comma-separated list of IP subnets for authentication bypass */
  bypass_auth_subnet_whitelist: string;
  
  // HTTPS settings
  /** Whether HTTPS is enabled for Web UI */
  web_ui_https_enabled: boolean;
  /** Path to SSL key file */
  web_ui_https_key_path: string;
  /** Path to SSL certificate file */
  web_ui_https_cert_path: string;
  
  // Custom HTTP headers
  /** Whether custom HTTP headers are enabled */
  web_ui_use_custom_http_headers_enabled: boolean;
  /** Custom HTTP headers (one per line as "Header: value") */
  web_ui_custom_http_headers: string;
  
  // Reverse proxy settings
  /** Whether reverse proxy support is enabled */
  web_ui_reverse_proxy_enabled: boolean;
  /** Semicolon-separated list of reverse proxy IPs */
  web_ui_reverse_proxies_list: string;
  
  /** @deprecated Duplicate of web_ui_use_custom_http_headers_enabled */
  web_ui_use_custom_http_headers: boolean;
  
  // Alternative Web UI
  /** Whether alternative Web UI is enabled */
  alternative_webui_enabled: boolean;
  /** Path to alternative Web UI files */
  alternative_webui_path: string;
}