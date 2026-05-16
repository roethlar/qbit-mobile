#!/bin/bash

# qBit Mobile Uninstall Script
# Removes the systemd service, the app directory, and (optionally) the
# dedicated qbitmobile system user.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="qbit-mobile"
APP_DIR="/opt/qbit-mobile"
SERVICE_NAME="qbit-mobile"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SERVICE_USER_TO_REMOVE=""

if [ -f "${SERVICE_FILE}" ]; then
    SERVICE_USER_TO_REMOVE=$(grep -oP '^User=\K\S+' "${SERVICE_FILE}" 2>/dev/null || true)
fi

print_msg() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_error() {
    echo -e "${RED}[!]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[*]${NC} $1"
}

if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

print_warning "This will completely remove qBit Mobile from your system."
read -p "Are you sure you want to continue? (y/N): " -n 1 -r REPLY || true
echo
if [[ ! ${REPLY:-} =~ ^[Yy]$ ]]; then
    print_msg "Uninstall cancelled."
    exit 0
fi

if systemctl is-active --quiet "${SERVICE_NAME}"; then
    print_msg "Stopping ${SERVICE_NAME} service..."
    systemctl stop "${SERVICE_NAME}"
fi

if systemctl is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null; then
    print_msg "Disabling ${SERVICE_NAME} service..."
    systemctl disable "${SERVICE_NAME}"
fi

if [ -f "${SERVICE_FILE}" ]; then
    print_msg "Removing systemd service file..."
    rm "${SERVICE_FILE}"
    systemctl daemon-reload
fi

if [ -d "${APP_DIR}" ]; then
    print_msg "Removing application directory..."
    rm -rf "${APP_DIR}"
fi

# Drop the dedicated user if we created it. Never touch shared accounts
# like 'nobody'.
if [ "${SERVICE_USER_TO_REMOVE}" = "qbitmobile" ]; then
    if id -u qbitmobile >/dev/null 2>&1; then
        print_msg "Removing qbitmobile system user..."
        userdel qbitmobile 2>/dev/null || true
    fi
    if getent group qbitmobile >/dev/null 2>&1; then
        print_msg "Removing qbitmobile system group..."
        groupdel qbitmobile 2>/dev/null || true
    fi
fi

print_msg ""
print_msg "========================================="
print_msg "qBit Mobile has been completely removed!"
print_msg ""
print_msg "Removed:"
print_msg "  - Service: ${SERVICE_FILE}"
print_msg "  - Application: ${APP_DIR}"
if [ "${SERVICE_USER_TO_REMOVE}" = "qbitmobile" ]; then
    print_msg "  - User/group: qbitmobile"
fi
print_msg "========================================="
