#!/bin/bash

# qBit Mobile Deployment Script for Linux
# Deploys the app, configures a systemd service, and writes a populated .env.

set -euo pipefail

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

# Detect existing service user so reinstalls don't re-prompt for it.
EXISTING_SERVICE_USER=""
if [ -f "${SERVICE_FILE}" ]; then
    EXISTING_SERVICE_USER=$(grep -oP '^User=\K\S+' "${SERVICE_FILE}" 2>/dev/null || true)
fi

# Variables we'll fill in interactively.
SERVICE_USER=""
SERVICE_GROUP=""
PRINT_GENERATED_PASS=""

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

print_msg "Creating application directory at ${APP_DIR}..."
mkdir -p "${APP_DIR}"

print_msg "Copying application files..."

# Wipe directories that may contain files removed since the last release so
# reinstalls don't keep stale source around. .env, node_modules, and dist
# are intentionally preserved. We also remove files an older buggy deploy
# may have spilled into the app root (BSD vs GNU cp trailing-slash quirk).
rm -rf "${APP_DIR}/server" "${APP_DIR}/src" "${APP_DIR}/public"
rm -rf "${APP_DIR}/__tests__" "${APP_DIR}/components" "${APP_DIR}/contexts" \
       "${APP_DIR}/hooks" "${APP_DIR}/pages" "${APP_DIR}/routes" \
       "${APP_DIR}/services" "${APP_DIR}/types" "${APP_DIR}/utils"
rm -f "${APP_DIR}/App.tsx" "${APP_DIR}/main.tsx" "${APP_DIR}/index.css" \
      "${APP_DIR}/manifest.json" "${APP_DIR}/qbClient.js" "${APP_DIR}/server.js"

# No trailing slash on the source path — on BSD cp (macOS) `cp -r src/ dest/`
# copies the *contents* of src into dest instead of creating dest/src/.
cp -R server "${APP_DIR}/"
cp -R src "${APP_DIR}/"
cp -R public "${APP_DIR}/"

cp package.json "${APP_DIR}/"
cp package-lock.json "${APP_DIR}/"
cp .env.example "${APP_DIR}/"
cp index.html "${APP_DIR}/"
cp vite.config.ts "${APP_DIR}/"
cp tsconfig.json "${APP_DIR}/"
cp tsconfig.node.json "${APP_DIR}/"
cp tailwind.config.js "${APP_DIR}/"
cp postcss.config.js "${APP_DIR}/"
cp eslint.config.js "${APP_DIR}/"

print_msg "Copied essential files for build and runtime"

cd "${APP_DIR}"

print_msg "Installing dependencies..."
npm ci || npm install

print_msg "Building frontend..."
npm run build

# Drop dev dependencies — faster than a full reinstall.
print_msg "Pruning dev dependencies..."
npm prune --omit=dev

# Service user configuration. Recommend the dedicated qbitmobile user for
# better isolation than the shared nobody account.
case "${EXISTING_SERVICE_USER}" in
    qbitmobile|"") DEFAULT_USER_CHOICE=1 ;;
    nobody)        DEFAULT_USER_CHOICE=2 ;;
    *)             DEFAULT_USER_CHOICE=1 ;;
esac

print_msg "Service user configuration:"
echo "1) qbitmobile (dedicated system user, recommended)"
echo "2) nobody (shared, less isolation)"
if [ -n "${EXISTING_SERVICE_USER}" ]; then
    print_msg "Existing service runs as: ${EXISTING_SERVICE_USER} (default: ${DEFAULT_USER_CHOICE})"
fi
user_choice=""
while true; do
    read -r -p "Choose service user [${DEFAULT_USER_CHOICE}]: " user_choice
    # Strip whitespace so pasted newlines or accidental spaces still default
    # the way [N] in the prompt implies.
    user_choice="${user_choice//[[:space:]]/}"
    case ${user_choice:-${DEFAULT_USER_CHOICE}} in
        1)
            SERVICE_USER="qbitmobile"
            SERVICE_GROUP="${SERVICE_USER}"
            print_msg "Using dedicated user: ${SERVICE_USER}"

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
            break
            ;;
        2)
            SERVICE_USER="nobody"
            SERVICE_GROUP="nobody"
            print_msg "Using nobody user (minimal permissions)"
            break
            ;;
        *)
            print_warning "Invalid choice. Enter 1 or 2."
            ;;
    esac
done

print_msg "Setting up environment (.env)"

confirm_overwrite_env() {
    local yn=""
    while true; do
        read -r -p "A .env already exists. Overwrite it? [y/N]: " yn
        yn="${yn//[[:space:]]/}"
        case ${yn:-N} in
            [Yy]*) return 0 ;;
            [Nn]*) return 1 ;;
        esac
    done
}

prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var=""
    read -r -p "$prompt [$default]: " var || true
    # Same trim as the choice prompts: whitespace-only input shouldn't override
    # the bracketed default. None of the prompts using this helper accept
    # values containing whitespace anyway (ports, hostnames, usernames).
    var="${var//[[:space:]]/}"
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

generate_password() {
    # 24 chars from a strong source. Strip URL-unfriendly base64 chars so
    # the password is easy to type from a phone.
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 24 | tr -d '/+=' | cut -c1-24
    elif [ -r /dev/urandom ]; then
        tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24
    else
        date +%s%N | sha256sum | head -c 24
    fi
}

prompt_app_auth() {
    # Reads stdin, sets globals: AUTH_MODE, APP_USER, APP_PASS, PRINT_GENERATED_PASS.
    # $1 (optional) is the bound HOST used in the disabled-mode warning.
    local app_host="${1:-0.0.0.0}"
    local app_auth_choice=""
    local confirm_disabled=""

    AUTH_MODE=""
    APP_USER=""
    APP_PASS=""

    echo ""
    print_msg "Web UI authentication setup:"
    echo "1) Basic auth (recommended — required for anything beyond localhost)"
    echo "2) Disabled (no auth — only safe on a fully trusted LAN)"
    while true; do
        read -r -p "Choose authentication method [1]: " app_auth_choice || true
        app_auth_choice="${app_auth_choice//[[:space:]]/}"
        case ${app_auth_choice:-1} in
            1)
                AUTH_MODE="basic"
                APP_USER=$(prompt_with_default "Web UI username" "admin")
                read -r -s -p "Web UI password (leave blank to auto-generate): " APP_PASS || true
                echo
                if [ -z "$APP_PASS" ]; then
                    APP_PASS=$(generate_password)
                    PRINT_GENERATED_PASS="$APP_PASS"
                    print_msg "Generated a random password."
                fi
                break
                ;;
            2)
                if [ "$app_host" != "127.0.0.1" ] && [ "$app_host" != "::1" ] && [ "$app_host" != "localhost" ]; then
                    print_warning "AUTH_MODE=disabled with HOST=${app_host} means anyone on the network can drive qBittorrent."
                    confirm_disabled=""
                    read -r -p "Type 'yes' to confirm, anything else to choose again: " confirm_disabled || true
                    if [ "$confirm_disabled" != "yes" ]; then
                        continue
                    fi
                fi
                AUTH_MODE="disabled"
                APP_USER=""
                APP_PASS=""
                print_msg "Web UI auth disabled."
                break
                ;;
            *)
                print_warning "Invalid choice. Enter 1 or 2."
                ;;
        esac
    done
}

escape_env_value() {
    # Wrap value in double quotes and escape \, ", $ so dotenv reads it
    # back verbatim regardless of what characters the user pasted.
    local v="$1"
    v="${v//\\/\\\\}"
    v="${v//\"/\\\"}"
    v="${v//\$/\\\$}"
    printf '"%s"' "$v"
}

append_auth_to_env() {
    {
        printf '\n# --- App authentication (added on upgrade) ---\n'
        printf 'AUTH_MODE=%s\n' "$(escape_env_value "${AUTH_MODE}")"
        printf 'APP_USERNAME=%s\n' "$(escape_env_value "${APP_USER}")"
        printf 'APP_PASSWORD=%s\n' "$(escape_env_value "${APP_PASS}")"
    } >> "${ENV_FILE}"
}

write_env_file() {
    local app_port="$1"
    local app_host="$2"
    local auth_mode="$3"
    local app_user="$4"
    local app_pass="$5"
    local qb_host="$6"
    local qb_port="$7"
    local qb_user="$8"
    local qb_pass="$9"

    # Use printf so $-expansion / backticks in values don't get interpreted,
    # and quote every value so dotenv parses passwords with # or whitespace
    # correctly. The escape_env_value helper handles \, ", $ inside the quotes.
    {
        printf '%s\n' '# qBit Mobile Configuration'
        printf '\n'
        printf '%s\n' '# --- App server ---'
        printf 'NODE_ENV=%s\n' "$(escape_env_value 'production')"
        printf 'PORT=%s\n' "$(escape_env_value "${app_port}")"
        printf 'HOST=%s\n' "$(escape_env_value "${app_host}")"
        printf '\n'
        printf '%s\n' '# --- App authentication ---'
        printf 'AUTH_MODE=%s\n' "$(escape_env_value "${auth_mode}")"
        printf 'APP_USERNAME=%s\n' "$(escape_env_value "${app_user}")"
        printf 'APP_PASSWORD=%s\n' "$(escape_env_value "${app_pass}")"
        printf '\n'
        printf '%s\n' '# --- Upstream qBittorrent ---'
        printf 'QBITTORRENT_HOST=%s\n' "$(escape_env_value "${qb_host}")"
        printf 'QBITTORRENT_PORT=%s\n' "$(escape_env_value "${qb_port}")"
        printf 'QBITTORRENT_USERNAME=%s\n' "$(escape_env_value "${qb_user}")"
        printf 'QBITTORRENT_PASSWORD=%s\n' "$(escape_env_value "${qb_pass}")"
    } > "${ENV_FILE}"
}

overwrite_env=true
if [ -f "${ENV_FILE}" ]; then
    if confirm_overwrite_env; then
        overwrite_env=true
    else
        overwrite_env=false
    fi
fi

if [ "$overwrite_env" = true ]; then
    print_msg "Let's collect a few settings. Press Enter for defaults."

    APP_PORT=""
    while true; do
        APP_PORT=$(prompt_with_default "Web UI port" "3000")
        if validate_port "$APP_PORT"; then break; fi
        print_warning "Invalid port. Enter a number 1-65535."
    done
    APP_HOST=$(prompt_with_default "Web UI host to bind" "0.0.0.0")

    prompt_app_auth "$APP_HOST"

    echo ""
    QB_HOST=$(prompt_with_default "qBittorrent host" "localhost")
    QB_PORT=""
    while true; do
        QB_PORT=$(prompt_with_default "qBittorrent Web UI port" "8080")
        if validate_port "$QB_PORT"; then break; fi
        print_warning "Invalid port. Enter a number 1-65535."
    done

    echo ""
    print_msg "qBittorrent authentication setup:"
    echo "1) Local bypass (qBittorrent must have localhost bypass enabled)"
    echo "2) Username/Password"
    QB_USER=""
    QB_PASS=""
    auth_choice=""
    while true; do
        read -r -p "Choose authentication method [1]: " auth_choice || true
        auth_choice="${auth_choice//[[:space:]]/}"
        case ${auth_choice:-1} in
            1)
                QB_USER=""
                QB_PASS=""
                print_msg "Using qBittorrent local bypass mode"
                break
                ;;
            2)
                read -r -p "qBittorrent username: " QB_USER || true
                if [ -n "$QB_USER" ]; then
                    read -r -s -p "qBittorrent password: " QB_PASS || true
                    echo
                    print_msg "Using qBittorrent username/password"
                else
                    print_warning "Username cannot be empty"
                    continue
                fi
                break
                ;;
            *)
                print_warning "Invalid choice. Enter 1 or 2."
                ;;
        esac
    done

    print_msg "Writing ${ENV_FILE}..."
    write_env_file "$APP_PORT" "$APP_HOST" "$AUTH_MODE" "$APP_USER" "$APP_PASS" "$QB_HOST" "$QB_PORT" "$QB_USER" "$QB_PASS"
else
    print_msg ".env file already exists; keeping current values."
    if ! grep -qE '^AUTH_MODE=' "${ENV_FILE}"; then
        # Existing .env is from a pre-1.1 install. The 1.1 server refuses to
        # boot without AUTH_MODE/APP_USERNAME/APP_PASSWORD, so we prompt for
        # those and append them to the existing file (everything else stays).
        print_warning "Your existing .env was created before v1.1 and is missing the"
        print_warning "AUTH_MODE / APP_USERNAME / APP_PASSWORD keys that v1.1 requires."
        existing_host=$(grep -E '^HOST=' "${ENV_FILE}" | head -n1 | cut -d= -f2- || true)
        prompt_app_auth "${existing_host:-0.0.0.0}"
        append_auth_to_env
        print_msg "Added the new auth keys to ${ENV_FILE}."
    fi
fi

# Set permissions. .env is always 640 so the password isn't world-readable.
print_msg "Setting permissions..."
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}"
find "${APP_DIR}" -type d -exec chmod 750 {} +
find "${APP_DIR}" -type f -exec chmod 640 {} +
chmod 640 "${ENV_FILE}"


print_msg "Creating systemd service..."
cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=qBit Mobile - qBittorrent Web Interface
After=network.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${APP_DIR}
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node ${APP_DIR}/server/server.js
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6
RestrictNamespaces=true
RestrictRealtime=true
LockPersonality=true
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallFilter=~@privileged @resources
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
EOF

print_msg "Configuring systemd service..."
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service" >/dev/null

if systemctl is-active --quiet "${SERVICE_NAME}"; then
    print_msg "Stopping existing service..."
    systemctl stop "${SERVICE_NAME}"
fi

print_msg "Starting ${SERVICE_NAME} service..."
systemctl start "${SERVICE_NAME}"

sleep 2
if systemctl is-active --quiet "${SERVICE_NAME}"; then
    print_msg "Service started successfully!"
    print_msg ""
    print_msg "========================================="
    print_msg "qBit Mobile has been deployed successfully!"
    print_msg ""
    ENV_QB_HOST=$(grep ^QBITTORRENT_HOST= "${ENV_FILE}" | cut -d= -f2- 2>/dev/null || echo "localhost")
    ENV_QB_PORT=$(grep ^QBITTORRENT_PORT= "${ENV_FILE}" | cut -d= -f2- 2>/dev/null || echo "8080")
    ENV_PORT=$(grep ^PORT= "${ENV_FILE}" | cut -d= -f2- 2>/dev/null || echo "3000")
    ENV_AUTH=$(grep ^AUTH_MODE= "${ENV_FILE}" | cut -d= -f2- 2>/dev/null || echo "basic")
    ENV_USER=$(grep ^APP_USERNAME= "${ENV_FILE}" | cut -d= -f2- 2>/dev/null || echo "")
    print_msg "Configuration:"
    print_msg "  Service user: ${SERVICE_USER}"
    print_msg "  Web UI port: ${ENV_PORT}"
    print_msg "  qBittorrent: ${ENV_QB_HOST}:${ENV_QB_PORT}"
    print_msg "  App auth: ${ENV_AUTH}"
    if [ "${ENV_AUTH}" = "basic" ]; then
        print_msg "  App username: ${ENV_USER}"
    fi
    if [ -n "${PRINT_GENERATED_PASS}" ]; then
        print_msg ""
        print_warning "Generated app password (shown once — store it now):"
        print_warning "  ${PRINT_GENERATED_PASS}"
    fi
    print_msg ""
    print_msg "Management commands:"
    print_msg "  Service status: systemctl status ${SERVICE_NAME}"
    print_msg "  View logs: journalctl -u ${SERVICE_NAME} -f"
    print_msg "  Restart service: systemctl restart ${SERVICE_NAME}"
    print_msg ""
    HOST_IP=""
    if command -v hostname >/dev/null 2>&1; then
        HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    fi
    if [ -z "${HOST_IP}" ] && command -v ip >/dev/null 2>&1; then
        HOST_IP=$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n1 || true)
    fi
    HOST_IP="${HOST_IP:-localhost}"
    print_msg "Access the web interface at:"
    print_msg "  http://${HOST_IP}:${ENV_PORT}"
    print_msg "========================================="
else
    print_error "Service failed to start. Recent logs:"
    echo ""
    journalctl -u "${SERVICE_NAME}" -n 25 --no-pager 2>&1 || true
    echo ""
    print_error "Full logs: journalctl -u ${SERVICE_NAME} -n 100"
    exit 1
fi
