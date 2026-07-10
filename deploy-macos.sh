#!/bin/bash

# qBit Mobile deployment for macOS.
# Installs to ~/Library/Application Support/qbit-mobile and registers a
# launchd LaunchAgent so the service starts whenever the user logs in.
# Run as the regular user (no sudo) — agents are user-scoped on macOS.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="qbit-mobile"
APP_DIR="${HOME}/Library/Application Support/qbit-mobile"
LOG_DIR="${HOME}/Library/Logs"
LOG_FILE="${LOG_DIR}/qbit-mobile.log"
PLIST_LABEL="com.qbit-mobile"
PLIST_FILE="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
ENV_FILE="${APP_DIR}/.env"

PRINT_GENERATED_PASS=""

print_msg()     { printf "${GREEN}[+]${NC} %s\n" "$1"; }
print_error()   { printf "${RED}[!]${NC} %s\n" "$1"; }
print_warning() { printf "${YELLOW}[*]${NC} %s\n" "$1"; }

if [[ $EUID -eq 0 ]]; then
    print_error "Do not run this script with sudo. LaunchAgents are user-scoped on macOS."
    exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
    print_error "This script targets macOS. Use deploy.sh on Linux or deploy.ps1 on Windows."
    exit 1
fi

print_msg "Checking prerequisites..."

NODE_BIN=$(command -v node || true)
if [ -z "${NODE_BIN}" ]; then
    print_error "Node.js is not installed. Install Node.js 22.12+ (e.g., via Homebrew: 'brew install node@22')."
    exit 1
fi
# Keep Homebrew's stable /opt/homebrew/bin/node or /usr/local/bin/node symlink
# instead of resolving into a versioned Cellar path that can disappear after
# `brew upgrade && brew cleanup`. If command -v ever returns a relative path,
# make it absolute without following the final symlink.
case "${NODE_BIN}" in
    /*) ;;
    *) NODE_BIN="$(cd "$(dirname "${NODE_BIN}")" && pwd -P)/$(basename "${NODE_BIN}")" ;;
esac

NODE_VER_STR=$("${NODE_BIN}" -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VER_STR" | cut -d. -f1)
NODE_MINOR=$(echo "$NODE_VER_STR" | cut -d. -f2)
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 12 ]; }; then
    print_error "Node.js 22.12+ is required. Current version: v${NODE_VER_STR}"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Refuse to run anywhere but the repo root. The copy step below deletes the
# installed server/src/public first; from the wrong CWD that would wipe the
# live install and then fail on the copy.
for required in server src public package.json; do
    if [ ! -e "${required}" ]; then
        print_error "Run this script from the qbit-mobile repo root (missing ./${required})."
        exit 1
    fi
done

print_msg "Creating application directory at ${APP_DIR}..."
mkdir -p "${APP_DIR}"
mkdir -p "${LOG_DIR}"

print_msg "Copying application files..."

# Wipe directories that may contain files removed since the last release.
# .env, node_modules, and dist are intentionally preserved.
rm -rf "${APP_DIR}/server" "${APP_DIR}/src" "${APP_DIR}/public"

cp -R server  "${APP_DIR}/"
cp -R src     "${APP_DIR}/"
cp -R public  "${APP_DIR}/"
cp package.json package-lock.json .env.example "${APP_DIR}/"
# build-id.ts is imported by vite.config.ts at build time; without it the build
# fails to load its own config.
cp index.html vite.config.ts build-id.ts tsconfig.json tsconfig.node.json \
   tailwind.config.js postcss.config.js eslint.config.js "${APP_DIR}/"

cd "${APP_DIR}"

print_msg "Installing dependencies..."
# No `|| npm install` fallback -- see deploy.sh for why: npm install would deploy
# a dependency tree that was never tested or audited.
npm ci

print_msg "Building frontend..."
npm run build

print_msg "Pruning dev dependencies..."
npm prune --omit=dev

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
    var="${var//[[:space:]]/}"
    if [ -z "$var" ]; then echo "$default"; else echo "$var"; fi
}

validate_port() {
    local p="$1"
    if [[ "$p" =~ ^[0-9]+$ ]] && [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then
        return 0
    fi
    return 1
}

generate_password() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 24 | tr -d '/+=' | cut -c1-24
    else
        # /dev/urandom is always available on macOS. Bounded read + `cut`
        # (reads to EOF) instead of a trailing `head`, which would SIGPIPE
        # `tr` and trip `set -o pipefail`.
        head -c 512 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-24
    fi
}

prompt_app_auth() {
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
                    if [ "$confirm_disabled" != "yes" ]; then continue; fi
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
    local v="$1"
    v="${v//\\/\\\\}"
    v="${v//\"/\\\"}"
    v="${v//\$/\\\$}"
    printf '"%s"' "$v"
}

append_auth_to_env() {
    {
        printf '\n# --- App authentication (added on upgrade) ---\n'
        printf 'AUTH_MODE=%s\n'     "$(escape_env_value "${AUTH_MODE}")"
        printf 'APP_USERNAME=%s\n'  "$(escape_env_value "${APP_USER}")"
        printf 'APP_PASSWORD=%s\n'  "$(escape_env_value "${APP_PASS}")"
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

    # Create the file with locked-down perms BEFORE writing any secret so the
    # password is never briefly readable by other local users under a default
    # umask. The final chmod later is kept as belt-and-suspenders.
    : > "${ENV_FILE}"
    chmod 600 "${ENV_FILE}"

    {
        printf '%s\n' '# qBit Mobile Configuration'
        printf '\n'
        printf '%s\n' '# --- App server ---'
        printf 'NODE_ENV=%s\n' "$(escape_env_value 'production')"
        printf 'PORT=%s\n'     "$(escape_env_value "${app_port}")"
        printf 'HOST=%s\n'     "$(escape_env_value "${app_host}")"
        printf '\n'
        printf '%s\n' '# --- App authentication ---'
        printf 'AUTH_MODE=%s\n'    "$(escape_env_value "${auth_mode}")"
        printf 'APP_USERNAME=%s\n' "$(escape_env_value "${app_user}")"
        printf 'APP_PASSWORD=%s\n' "$(escape_env_value "${app_pass}")"
        printf '\n'
        printf '%s\n' '# --- Upstream qBittorrent ---'
        printf 'QBITTORRENT_HOST=%s\n'     "$(escape_env_value "${qb_host}")"
        printf 'QBITTORRENT_PORT=%s\n'     "$(escape_env_value "${qb_port}")"
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
        print_warning "Your existing .env predates v1.1 and is missing AUTH_MODE / APP_USERNAME / APP_PASSWORD."
        existing_host=$(grep -E '^HOST=' "${ENV_FILE}" | head -n1 | cut -d= -f2- || true)
        prompt_app_auth "${existing_host:-0.0.0.0}"
        # Lock perms before appending secrets in case a hand-created pre-1.1
        # .env was left readable by other local users.
        chmod 600 "${ENV_FILE}"
        append_auth_to_env
        print_msg "Added the new auth keys to ${ENV_FILE}."
    fi
fi

mkdir -p "${APP_DIR}/data"

# .env always 600 so the password isn't readable by other local users.
chmod 700 "${APP_DIR}"
chmod 600 "${ENV_FILE}"

print_msg "Writing LaunchAgent at ${PLIST_FILE}..."
mkdir -p "$(dirname "${PLIST_FILE}")"

# XML-escape the few characters that can legitimately appear in install paths
# (`&`, `<`, `>`). The plist is the user's HOME path so apostrophes are unlikely
# but we escape them anyway for completeness.
xml_escape() {
    local s="$1"
    s="${s//&/&amp;}"
    s="${s//</&lt;}"
    s="${s//>/&gt;}"
    s="${s//\"/&quot;}"
    s="${s//\'/&apos;}"
    printf '%s' "$s"
}

cat > "${PLIST_FILE}" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$(xml_escape "${PLIST_LABEL}")</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(xml_escape "${NODE_BIN}")</string>
        <string>$(xml_escape "${APP_DIR}/server/server.js")</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$(xml_escape "${APP_DIR}")</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>$(xml_escape "${LOG_FILE}")</string>
    <key>StandardErrorPath</key>
    <string>$(xml_escape "${LOG_FILE}")</string>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
EOF
chmod 644 "${PLIST_FILE}"

GUI_TARGET="gui/$(id -u)"

# Bootout any previous load so the new plist takes effect cleanly.
if launchctl print "${GUI_TARGET}/${PLIST_LABEL}" >/dev/null 2>&1; then
    print_msg "Unloading existing LaunchAgent..."
    launchctl bootout "${GUI_TARGET}" "${PLIST_FILE}" 2>/dev/null || true
fi

print_msg "Loading LaunchAgent..."
launchctl bootstrap "${GUI_TARGET}" "${PLIST_FILE}"
launchctl enable "${GUI_TARGET}/${PLIST_LABEL}"
launchctl kickstart -k "${GUI_TARGET}/${PLIST_LABEL}" >/dev/null 2>&1 || true

sleep 2

if launchctl print "${GUI_TARGET}/${PLIST_LABEL}" 2>/dev/null | grep -qE 'state\s*=\s*running'; then
    print_msg "Service started successfully!"
    print_msg ""
    print_msg "========================================="
    print_msg "qBit Mobile has been deployed successfully!"
    print_msg ""
    read_env_value() {
        local key="$1"
        local default="$2"
        local line raw
        line=$(grep -E "^${key}=" "${ENV_FILE}" | head -n1 || true)
        if [ -z "${line}" ]; then
            printf '%s' "${default}"
            return
        fi
        raw="${line#*=}"
        raw="${raw%$'\r'}"
        if [[ "${raw}" == \"*\" && "${raw}" == *\" ]]; then
            raw="${raw:1:${#raw}-2}"
            raw="${raw//\\\"/\"}"
            raw="${raw//\\\$/\$}"
            raw="${raw//\\\\/\\}"
        fi
        printf '%s' "${raw}"
    }

    ENV_QB_HOST=$(read_env_value QBITTORRENT_HOST "localhost")
    ENV_QB_PORT=$(read_env_value QBITTORRENT_PORT "8080")
    ENV_PORT=$(read_env_value PORT "3000")
    ENV_AUTH=$(read_env_value AUTH_MODE "basic")
    ENV_USER=$(read_env_value APP_USERNAME "")
    print_msg "Configuration:"
    print_msg "  Install dir: ${APP_DIR}"
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
    print_msg "  Status:  launchctl print ${GUI_TARGET}/${PLIST_LABEL}"
    print_msg "  Logs:    tail -f ${LOG_FILE}"
    print_msg "  Restart: launchctl kickstart -k ${GUI_TARGET}/${PLIST_LABEL}"
    print_msg "  Stop:    launchctl bootout ${GUI_TARGET} ${PLIST_FILE}"
    print_msg ""
    HOST_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
    print_msg "Access the web interface at:"
    print_msg "  http://${HOST_IP}:${ENV_PORT}"
    print_msg "========================================="
else
    print_error "Service failed to start. Recent log lines:"
    echo ""
    tail -n 25 "${LOG_FILE}" 2>/dev/null || true
    echo ""
    print_error "Full log: ${LOG_FILE}"
    exit 1
fi
