import axios from 'axios';

const qbHost = process.env.QBITTORRENT_HOST || 'localhost';
const qbPort = process.env.QBITTORRENT_PORT || 8080;
const qbUser = process.env.QBITTORRENT_USERNAME || '';
const qbPass = process.env.QBITTORRENT_PASSWORD || '';

let sessionCookie = null;
let loginInFlight = null;

let qbApiVersion = null;
let capsDetected = false;
let detectInFlight = null;
let lastDetectAttemptAt = 0;
// qBittorrent <5.0 (Web API <2.11) uses /torrents/pause and /resume instead of
// /stop and /start. The preference key is "start_paused_enabled" instead of
// "add_stopped_enabled". The add-torrent param is normalized in
// routes/torrents.js to "stopped" on modern qB and "paused" on legacy qB,
// based on the detected API version.
const qbApiCapabilities = { legacy: false };

function buildLoginBody() {
  return qbUser
    ? `username=${encodeURIComponent(qbUser)}&password=${encodeURIComponent(qbPass)}`
    : 'username=&password=';
}

async function performLogin() {
  const loginResponse = await axios({
    method: 'POST',
    url: `http://${qbHost}:${qbPort}/api/v2/auth/login`,
    data: buildLoginBody(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15_000,
    validateStatus: () => true,
  });

  if (loginResponse.status === 403) {
    throw new Error('qBittorrent refused this client (rate-limited or IP banned)');
  }
  if (typeof loginResponse.data === 'string' && loginResponse.data.trim() === 'Fails.') {
    throw new Error('qBittorrent rejected credentials');
  }

  const loginCookies = loginResponse.headers['set-cookie'];
  if (loginCookies) {
    const cookies = Array.isArray(loginCookies) ? loginCookies : [loginCookies];
    // qBittorrent 5.2+ appends the WebUI port to the cookie name (e.g. SID8080=...).
    const sid = cookies.find(c => /^SID(\d+)?=/.test(c));
    if (sid) {
      sessionCookie = sid.split(';')[0];
      finalizeLogin();
      return;
    }
  }

  if (typeof loginResponse.data === 'string' && loginResponse.data.trim() === 'Ok.') {
    // Local-bypass mode: no cookie issued, but the upstream will accept us
    // based on the source address.
    sessionCookie = '';
    finalizeLogin();
    return;
  }

  throw new Error('Login response did not include a session cookie');
}

// Hook for work that should happen after every successful login (not just
// boot). detectCapabilities goes here so a qB instance that was offline at
// boot still gets its API version detected the first time we reach it.
function finalizeLogin() {
  if (!capsDetected) {
    detectCapabilities().catch(() => { /* will retry on next login */ });
  }
}

function ensureLogin() {
  if (!loginInFlight) {
    loginInFlight = performLogin().finally(() => {
      loginInFlight = null;
    });
  }
  return loginInFlight;
}

function parseVersionTuple(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
}

async function detectCapabilities() {
  // Skip if a previous probe (or confirmLegacyMode) already settled the flag,
  // otherwise a late-returning probe could overwrite a confirmed legacy=true.
  if (capsDetected) return;
  if (detectInFlight) return detectInFlight;
  detectInFlight = (async () => {
    lastDetectAttemptAt = Date.now();
    try {
      const response = await axios({
        method: 'GET',
        url: `http://${qbHost}:${qbPort}/api/v2/app/webapiVersion`,
        headers: { Cookie: sessionCookie || '' },
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (response.status >= 200 && response.status < 300) {
        const raw = typeof response.data === 'string' ? response.data.trim() : '';
        qbApiVersion = raw;
        const v = parseVersionTuple(raw);
        qbApiCapabilities.legacy = !!(v && (v[0] < 2 || (v[0] === 2 && v[1] < 11)));
        capsDetected = true;
        console.log(
          `qBittorrent Web API: ${qbApiVersion}` +
            (qbApiCapabilities.legacy ? ' (legacy pause/resume mode)' : ''),
        );
      }
    } catch {
      // Leave capsDetected=false so the next successful login retries.
    }
  })().finally(() => {
    detectInFlight = null;
  });
  return detectInFlight;
}

export function getQbApiCapabilities() {
  return qbApiCapabilities;
}

// Ensure the API version has been probed before code that branches on it
// (e.g. the add-torrent stopped/paused mapping). detectCapabilities is
// otherwise lazy/fire-and-forget, so on a fresh process a qB4 instance could
// be treated as modern until the first probe lands. No-op once detected.
export async function ensureCapabilitiesDetected() {
  if (!capsDetected) {
    await detectCapabilities();
  }
  return qbApiCapabilities;
}

export function getQbApiVersion() {
  return qbApiVersion;
}

// Set when a 404 fallback proves the upstream is on the legacy /pause and
// /resume endpoints. Subsequent requests skip the wrong-path round-trip.
export function confirmLegacyMode() {
  if (!qbApiCapabilities.legacy) {
    qbApiCapabilities.legacy = true;
    capsDetected = true;
    console.log('qBittorrent capabilities: legacy pause/resume mode (confirmed via 404 fallback)');
  }
}

// Test-only: reset module state between tests so the legacy flag doesn't
// leak from one case into another. capsDetected is set to true so the
// lazy detection probe doesn't fire on every test request and pollute
// the axios mock call list with extra /app/webapiVersion hits. Production
// code must not call this.
export function __resetCapabilitiesForTests(detected = true) {
  qbApiCapabilities.legacy = false;
  capsDetected = detected;
  qbApiVersion = null;
  sessionCookie = null;
  loginInFlight = null;
  detectInFlight = null;
  lastDetectAttemptAt = 0;
}

// `dataOrFactory` may be a value (string/Buffer/URLSearchParams) OR a
// thunk returning `{ data, headers }`. Use the thunk form for one-shot
// streams like multipart FormData so we can rebuild after a 401 retry.
export async function makeQbRequest(method, path, dataOrFactory, headers = {}) {
  const isFactory = typeof dataOrFactory === 'function';

  const buildConfig = () => {
    let data;
    let extraHeaders = headers;
    if (isFactory) {
      const built = dataOrFactory();
      data = built.data;
      extraHeaders = { ...headers, ...built.headers };
    } else {
      data = dataOrFactory;
    }
    const config = {
      method,
      url: `http://${qbHost}:${qbPort}/api/v2${path}`,
      headers: {
        ...extraHeaders,
        Cookie: sessionCookie || '',
      },
      timeout: 30_000,
      // Let callers decide how to handle 4xx; only throw on network errors.
      validateStatus: () => true,
      // multer enforces the real upload cap (25 × 10MB); don't let axios
      // truncate inside that ceiling.
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    };
    if (data !== undefined) config.data = data;
    return config;
  };

  let response = await axios(buildConfig());

  if (response.status === 401 || response.status === 403) {
    try {
      await ensureLogin();
    } catch (loginError) {
      const err = new Error(`Re-authentication with qBittorrent failed: ${loginError.message}`);
      err.response = response;
      throw err;
    }
    response = await axios(buildConfig());
  }

  // Lazy capability detection: in local-bypass mode the upstream never
  // returns 401, so re-login isn't triggered and finalizeLogin can't run.
  // If we haven't detected yet, kick it off on the first non-error reply.
  // Fire-and-forget so the response isn't delayed. Back off after a failed
  // probe so a broken upstream doesn't trigger a probe on every request.
  if (
    !capsDetected &&
    !detectInFlight &&
    response.status < 500 &&
    Date.now() - lastDetectAttemptAt > 30_000
  ) {
    detectCapabilities().catch(() => { /* retried next request */ });
  }

  return response;
}

export async function initialLogin() {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await ensureLogin();
      console.log('Initial authentication successful');
      console.log(`qBittorrent auth: ${qbUser ? 'Username/Password' : 'Local bypass'}`);
      // detectCapabilities is fired by finalizeLogin and logs its own line.
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        const delay = Math.min(2000 * attempt, 8000);
        console.warn(
          `qBittorrent login attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms…`,
        );
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export { qbHost, qbPort };
