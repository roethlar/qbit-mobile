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

Edit the `.env` file to configure the connection to qBittorrent (the deploy script will help you create this interactively):

```env
NODE_ENV=production
PORT=3000                      # Port for the web interface
HOST=0.0.0.0                  # Host to bind to
QBITTORRENT_HOST=localhost    # qBittorrent host
QBITTORRENT_PORT=8080         # qBittorrent WebUI port
QBITTORRENT_USERNAME=         # optional; leave blank for local bypass
QBITTORRENT_PASSWORD=         # optional; leave blank for local bypass
```

### qBittorrent Configuration

For the best experience, configure qBittorrent to allow local authentication bypass:

1. Open qBittorrent settings
2. Go to Web UI section
3. Enable "Bypass authentication for clients on localhost"

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

- Dedicated user: The service runs as a dedicated system user `qbitmobile` rather than `nobody`, which improves compatibility on distributions like Arch and follows least-privilege best practices.
- Permissions: The app directory `/opt/qbit-mobile` is owned by `qbitmobile:qbitmobile` with mode `750`, and the `.env` is `640`. This allows the service to read configuration while keeping it private from other users.
- Write access: The service has write access only to the `dist/` directory (configured via systemd `ReadWritePaths`), and otherwise runs with systemd hardening options enabled.
