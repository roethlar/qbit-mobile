import axios from 'axios';

const qbHost = process.env.QBITTORRENT_HOST || 'localhost';
const qbPort = process.env.QBITTORRENT_PORT || 8080;
const qbUser = process.env.QBITTORRENT_USERNAME || '';
const qbPass = process.env.QBITTORRENT_PASSWORD || '';

let sessionCookie = null;

export async function makeQbRequest(method, path, data, headers = {}) {
  const config = {
    method,
    url: `http://${qbHost}:${qbPort}/api/v2${path}`,
    headers: {
      ...headers,
      'Cookie': sessionCookie || ''
    },
    timeout: 30000
  };

  if (data !== undefined) {
    config.data = data;
  }

  try {
    const response = await axios(config);

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
        const loginData = qbUser
          ? `username=${encodeURIComponent(qbUser)}&password=${encodeURIComponent(qbPass)}`
          : 'username=&password=';

        const loginResponse = await axios({
          method: 'POST',
          url: `http://${qbHost}:${qbPort}/api/v2/auth/login`,
          data: loginData,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const loginCookies = loginResponse.headers['set-cookie'];
        if (loginCookies) {
          const cookies = Array.isArray(loginCookies) ? loginCookies : [loginCookies];
          const sid = cookies.find(c => c.includes('SID='));
          if (sid) {
            sessionCookie = sid.split(';')[0];
            config.headers['Cookie'] = sessionCookie;
            return await axios(config);
          }
        }

        if (loginResponse.data === 'Ok.') {
          sessionCookie = '';
          return await axios(config);
        }
      } catch (loginError) {
        console.error('Login failed:', loginError.message);
      }
    }

    throw error;
  }
}

export async function initialLogin() {
  const loginData = qbUser
    ? `username=${encodeURIComponent(qbUser)}&password=${encodeURIComponent(qbPass)}`
    : 'username=&password=';

  await makeQbRequest('POST', '/auth/login', loginData, {
    'Content-Type': 'application/x-www-form-urlencoded'
  });

  console.log('Initial authentication successful');
  console.log(`Auth mode: ${qbUser ? 'Username/Password' : 'Local bypass'}`);
}

export { qbHost, qbPort };
