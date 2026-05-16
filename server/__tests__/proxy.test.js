import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('axios', () => ({
  default: vi.fn(),
}));

const axios = (await import('axios')).default;
const axiosMock = vi.mocked(axios);

const { app } = await import('../server.js');

const CREDS = ['tester', 'testpw'];

beforeEach(() => {
  axiosMock.mockReset();
  axiosMock.mockResolvedValue({ status: 200, data: [], headers: {} });
});

describe('app auth', () => {
  it('challenges unauthenticated GET with 401 + Basic realm', async () => {
    const res = await request(app).get('/api/v2/torrents/info');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(/^Basic /);
  });

  it('rejects wrong username', async () => {
    const res = await request(app).get('/api/v2/torrents/info').auth('wrong', 'testpw');
    expect(res.status).toBe(401);
  });

  it('rejects wrong password', async () => {
    const res = await request(app).get('/api/v2/torrents/info').auth('tester', 'wrong');
    expect(res.status).toBe(401);
  });

  it('rejects non-Basic Authorization header', async () => {
    const res = await request(app)
      .get('/api/v2/torrents/info')
      .set('Authorization', 'Bearer some-token');
    expect(res.status).toBe(401);
  });

  it('accepts correct credentials', async () => {
    const res = await request(app).get('/api/v2/torrents/info').auth(...CREDS);
    expect(res.status).toBe(200);
  });

  it('does not require auth on the SPA shell or static assets', async () => {
    const res = await request(app).get('/');
    expect(res.status).not.toBe(401);
  });
});

describe('endpoint allowlist', () => {
  const blocked = [
    ['post', '/api/v2/app/shutdown'],
    ['post', '/api/v2/torrents/setLocation'],
    ['post', '/api/v2/torrents/createCategory'],
    ['post', '/api/v2/torrents/setShareLimits'],
    ['get', '/api/v2/log/main'],
    ['get', '/api/v2/log/peers'],
    ['get', '/api/v2/sync/maindata'],
  ];

  it.each(blocked)('blocks %s %s with 404 and never touches upstream', async (method, path) => {
    const res = await request(app)[method](path).auth(...CREDS);
    expect(res.status).toBe(404);
    expect(axiosMock).not.toHaveBeenCalled();
  });

  const allowedGets = [
    '/api/v2/torrents/info',
    '/api/v2/transfer/info',
    '/api/v2/app/preferences',
    '/api/v2/app/version',
    '/api/v2/app/webapiVersion',
  ];

  it.each(allowedGets)('forwards GET %s to upstream', async (path) => {
    const res = await request(app).get(path).auth(...CREDS);
    expect(res.status).toBe(200);
    expect(axiosMock).toHaveBeenCalled();
    const call = axiosMock.mock.calls[axiosMock.mock.calls.length - 1][0];
    expect(call.url).toContain(path.replace('/api/v2', ''));
    expect(call.method).toBe('GET');
  });

  it('forwards POST /torrents/stop with form body', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/stop')
      .auth(...CREDS)
      .send('hashes=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(res.status).toBe(200);
    const call = axiosMock.mock.calls[axiosMock.mock.calls.length - 1][0];
    expect(call.url).toContain('/torrents/stop');
    expect(call.method).toBe('POST');
    expect(call.data).toContain('hashes=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });
});

describe('setPreferences key filter', () => {
  it('rejects payload with only disallowed keys', async () => {
    const res = await request(app)
      .post('/api/v2/app/setPreferences')
      .auth(...CREDS)
      .type('form')
      .send({ json: JSON.stringify({ autorun_enabled: true, autorun_program: '/bin/sh' }) });
    expect(res.status).toBe(400);
    expect(axiosMock).not.toHaveBeenCalled();
  });

  it('strips disallowed keys but forwards allowed ones', async () => {
    const res = await request(app)
      .post('/api/v2/app/setPreferences')
      .auth(...CREDS)
      .type('form')
      .send({
        json: JSON.stringify({
          autorun_program: '/bin/sh',
          web_ui_password: 'override',
          save_path: '/tmp',
          dl_limit: 1024,
        }),
      });
    expect(res.status).toBe(200);
    expect(axiosMock).toHaveBeenCalled();
    const call = axiosMock.mock.calls[axiosMock.mock.calls.length - 1][0];
    const sent = new URLSearchParams(call.data);
    const parsed = JSON.parse(sent.get('json'));
    expect(parsed).toEqual({ save_path: '/tmp', dl_limit: 1024 });
    expect(parsed.autorun_program).toBeUndefined();
    expect(parsed.web_ui_password).toBeUndefined();
  });

  it('rejects malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/v2/app/setPreferences')
      .auth(...CREDS)
      .type('form')
      .send({ json: 'not-json' });
    expect(res.status).toBe(400);
  });

  it('rejects missing json field', async () => {
    const res = await request(app)
      .post('/api/v2/app/setPreferences')
      .auth(...CREDS)
      .type('form')
      .send({ other: 'value' });
    expect(res.status).toBe(400);
  });
});

describe('torrent action hash validation', () => {
  const VALID_HASH = 'a'.repeat(40);
  const VALID_V2_HASH = 'b'.repeat(64);

  it('accepts a valid 40-char hash on /torrents/stop', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/stop')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}`);
    expect(res.status).toBe(200);
  });

  it('accepts a valid 64-char v2 hash on /torrents/start', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/start')
      .auth(...CREDS)
      .send(`hashes=${VALID_V2_HASH}`);
    expect(res.status).toBe(200);
  });

  it('accepts a pipe-separated list of hashes', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/stop')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}|${VALID_V2_HASH}`);
    expect(res.status).toBe(200);
  });

  it('allows hashes=all on /torrents/stop (non-destructive)', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/stop')
      .auth(...CREDS)
      .send('hashes=all');
    expect(res.status).toBe(200);
  });

  it('blocks hashes=all on /torrents/delete', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/delete')
      .auth(...CREDS)
      .send('hashes=all&deleteFiles=true');
    expect(res.status).toBe(400);
    expect(axiosMock).not.toHaveBeenCalled();
  });

  it('rejects garbage in hashes', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/delete')
      .auth(...CREDS)
      .send('hashes=not-a-hash');
    expect(res.status).toBe(400);
  });

  it('rejects missing hashes field', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/delete')
      .auth(...CREDS)
      .send('');
    expect(res.status).toBe(400);
  });

  it('rejects a too-long hash list', async () => {
    const lots = Array.from({ length: 201 }, () => VALID_HASH).join('|');
    const res = await request(app)
      .post('/api/v2/torrents/stop')
      .auth(...CREDS)
      .send(`hashes=${lots}`);
    expect(res.status).toBe(400);
  });
});

describe('CSRF / cross-origin', () => {
  it('rejects cross-origin POST without ALLOWED_ORIGIN', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/stop')
      .set('Origin', 'http://evil.example')
      .auth(...CREDS)
      .send('hashes=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(res.status).toBe(403);
  });

  it('allows same-origin POST (no Origin header)', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/stop')
      .auth(...CREDS)
      .send('hashes=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(res.status).toBe(200);
  });
});

describe('upstream 401 re-login', () => {
  it('refreshes the session and retries when upstream returns 401', async () => {
    let n = 0;
    axiosMock.mockImplementation(async (config) => {
      n++;
      // 1st call: torrent action returns 401 (expired SID).
      if (n === 1) return { status: 401, data: '', headers: {} };
      // 2nd call: auth/login. Return "Ok." -> bypass-mode handshake.
      if (config.url.includes('/auth/login')) {
        return { status: 200, data: 'Ok.', headers: {} };
      }
      // 3rd call: retry of the original action succeeds.
      return { status: 200, data: '', headers: {} };
    });
    const res = await request(app)
      .post('/api/v2/torrents/stop')
      .auth(...CREDS)
      .send('hashes=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(res.status).toBe(200);
    // Initial 401 + /auth/login + retry; capability detection may add
    // a /app/webapiVersion call after login, so just assert >= 3.
    expect(n).toBeGreaterThanOrEqual(3);
    const urls = axiosMock.mock.calls.map((c) => c[0].url);
    expect(urls.some((u) => u.includes('/auth/login'))).toBe(true);
  });
});
