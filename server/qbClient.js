import axios from 'axios';

const qbHost = process.env.QBITTORRENT_HOST || 'localhost';
const qbPort = process.env.QBITTORRENT_PORT || 8080;
const qbUser = process.env.QBITTORRENT_USERNAME || '';
const qbPass = process.env.QBITTORRENT_PASSWORD || '';

let sessionCookie = null;
let loginInFlight = null;

let qbApiVersion = null;
// qBittorrent <5.0 (Web API <2.11) uses /torrents/pause and /resume instead of
// /stop and /start, and the add-torrent flag is "paused" instead of "stopped".
// The preference key is "start_paused_enabled" instead of "add_stopped_enabled".
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
      return;
    }
  }

  if (loginResponse.data === 'Ok.') {
    // Local-bypass mode: no cookie issued, but the upstream will accept us
    // based on the source address.
    sessionCookie = '';
    return;
  }

  throw new Error('Login response did not include a session cookie');
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
    }
  } catch {
    // Leave capabilities at defaults; upstream may be temporarily unavailable.
  }
}

export function getQbApiCapabilities() {
  return qbApiCapabilities;
}

export function getQbApiVersion() {
  return qbApiVersion;
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
      maxBodyLength: 50 * 1024 * 1024,
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

  const setCookie = response.headers['set-cookie'];
  if (setCookie) {
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const sid = cookies.find(c => /^SID(\d+)?=/.test(c));
    if (sid) {
      sessionCookie = sid.split(';')[0];
    }
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
      await detectCapabilities();
      if (qbApiVersion) {
        const tag = qbApiCapabilities.legacy ? ' (legacy pause/resume mode)' : '';
        console.log(`qBittorrent Web API: ${qbApiVersion}${tag}`);
      }
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
