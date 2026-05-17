import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Persistent state lives under a writable data directory. The systemd unit
// grants ReadWritePaths to this directory; ProtectSystem=strict keeps the
// rest of the install read-only.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const LOCATIONS_FILE = path.join(DATA_DIR, 'locations.json');

const MAX_LOCATIONS = 50;
const MAX_NAME_LENGTH = 64;
const MAX_PATH_LENGTH = 512;

// In-memory cache so GET /api/locations is a sync read after the first load.
// Reset between tests via __resetForTests.
let cache = null;

// Serializes saveLocations so two concurrent PUT /api/locations calls don't
// race on the temp/rename file write. The chain swallows errors so one
// failed write doesn't poison subsequent ones.
let writeChain = Promise.resolve();

export class LocationsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LocationsValidationError';
  }
}

// Pipe-and-equals format from the old DOWNLOAD_LOCATIONS env var. Used as a
// first-boot seed when no JSON file exists yet, so operators with an
// existing env-based config aren't dropped on the floor when they upgrade.
function parseEnvSeed(raw) {
  if (!raw) return [];
  return raw
    .split('|')
    .map((entry) => {
      const eq = entry.indexOf('=');
      if (eq < 0) return null;
      const name = entry.slice(0, eq).trim();
      const p = entry.slice(eq + 1).trim();
      if (!name || !p) return null;
      return { name, path: p };
    })
    .filter(Boolean);
}

// loadLocations() runs the same validation as saveLocations() over whatever
// source it picks up — a manually-edited locations.json or an oversized env
// seed shouldn't get a free pass past the rules the UI enforces. If the
// loaded data fails validation, log + fall back to an empty list so the app
// stays usable and the operator can fix the source.
function safeValidate(raw, source) {
  try {
    return validate(raw);
  } catch (err) {
    console.warn(`[locations] invalid ${source}, ignoring:`, err.message);
    return [];
  }
}

export async function loadLocations() {
  if (cache !== null) return cache;
  if (existsSync(LOCATIONS_FILE)) {
    try {
      const raw = await fs.readFile(LOCATIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.locations)) {
        cache = safeValidate(parsed.locations, 'locations.json');
        return cache;
      }
      console.warn('[locations] locations.json has unexpected shape; ignoring');
    } catch (err) {
      console.warn('[locations] failed to read locations.json:', err.message);
    }
  }
  cache = safeValidate(parseEnvSeed(process.env.DOWNLOAD_LOCATIONS || ''), 'DOWNLOAD_LOCATIONS env');
  return cache;
}

function validate(list) {
  if (!Array.isArray(list)) {
    throw new LocationsValidationError('Expected { locations: [...] }');
  }
  if (list.length > MAX_LOCATIONS) {
    throw new LocationsValidationError(`Too many locations (max ${MAX_LOCATIONS})`);
  }
  const cleaned = [];
  const seen = new Set();
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') {
      throw new LocationsValidationError('Each entry must be an object with name and path');
    }
    if (typeof entry.name !== 'string' || typeof entry.path !== 'string') {
      throw new LocationsValidationError('Each entry needs string name and path');
    }
    const name = entry.name.trim();
    const p = entry.path.trim();
    // Drop blank rows so the UI's empty "add row" template doesn't have to be
    // pruned client-side.
    if (!name && !p) continue;
    if (!name || !p) {
      throw new LocationsValidationError('Both name and path are required');
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new LocationsValidationError(`Name too long (max ${MAX_NAME_LENGTH} chars)`);
    }
    if (p.length > MAX_PATH_LENGTH) {
      throw new LocationsValidationError(`Path too long (max ${MAX_PATH_LENGTH} chars)`);
    }
    if (seen.has(name)) {
      throw new LocationsValidationError(`Duplicate preset name "${name}"`);
    }
    seen.add(name);
    cleaned.push({ name, path: p });
  }
  return cleaned;
}

export async function saveLocations(list) {
  // Validate eagerly so callers get the ValidationError synchronously rather
  // than waiting on the queued write.
  const cleaned = validate(list);
  const work = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Atomic write: tmp + rename so a crash mid-write can't leave a half-file.
    await fs.writeFile(LOCATIONS_FILE + '.tmp', JSON.stringify({ locations: cleaned }, null, 2), { mode: 0o640 });
    await fs.rename(LOCATIONS_FILE + '.tmp', LOCATIONS_FILE);
    cache = cleaned;
  });
  // Don't poison the chain if this write fails — subsequent writes should
  // still proceed. The error still propagates via the awaited `work` below.
  writeChain = work.catch(() => undefined);
  await work;
  return cleaned;
}

export function __resetForTests() {
  cache = null;
  writeChain = Promise.resolve();
}
