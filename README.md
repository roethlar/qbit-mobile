# qBit Mobile

A modern, responsive web interface for qBittorrent optimized for mobile devices.

## Features

- 📱 Mobile-first responsive design
- ⚡ Fast and lightweight
- 🌙 Dark mode support
- 🔍 Search and filter torrents
- 🏷️ Tag-based filtering
- 📊 Real-time statistics
- 🔄 Auto-refresh every 5 seconds

## Requirements

- Node.js 18+
- qBittorrent with Web UI enabled
- qBittorrent configured to allow local authentication bypass (recommended) or with credentials

## Installation

### Quick Deploy (Linux)

```bash
# Clone the repository
git clone https://github.com/yourusername/qbit-mobile.git
cd qbit-mobile

# Run the deployment script as root
sudo ./deploy.sh
```

### Uninstall

```bash
# To completely remove qBit Mobile
sudo ./uninstall.sh
```

The deployment script will:
- Install dependencies and build the frontend
- Interactively collect settings and write `.env`
- Create a dedicated system user `qbitmobile` for the service
- Create and start a systemd service `qbit-mobile`

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/roethlar/qbit-mobile.git
cd qbit-mobile
```

2. Install dependencies:
```bash
npm install
```

3. Build the frontend:
```bash
npm run build
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your qBittorrent settings
# Or simply run sudo ./deploy.sh for an interactive setup on the target machine
```

5. Start the server:
```bash
npm start
```

## Configuration

Edit the `.env` file to configure the server (the deploy script writes one for you interactively):

```env
NODE_ENV=production
PORT=3000                      # Port for the web interface
HOST=0.0.0.0                   # Host to bind to

# App authentication
AUTH_MODE=basic                # 'basic' (default) or 'disabled'
APP_USERNAME=admin
APP_PASSWORD=                  # required if AUTH_MODE=basic

# Upstream qBittorrent
QBITTORRENT_HOST=localhost
QBITTORRENT_PORT=8080
QBITTORRENT_USERNAME=          # optional; leave blank for local bypass
QBITTORRENT_PASSWORD=
```

### App authentication

This app is designed to be reached from a phone on your LAN, so binding to `0.0.0.0` is the default. To keep that safe, `AUTH_MODE=basic` is enabled out of the box and the server refuses to start if `APP_USERNAME` / `APP_PASSWORD` are unset. `deploy.sh` will auto-generate a strong password if you leave the field blank during install and print it once at the end.

`AUTH_MODE=disabled` is available for trusted-LAN setups where you've already gated access at the network or reverse-proxy layer. The server prints a loud warning at boot if it's disabled while bound to a non-loopback interface.

The proxy only forwards a curated set of qBittorrent endpoints — `/torrents/info`, `/transfer/info`, `/app/preferences`, `/app/version`, `/app/webapiVersion`, `/torrents/{stop,start,delete,add}`, and `/app/setPreferences` (with a key allowlist). Dangerous endpoints like `/app/shutdown`, `/torrents/setLocation`, and `autorun_program` preferences are not reachable through the proxy even when authenticated.

### qBittorrent Configuration

For the best experience, configure qBittorrent to allow local authentication bypass:

1. Open qBittorrent settings
2. Go to Web UI section
3. Enable "Bypass authentication for clients on localhost"

The proxy auto-detects the qBittorrent Web API version and translates legacy endpoints, so qBittorrent 4.x (with `/torrents/pause` / `/torrents/resume`) and 5.x (with `/torrents/stop` / `/torrents/start`) both work without configuration.

## Development

```bash
# Install dependencies
npm install

# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Systemd Service

After running the deployment script, you can manage the service with:

```bash
# Check status
systemctl status qbit-mobile

# View logs
journalctl -u qbit-mobile -f

# Restart service
systemctl restart qbit-mobile

# Stop service
systemctl stop qbit-mobile
```

## Technologies Used

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express
- **State Management**: TanStack Query (React Query)
- **Icons**: Lucide React

## License

MIT

## Contributing

Pull requests are welcome! Please feel free to submit a PR.

## Issues

If you encounter any issues, please report them on the [GitHub issues page](https://github.com/yourusername/qbit-mobile/issues).

## Notes on Compatibility and Security

- Dedicated user: The service runs as a dedicated system user `qbitmobile` by default (the deploy script also offers `nobody`), which follows least-privilege best practices and improves compatibility on distributions like Arch.
- Permissions: The app directory `/opt/qbit-mobile` is owned by the service user with mode `750`, and the `.env` is always `640` so the password is not world-readable.
- systemd hardening: the unit file applies `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `ProtectKernel*`, `RestrictAddressFamilies=AF_INET AF_INET6`, an empty `CapabilityBoundingSet`, and a `@system-service` syscall filter. Use `systemd-analyze security qbit-mobile` to inspect.
- App auth on by default: `AUTH_MODE=basic` is the default and the server refuses to boot without credentials. The proxy exposes only an allowlist of qBittorrent endpoints, so even an authenticated caller cannot reach `/app/shutdown` or set RCE-enabling preferences like `autorun_program`.
