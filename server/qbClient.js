import axios from 'axios';

const qbHost = process.env.QBITTORRENT_HOST || 'localhost';
const qbPort = process.env.QBITTORRENT_PORT || 8080;
const qbUser = process.env.QBITTORRENT_USERNAME || '';
const qbPass = process.env.QBITTORRENT_PASSWORD || '';

let sessionCookie = null;
let loginInFlight = null;

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
  });

  const loginCookies = loginResponse.headers['set-cookie'];
  if (loginCookies) {
    const cookies = Array.isArray(loginCookies) ? loginCookies : [loginCookies];
    const sid = cookies.find(c => c.includes('SID='));
    if (sid) {
      sessionCookie = sid.split(';')[0];
      return;
    }
  }

  // No cookie returned but login was OK -> bypass mode.
  if (loginResponse.data === 'Ok.') {
    sessionCookie = '';
    return;
  }

  throw new Error('Login response did not include a session cookie');
}

// Coalesce concurrent logins into a single in-flight promise so a thundering
// herd of 401 retries doesn't trigger N parallel logins.
function ensureLogin() {
  if (!loginInFlight) {
    loginInFlight = performLogin().finally(() => {
      loginInFlight = null;
    });
  }
  return loginInFlight;
}

export async function makeQbRequest(method, path, data, headers = {}) {
  const buildConfig = () => {
    const config = {
      method,
      url: `http://${qbHost}:${qbPort}/api/v2${path}`,
      headers: {
        ...headers,
        Cookie: sessionCookie || '',
      },
      timeout: 30000,
    };
    if (data !== undefined) config.data = data;
    return config;
  };

  try {
    const response = await axios(buildConfig());
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      const sid = cookies.find(c => c.includes('SID='));
      if (sid) {
        sessionCookie = sid.split(';')[0];
      }
    }
    return response;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      try {
        await ensureLogin();
        return await axios(buildConfig());
      } catch (loginError) {
        console.error('Login failed:', loginError.message);
      }
    }
    throw error;
  }
}

export async function initialLogin() {
  await ensureLogin();
  console.log('Initial authentication successful');
  console.log(`Auth mode: ${qbUser ? 'Username/Password' : 'Local bypass'}`);
}

export { qbHost, qbPort };
