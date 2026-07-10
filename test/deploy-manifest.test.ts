import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

// The three deploy scripts copy a hand-maintained list of root-level files into
// the install directory and build there. Nothing tied that list to what
// vite.config.ts actually imports, so adding build-id.ts at the repo root broke
// `sudo ./deploy.sh` with "Could not resolve './build-id'" -- after lint,
// typecheck, tests and a local build had all passed, because the repo checkout
// has every file present.
//
// This asserts each root-level module vite.config.ts imports is copied by every
// deploy script.

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => readFileSync(path.join(repoRoot, f), 'utf8');

const DEPLOY_SCRIPTS = ['deploy.sh', 'deploy-macos.sh', 'deploy.ps1'];

/** Root-relative modules vite.config.ts imports, e.g. './build-id' -> build-id.ts */
function localImportsOfViteConfig(): string[] {
  const src = read('vite.config.ts');
  const matches = [...src.matchAll(/from\s+'\.\/([^']+)'/g)].map((m) => m[1]);
  return matches.map((m) => (m.endsWith('.ts') ? m : `${m}.ts`));
}

describe('deploy scripts copy everything vite.config.ts needs', () => {
  it('finds at least one local import to check', () => {
    // Guards the regex itself: if it silently matched nothing, every assertion
    // below would pass vacuously.
    expect(localImportsOfViteConfig().length).toBeGreaterThan(0);
  });

  it.each(DEPLOY_SCRIPTS)('%s copies each local import of vite.config.ts', (script) => {
    const contents = read(script);
    for (const file of localImportsOfViteConfig()) {
      expect(contents, `${script} does not copy ${file}`).toContain(file);
    }
  });

  it.each(DEPLOY_SCRIPTS)('%s copies vite.config.ts itself', (script) => {
    expect(read(script)).toContain('vite.config.ts');
  });
});

// `npm ci` installs exactly the lockfile that CI tested and `npm audit` checked.
// Falling back to `npm install` on failure resolves fresh versions from the
// registry, deploying a dependency tree nothing verified -- as root, on the host
// fronting qBittorrent. A failing `npm ci` means the lockfile is wrong; the
// deploy must stop, not paper over it.
describe('deploy scripts never fall back from npm ci to npm install', () => {
  it.each(DEPLOY_SCRIPTS)('%s does not fall back to npm install', (script) => {
    const contents = read(script);
    expect(contents).not.toMatch(/npm ci\s*\|\|\s*npm install/);
    expect(contents).not.toMatch(/falling back to npm install/i);
    // The PowerShell form: a bare `npm install` invocation anywhere.
    expect(contents).not.toMatch(/&\s*npm install/);
  });

  it.each(DEPLOY_SCRIPTS)('%s still runs npm ci', (script) => {
    expect(read(script)).toMatch(/npm ci/);
  });
});
