import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('axios', () => ({
  default: vi.fn(),
}));

const axios = (await import('axios')).default;
const axiosMock = vi.mocked(axios);

const { app } = await import('../server.js');
const { __resetCapabilitiesForTests } = await import('../qbClient.js');
const { __resetForTests: __resetLocationsForTests, saveLocations } = await import('../locations.js');

const LOCATIONS_FILE = path.join(process.env.DATA_DIR, 'locations.json');

function writeRawLocationsFile(payload) {
  fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
  fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(payload));
}

function clearLocationsFile() {
  try { fs.unlinkSync(LOCATIONS_FILE); } catch { /* not present */ }
}

const CREDS = ['tester', 'testpw'];

beforeEach(() => {
  axiosMock.mockReset();
  axiosMock.mockResolvedValue({ status: 200, data: [], headers: {} });
  // qbClient holds module state (cap flags, session cookie). Without this
  // a prior test's confirmLegacyMode() leaks and changes path routing.
  __resetCapabilitiesForTests();
  // locations.js caches loaded entries in-memory; reset so each test starts
  // from the env seed or empty file.
  __resetLocationsForTests();
  clearLocationsFile();
  delete process.env.DOWNLOAD_LOCATIONS;
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

describe('per-torrent detail endpoints', () => {
  const VALID_HASH = 'c'.repeat(40);

  it.each(['/torrents/properties', '/torrents/files', '/torrents/trackers'])(
    'forwards GET %s with a valid hash',
    async (path) => {
      const res = await request(app)
        .get(`/api/v2${path}?hash=${VALID_HASH}`)
        .auth(...CREDS);
      expect(res.status).toBe(200);
      const call = axiosMock.mock.calls[axiosMock.mock.calls.length - 1][0];
      expect(call.url).toContain(`${path}?hash=${VALID_HASH}`);
    },
  );

  it('rejects missing hash query', async () => {
    const res = await request(app)
      .get('/api/v2/torrents/properties')
      .auth(...CREDS);
    expect(res.status).toBe(400);
    expect(axiosMock).not.toHaveBeenCalled();
  });

  it('rejects malformed hash query', async () => {
    const res = await request(app)
      .get('/api/v2/torrents/files?hash=not-a-hash')
      .auth(...CREDS);
    expect(res.status).toBe(400);
  });

  it('strips any extra query params (only forwards validated hash)', async () => {
    const res = await request(app)
      .get(`/api/v2/torrents/properties?hash=${VALID_HASH}&extra=foo&another=bar`)
      .auth(...CREDS);
    expect(res.status).toBe(200);
    const call = axiosMock.mock.calls[axiosMock.mock.calls.length - 1][0];
    expect(call.url).not.toContain('extra');
    expect(call.url).not.toContain('another');
  });
});

describe('setLocation', () => {
  const VALID_HASH = 'f'.repeat(40);

  it('forwards POST /torrents/setLocation with valid hash + location', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/setLocation')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}&location=${encodeURIComponent('/mnt/movies')}`);
    expect(res.status).toBe(200);
    const call = axiosMock.mock.calls[axiosMock.mock.calls.length - 1][0];
    expect(call.url).toContain('/torrents/setLocation');
    expect(call.data).toContain(`hashes=${VALID_HASH}`);
    expect(call.data).toContain('location=');
  });

  it('rejects missing location', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/setLocation')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}`);
    expect(res.status).toBe(400);
    expect(axiosMock).not.toHaveBeenCalled();
  });

  it('rejects empty location', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/setLocation')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}&location=`);
    expect(res.status).toBe(400);
  });

  it('rejects hashes=all (destructive at scale)', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/setLocation')
      .auth(...CREDS)
      .send('hashes=all&location=/tmp');
    expect(res.status).toBe(400);
  });
});

describe('location presets endpoint', () => {
  it('returns an empty array when no persisted file and no env seed', async () => {
    const res = await request(app).get('/api/locations').auth(...CREDS);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ locations: [] });
  });

  it('still requires auth', async () => {
    const res = await request(app).get('/api/locations');
    expect(res.status).toBe(401);
  });

  it('PUT persists a list and subsequent GET returns it', async () => {
    const payload = {
      locations: [
        { name: 'Movies', path: '/mnt/movies' },
        { name: 'TV', path: '/mnt/tv' },
      ],
    };
    const put = await request(app)
      .put('/api/locations')
      .auth(...CREDS)
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(put.status).toBe(200);
    expect(put.body.locations).toEqual(payload.locations);

    const get = await request(app).get('/api/locations').auth(...CREDS);
    expect(get.status).toBe(200);
    expect(get.body.locations).toEqual(payload.locations);
  });

  it('PUT trims whitespace and skips blank rows', async () => {
    const res = await request(app)
      .put('/api/locations')
      .auth(...CREDS)
      .set('Content-Type', 'application/json')
      .send({
        locations: [
          { name: '  Movies  ', path: '  /mnt/movies  ' },
          { name: '', path: '' },
          { name: 'TV', path: '/mnt/tv' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.locations).toEqual([
      { name: 'Movies', path: '/mnt/movies' },
      { name: 'TV', path: '/mnt/tv' },
    ]);
  });

  it('PUT rejects half-populated entries', async () => {
    const res = await request(app)
      .put('/api/locations')
      .auth(...CREDS)
      .set('Content-Type', 'application/json')
      .send({ locations: [{ name: 'NameOnly', path: '' }] });
    expect(res.status).toBe(400);
  });

  it('PUT rejects duplicate names', async () => {
    const res = await request(app)
      .put('/api/locations')
      .auth(...CREDS)
      .set('Content-Type', 'application/json')
      .send({
        locations: [
          { name: 'Movies', path: '/a' },
          { name: 'Movies', path: '/b' },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('PUT rejects non-array body', async () => {
    const res = await request(app)
      .put('/api/locations')
      .auth(...CREDS)
      .set('Content-Type', 'application/json')
      .send({ locations: 'nope' });
    expect(res.status).toBe(400);
  });

  it('PUT requires auth', async () => {
    const res = await request(app)
      .put('/api/locations')
      .set('Content-Type', 'application/json')
      .send({ locations: [] });
    expect(res.status).toBe(401);
  });

  it('load drops a corrupt on-disk list (too many entries) and returns []', async () => {
    // Bypass saveLocations so the invalid payload actually lands on disk.
    writeRawLocationsFile({
      locations: Array.from({ length: 100 }, (_, i) => ({ name: `n${i}`, path: `/p${i}` })),
    });
    const res = await request(app).get('/api/locations').auth(...CREDS);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ locations: [] });
  });

  it('load drops a corrupt on-disk list (duplicate names) and returns []', async () => {
    writeRawLocationsFile({
      locations: [
        { name: 'Movies', path: '/a' },
        { name: 'Movies', path: '/b' },
      ],
    });
    const res = await request(app).get('/api/locations').auth(...CREDS);
    expect(res.body).toEqual({ locations: [] });
  });

  it('load drops a bad env seed (duplicate names) and returns []', async () => {
    process.env.DOWNLOAD_LOCATIONS = 'Movies=/a|Movies=/b';
    const res = await request(app).get('/api/locations').auth(...CREDS);
    expect(res.body).toEqual({ locations: [] });
  });

  it('concurrent saves serialize without corrupting the file', async () => {
    const a = saveLocations([{ name: 'A', path: '/a' }]);
    const b = saveLocations([{ name: 'B', path: '/b' }]);
    await Promise.all([a, b]);
    const onDisk = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
    // Last-write-wins: the file ends up as exactly one of the two payloads,
    // not a mix.
    expect(onDisk.locations).toHaveLength(1);
    const name = onDisk.locations[0].name;
    expect(['A', 'B']).toContain(name);
  });
});

describe('recheck and reannounce', () => {
  const VALID_HASH = 'd'.repeat(40);

  it('forwards POST /torrents/recheck with a valid hash', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/recheck')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}`);
    expect(res.status).toBe(200);
  });

  it('forwards POST /torrents/reannounce with a valid hash', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/reannounce')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}`);
    expect(res.status).toBe(200);
  });

  it('rejects hashes=all on /torrents/recheck (destructive-ish)', async () => {
    const res = await request(app)
      .post('/api/v2/torrents/recheck')
      .auth(...CREDS)
      .send('hashes=all');
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

describe('qB4 404 fallback for stop/start', () => {
  const VALID_HASH = 'e'.repeat(40);

  it('retries /torrents/stop as /torrents/pause when upstream returns 404', async () => {
    axiosMock.mockImplementation(async (config) => {
      if (config.url.includes('/torrents/stop')) {
        return { status: 404, data: 'not found', headers: {} };
      }
      if (config.url.includes('/torrents/pause')) {
        return { status: 200, data: '', headers: {} };
      }
      return { status: 200, data: [], headers: {} };
    });
    const res = await request(app)
      .post('/api/v2/torrents/stop')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}`);
    expect(res.status).toBe(200);
    const calls = axiosMock.mock.calls.map((c) => c[0].url);
    expect(calls.some((u) => u.endsWith('/torrents/stop'))).toBe(true);
    expect(calls.some((u) => u.endsWith('/torrents/pause'))).toBe(true);
  });

  it('retries /torrents/start as /torrents/resume on 404', async () => {
    axiosMock.mockImplementation(async (config) => {
      if (config.url.includes('/torrents/start')) {
        return { status: 404, data: 'not found', headers: {} };
      }
      if (config.url.includes('/torrents/resume')) {
        return { status: 200, data: '', headers: {} };
      }
      return { status: 200, data: [], headers: {} };
    });
    const res = await request(app)
      .post('/api/v2/torrents/start')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}`);
    expect(res.status).toBe(200);
    const calls = axiosMock.mock.calls.map((c) => c[0].url);
    // The initial /start must be attempted before the fallback retry —
    // otherwise the test is just exercising legacy-mode routing carried
    // over from another test.
    expect(calls.some((u) => u.endsWith('/torrents/start'))).toBe(true);
    expect(calls.some((u) => u.endsWith('/torrents/resume'))).toBe(true);
  });

  it('does not retry /torrents/delete on 404', async () => {
    axiosMock.mockImplementation(async () => ({ status: 404, data: '', headers: {} }));
    const res = await request(app)
      .post('/api/v2/torrents/delete')
      .auth(...CREDS)
      .send(`hashes=${VALID_HASH}`);
    expect(res.status).toBe(404);
    const calls = axiosMock.mock.calls.map((c) => c[0].url);
    // No /erase, /pause, /resume etc — delete has no legacy alias.
    expect(calls.filter((u) => u.includes('/torrents/'))).toHaveLength(1);
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
