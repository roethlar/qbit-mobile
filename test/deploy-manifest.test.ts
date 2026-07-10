import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

// deploy-macos.sh and deploy.ps1 copy a hand-maintained list of root-level files
// into the install directory and build there. Nothing tied that list to what
// vite.config.ts actually imports, so adding build-id.ts at the repo root broke
// `sudo ./deploy.sh` with "Could not resolve './build-id'" -- after lint,
// typecheck, tests and a local build had all passed, because the repo checkout
// has every file present.
//
// deploy.sh has since been rewritten to copy everything except an exclude list,
// so it has no manifest to drift. It is checked differently: that it still copies
// by default, and that no exclude swallows a file the build needs.

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => readFileSync(path.join(repoRoot, f), 'utf8');

/**
 * Strip comments before matching. Without this these assertions pass on prose:
 * deploy.sh's comment explaining the build-id.ts incident contains the literal
 * string "build-id.ts", which satisfied a naive `toContain` even after the copy
 * line was deleted.
 */
function stripComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** Root-relative modules vite.config.ts imports, e.g. './build-id' -> build-id.ts */
function localImportsOfViteConfig(): string[] {
  const src = read('vite.config.ts');
  const matches = [...src.matchAll(/from\s+'\.\/([^']+)'/g)].map((m) => m[1]);
  return matches.map((m) => (m.endsWith('.ts') ? m : `${m}.ts`));
}

const MANIFEST_SCRIPTS = ['deploy-macos.sh', 'deploy.ps1'];
const ALL_SCRIPTS = ['deploy.sh', ...MANIFEST_SCRIPTS];

describe('vite.config.ts local imports are known', () => {
  it('finds at least one', () => {
    // Guards the regex: if it silently matched nothing, every assertion that
    // iterates over it would pass vacuously.
    expect(localImportsOfViteConfig().length).toBeGreaterThan(0);
  });
});

describe('manifest-style deploy scripts copy everything vite.config.ts needs', () => {
  it.each(MANIFEST_SCRIPTS)('%s copies each local import of vite.config.ts', (script) => {
    const code = stripComments(read(script));
    for (const file of localImportsOfViteConfig()) {
      expect(code, `${script} does not copy ${file}`).toContain(file);
    }
  });

  it.each(MANIFEST_SCRIPTS)('%s copies vite.config.ts itself', (script) => {
    expect(stripComments(read(script))).toContain('vite.config.ts');
  });
});

describe('deploy.sh copies by default rather than by manifest', () => {
  it('stages with tar and does not name build inputs individually', () => {
    const code = stripComments(read('deploy.sh'));
    expect(code).toMatch(/tar -cf -/);
    // If someone reintroduces a per-file copy list, this is the tripwire.
    expect(code).not.toMatch(/cp\s+vite\.config\.ts/);
  });

  it('excludes nothing that vite.config.ts imports', () => {
    const code = stripComments(read('deploy.sh'));
    const excluded = [...code.matchAll(/--exclude=\.\/(\S+)/g)].map((m) => m[1]);
    expect(excluded.length).toBeGreaterThan(0);
    for (const file of [...localImportsOfViteConfig(), 'vite.config.ts', 'package.json', 'src', 'server']) {
      expect(excluded, `deploy.sh excludes ${file}, which the build needs`).not.toContain(file);
    }
  });

  it('still excludes the things that must never ship or must be rebuilt', () => {
    const code = stripComments(read('deploy.sh'));
    const excluded = [...code.matchAll(/--exclude=\.\/(\S+)/g)].map((m) => m[1]);
    for (const file of ['.git', 'node_modules', 'dist', '.env', 'data']) {
      expect(excluded, `deploy.sh must exclude ${file}`).toContain(file);
    }
  });

  it('swaps a staged tree into place instead of mutating the live install', () => {
    const code = stripComments(read('deploy.sh'));
    expect(code).toMatch(/STAGE_DIR=/);
    // The old fossil list -- proof the destructive pre-copy wipe is gone.
    expect(code).not.toMatch(/rm -rf "\$\{APP_DIR\}\/server"/);
  });
});

// `npm ci` installs exactly the lockfile that CI tested and `npm audit` checked.
// Falling back to `npm install` on failure resolves fresh versions from the
// registry, deploying a dependency tree nothing verified -- as root, on the host
// fronting qBittorrent. A failing `npm ci` means the lockfile is wrong; the
// deploy must stop, not paper over it.
describe('deploy scripts never fall back from npm ci to npm install', () => {
  it.each(ALL_SCRIPTS)('%s does not fall back to npm install', (script) => {
    const code = stripComments(read(script));
    expect(code).not.toMatch(/npm ci\s*\|\|\s*npm install/);
    expect(code).not.toMatch(/falling back to npm install/i);
    expect(code).not.toMatch(/&\s*npm install/);
  });

  it.each(ALL_SCRIPTS)('%s still runs npm ci', (script) => {
    expect(stripComments(read(script))).toMatch(/npm ci/);
  });
});
