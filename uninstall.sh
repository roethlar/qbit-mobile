#!/bin/bash

# qBit Mobile Uninstall Script
# This script removes the qBit Mobile application and systemd service

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

print_warning "This will completely remove qBit Mobile from your system."
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_msg "Uninstall cancelled."
    exit 0
fi

# Stop and disable service
if systemctl is-active --quiet "${SERVICE_NAME}"; then
    print_msg "Stopping ${SERVICE_NAME} service..."
    systemctl stop "${SERVICE_NAME}"
fi

if systemctl is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null; then
    print_msg "Disabling ${SERVICE_NAME} service..."
    systemctl disable "${SERVICE_NAME}"
fi

# Remove systemd service file
if [ -f "${SERVICE_FILE}" ]; then
    print_msg "Removing systemd service file..."
    rm "${SERVICE_FILE}"
    systemctl daemon-reload
fi

# Remove application directory
if [ -d "${APP_DIR}" ]; then
    print_msg "Removing application directory..."
    rm -rf "${APP_DIR}"
fi

# Check for any remaining processes
REMAINING_PROCS=$(pgrep -f "qbit-mobile" || true)
if [ -n "$REMAINING_PROCS" ]; then
    print_warning "Killing remaining qbit-mobile processes..."
    pkill -f "qbit-mobile" || true
fi

print_msg ""
print_msg "========================================="
print_msg "qBit Mobile has been completely removed!"
print_msg ""
print_msg "Removed:"
print_msg "  - Service: ${SERVICE_FILE}"
print_msg "  - Application: ${APP_DIR}"
print_msg "  - All running processes"
print_msg "========================================="