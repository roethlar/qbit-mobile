#!/bin/bash

# qBit Mobile uninstaller for macOS.
# Tears down the LaunchAgent and removes the install directory.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="${HOME}/Library/Application Support/qbit-mobile"
PLIST_LABEL="com.qbit-mobile"
PLIST_FILE="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_FILE="${HOME}/Library/Logs/qbit-mobile.log"

print_msg()     { printf "${GREEN}[+]${NC} %s\n" "$1"; }
print_error()   { printf "${RED}[!]${NC} %s\n" "$1"; }
print_warning() { printf "${YELLOW}[*]${NC} %s\n" "$1"; }

if [[ $EUID -eq 0 ]]; then
    print_error "Do not run this script with sudo. The LaunchAgent is user-scoped."
    exit 1
fi

print_warning "This will completely remove qBit Mobile from your Mac."
read -r -p "Are you sure you want to continue? (y/N): " REPLY || true
if [[ ! "${REPLY:-}" =~ ^[Yy]$ ]]; then
    print_msg "Uninstall cancelled."
    exit 0
fi

GUI_TARGET="gui/$(id -u)"

if launchctl print "${GUI_TARGET}/${PLIST_LABEL}" >/dev/null 2>&1; then
    print_msg "Unloading LaunchAgent..."
    launchctl bootout "${GUI_TARGET}" "${PLIST_FILE}" 2>/dev/null || true
fi

if [ -f "${PLIST_FILE}" ]; then
    print_msg "Removing LaunchAgent plist..."
    rm -f "${PLIST_FILE}"
fi

if [ -d "${APP_DIR}" ]; then
    print_msg "Removing application directory..."
    rm -rf "${APP_DIR}"
fi

# A deploy interrupted between its cleanup points (kill, power loss) can leave
# the staging tree or a not-yet-deleted previous install behind; sweep those too.
rm -rf "${APP_DIR}.stage"
for old in "${APP_DIR}".old.*; do
    if [ -e "${old}" ]; then
        rm -rf "${old}"
    fi
done

if [ -f "${LOG_FILE}" ]; then
    read -r -p "Remove log file at ${LOG_FILE}? (y/N): " RM_LOG || true
    if [[ "${RM_LOG:-}" =~ ^[Yy]$ ]]; then
        rm -f "${LOG_FILE}"
        print_msg "Log removed."
    fi
fi

print_msg ""
print_msg "========================================="
print_msg "qBit Mobile has been completely removed!"
print_msg ""
print_msg "Removed:"
print_msg "  - LaunchAgent: ${PLIST_FILE}"
print_msg "  - Application: ${APP_DIR}"
print_msg "========================================="
