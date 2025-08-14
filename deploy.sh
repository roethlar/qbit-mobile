#!/bin/bash

# qBit Mobile Deployment Script for Linux
# This script deploys the qBit Mobile application and sets up a systemd service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="qbit-mobile"
APP_DIR="/opt/qbit-mobile"
SERVICE_NAME="qbit-mobile"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
ENV_FILE="${APP_DIR}/.env"

# Function to print colored messages
print_msg() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_error() {
    echo -e "${RED}[!]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[*]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Check prerequisites
print_msg "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Create application directory
print_msg "Creating application directory at ${APP_DIR}..."
mkdir -p "${APP_DIR}"

# Copy application files
print_msg "Copying application files..."
cp -r ./* "${APP_DIR}/" 2>/dev/null || true
cp .env.example "${APP_DIR}/.env.example" 2>/dev/null || true

# Navigate to app directory
cd "${APP_DIR}"

# Install dependencies
print_msg "Installing dependencies..."
npm ci --production || npm install --production

# Build the frontend
print_msg "Building frontend..."
npm run build

# Create/update .env file if it doesn't exist
if [ ! -f "${ENV_FILE}" ]; then
    print_msg "Creating .env file..."
    cat > "${ENV_FILE}" << EOF
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
QBITTORRENT_HOST=localhost
QBITTORRENT_PORT=8080
EOF
    print_warning "Please edit ${ENV_FILE} to configure your qBittorrent connection"
else
    print_msg ".env file already exists, skipping..."
fi

# Set proper permissions
print_msg "Setting permissions..."
chmod 755 "${APP_DIR}"
chmod 644 "${ENV_FILE}"

# Create systemd service
print_msg "Creating systemd service..."
cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=qBit Mobile - qBittorrent Web Interface
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=nobody
Group=nogroup
WorkingDirectory=${APP_DIR}
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/dist

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
print_msg "Configuring systemd service..."
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service"

# Stop existing service if running
if systemctl is-active --quiet "${SERVICE_NAME}"; then
    print_msg "Stopping existing service..."
    systemctl stop "${SERVICE_NAME}"
fi

# Start the service
print_msg "Starting ${SERVICE_NAME} service..."
systemctl start "${SERVICE_NAME}"

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet "${SERVICE_NAME}"; then
    print_msg "Service started successfully!"
    print_msg ""
    print_msg "========================================="
    print_msg "qBit Mobile has been deployed successfully!"
    print_msg ""
    print_msg "Service status: systemctl status ${SERVICE_NAME}"
    print_msg "View logs: journalctl -u ${SERVICE_NAME} -f"
    print_msg "Restart service: systemctl restart ${SERVICE_NAME}"
    print_msg ""
    print_msg "The application is running on port 3000"
    print_msg "Access it at: http://$(hostname -I | awk '{print $1}'):3000"
    print_msg "========================================="
else
    print_error "Service failed to start. Check logs with: journalctl -u ${SERVICE_NAME} -n 50"
    exit 1
fi