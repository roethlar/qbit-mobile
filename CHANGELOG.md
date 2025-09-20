# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-09-20

### Initial Release

#### Features
- 📱 Mobile-first responsive web interface for qBittorrent
- ⚡ Fast and lightweight React application with TypeScript
- 🌙 Dark mode support with system preference detection
- 🔍 Real-time torrent search and filtering
- 🏷️ Tag-based torrent organization
- 📊 Live statistics display (download/upload speeds)
- 🔄 Auto-refresh every 5 seconds
- 🎯 Touch-optimized controls
- 🔐 Support for both authenticated and local bypass modes

#### UI Components
- Compact torrent list view optimized for mobile screens
- Fixed header with quick access controls
- Filter buttons for torrent states (All, Downloading, Seeding, Paused, Completed)
- Floating action button for adding torrents
- Bottom sheets for torrent actions
- Pull-to-refresh functionality

#### Backend
- Express.js proxy server for qBittorrent API
- Automatic authentication handling
- Environment-based configuration
- Production-ready build system

#### Deployment
- Interactive deployment script for Linux systems
- Systemd service integration
- Dedicated system user for security
- Automatic updates and configuration preservation
- Uninstall script for clean removal

#### Security
- Secure service configuration with systemd hardening
- Dedicated system user with minimal privileges
- Protected configuration files
- Support for authentication bypass on local networks

### Technical Stack
- Frontend: React 18, TypeScript, Tailwind CSS, Vite
- Backend: Node.js, Express
- State Management: TanStack Query
- Icons: Lucide React
- Build: Vite with production optimizations