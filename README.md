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
- Install dependencies
- Build the frontend
- Create a systemd service
- Start the application on port 3000

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/qbit-mobile.git
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
```

5. Start the server:
```bash
npm start
```

## Configuration

Edit the `.env` file to configure the connection to qBittorrent:

```env
NODE_ENV=production
PORT=3000                      # Port for the web interface
HOST=0.0.0.0                  # Host to bind to
QBITTORRENT_HOST=localhost    # qBittorrent host
QBITTORRENT_PORT=8080         # qBittorrent WebUI port
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