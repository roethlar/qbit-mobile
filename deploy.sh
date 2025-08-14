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
SERVICE_USER="qbitmobile"
SERVICE_GROUP="${SERVICE_USER}"

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

# Copy only necessary files for deployment
print_msg "Copying application files..."

# Copy runtime files
cp -r server/ "${APP_DIR}/"
cp package.json "${APP_DIR}/"
cp package-lock.json "${APP_DIR}/"
cp .env.example "${APP_DIR}/"

# Copy source files needed for build
cp -r src/ "${APP_DIR}/"
cp index.html "${APP_DIR}/"
cp vite.config.ts "${APP_DIR}/"
cp tsconfig.json "${APP_DIR}/"
cp tsconfig.node.json "${APP_DIR}/"
cp tailwind.config.js "${APP_DIR}/"
cp postcss.config.js "${APP_DIR}/"
cp eslint.config.js "${APP_DIR}/"
cp -r public/ "${APP_DIR}/"

print_msg "Copied essential files for build and runtime"

# Navigate to app directory
cd "${APP_DIR}"

# Install all dependencies (including dev for build)
print_msg "Installing dependencies..."
npm ci || npm install

# Build the frontend
print_msg "Building frontend..."
npm run build

# Remove dev dependencies after build
print_msg "Cleaning up dev dependencies..."
npm ci --production || npm install --production

# Ensure service user/group exist (for broader distro support)
print_msg "Ensuring service user exists..."
NOLOGIN_BIN=$(command -v nologin || command -v /usr/sbin/nologin || echo "/usr/sbin/nologin")
if ! getent group "${SERVICE_GROUP}" >/dev/null 2>&1; then
    if ! groupadd --system "${SERVICE_GROUP}" 2>/dev/null; then
        groupadd "${SERVICE_GROUP}"
    fi
fi
if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
    if ! useradd --system --no-create-home --home-dir "${APP_DIR}" --shell "${NOLOGIN_BIN}" --gid "${SERVICE_GROUP}" "${SERVICE_USER}" 2>/dev/null; then
        useradd -M -d "${APP_DIR}" -s "${NOLOGIN_BIN}" -g "${SERVICE_GROUP}" "${SERVICE_USER}"
    fi
fi

# Interactive environment setup for novice users
print_msg "Setting up environment (.env)"

confirm_overwrite_env() {
    while true; do
        read -r -p "A .env already exists. Overwrite it? [y/N]: " yn
        case $yn in
            [Yy]*) return 0 ;;
            ""|[Nn]*) return 1 ;;
        esac
    done
}

prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var
    read -r -p "$prompt [$default]: " var || var=""
    if [ -z "$var" ]; then
        echo "$default"
    else
        echo "$var"
    fi
}

validate_port() {
    local p="$1"
    if [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then
        return 0
    fi
    return 1
}

write_env_file() {
    local app_port="$1"
    local app_host="$2"
    local qb_host="$3"
    local qb_port="$4"
    local qb_user="$5"
    local qb_pass="$6"
    cat > "${ENV_FILE}" << EOF
NODE_ENV=production
PORT=${app_port}
HOST=${app_host}
QBITTORRENT_HOST=${qb_host}
QBITTORRENT_PORT=${qb_port}
QBITTORRENT_USERNAME=${qb_user}
QBITTORRENT_PASSWORD=${qb_pass}
EOF
}

if [ -f "${ENV_FILE}" ]; then
    if confirm_overwrite_env; then
        overwrite_env=true
    else
        overwrite_env=false
    fi
else
    overwrite_env=true
fi

if [ "$overwrite_env" = true ]; then
    print_msg "Let's collect a few settings. Press Enter for defaults."

    # App settings
    while true; do
        APP_PORT=$(prompt_with_default "Web UI port" "3000")
        if validate_port "$APP_PORT"; then break; fi
        print_warning "Invalid port. Enter a number 1-65535."
    done
    APP_HOST=$(prompt_with_default "Web UI host to bind" "0.0.0.0")

    # qBittorrent settings
    QB_HOST=$(prompt_with_default "qBittorrent host" "localhost")
    while true; do
        QB_PORT=$(prompt_with_default "qBittorrent Web UI port" "8080")
        if validate_port "$QB_PORT"; then break; fi
        print_warning "Invalid port. Enter a number 1-65535."
    done

    echo "If your qBittorrent requires login, enter credentials."
    echo "Leave blank to attempt local bypass (no auth)."
    read -r -p "qBittorrent username: " QB_USER || QB_USER=""
    if [ -n "$QB_USER" ]; then
        read -r -s -p "qBittorrent password: " QB_PASS
        echo
    else
        QB_PASS=""
    fi

    print_msg "Writing ${ENV_FILE}..."
    write_env_file "$APP_PORT" "$APP_HOST" "$QB_HOST" "$QB_PORT" "$QB_USER" "$QB_PASS"
else
    print_msg ".env file already exists; keeping current values."
fi

# Set proper permissions
print_msg "Setting permissions..."
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}"
chmod 750 "${APP_DIR}"
chmod 640 "${ENV_FILE}"


# Create systemd service
print_msg "Creating systemd service..."
cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=qBit Mobile - qBittorrent Web Interface
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${APP_DIR}
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node ${APP_DIR}/server/server.js
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
