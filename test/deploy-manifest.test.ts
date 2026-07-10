import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

// The deploy scripts used to copy a hand-maintained list of root-level files
// into the install directory and build there. Nothing tied that list to what
// vite.config.ts actually imports, so adding build-id.ts at the repo root broke
// `sudo ./deploy.sh` with "Could not resolve './build-id'" -- after lint,
// typecheck, tests and a local build had all passed, because the repo checkout
// has every file present.
//
// All three now stage the files git tracks, so there is no manifest to drift.
// They are checked structurally instead: the file list comes from git, no
// exclude list filters it, and a staged tree is swapped into place rather than
// mutating the live install. The shell scripts stage via a tar pipe; deploy.ps1
// copies each tracked path individually (tar is not guaranteed on Windows), so
// its assertions differ slightly.

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

const GIT_STAGED_SCRIPTS = ['deploy.sh', 'deploy-macos.sh'];
const ALL_SCRIPTS = [...GIT_STAGED_SCRIPTS, 'deploy.ps1'];

describe('vite.config.ts local imports are known', () => {
  it('finds at least one', () => {
    // Guards the regex: if it silently matched nothing, every assertion that
    // iterates over it would pass vacuously.
    expect(localImportsOfViteConfig().length).toBeGreaterThan(0);
  });
});

// deploy.ps1 stages by copying each `git ls-files` path individually rather
// than piping through tar: Windows 10/11 usually ship bsdtar, but it is not
// guaranteed. Newline-delimited output is safe there because filenames with
// newlines cannot occur on Windows.
describe('deploy.ps1 stages the files git tracks', () => {
  const code = stripComments(read('deploy.ps1'));

  it('derives the file list from git, not from a hand-written manifest', () => {
    expect(code).toMatch(/git .*ls-files/);
    // Tripwires against reintroducing a per-file copy list.
    expect(code).not.toMatch(/Copy-Item -Path \.\\server/);
    expect(code).not.toContain("'vite.config.ts'");
  });

  it('refuses to run outside a git repository rather than staging blindly', () => {
    expect(code).toMatch(/rev-parse --git-dir/);
  });

  it('swaps a staged tree into place instead of mutating the live install', () => {
    expect(code).toMatch(/\$StageDir\s*=/);
    // The old fossil wipe -- proof the destructive pre-copy delete is gone.
    expect(code).not.toMatch(/Remove-Item -Path \$target -Recurse -Force/);
  });

  it('reads the Node floor from package.json instead of hardcoding it', () => {
    expect(code).toContain('engines.node');
    expect(code, 'deploy.ps1 hardcodes a Node major').not.toMatch(/-lt\s+2[0-9]\b/);
  });
});

describe.each(GIT_STAGED_SCRIPTS)('%s stages the files git tracks', (script) => {
  const code = stripComments(read(script));

  it('derives the file list from git, not from a hand-written manifest', () => {
    expect(code).toMatch(/git .*ls-files/);
    // Tripwire against reintroducing a per-file copy list.
    expect(code).not.toMatch(/cp\s+vite\.config\.ts/);
  });

  // An exclude list fails OPEN. .gitignore hides .env.local, .env.production and
  // friends because they hold secrets; an exclude list that forgets one copies it
  // into ${APP_DIR}, silently. This was not hypothetical -- the exclude list
  // briefly shipped in ac7676a staged a planted .env.local containing a secret.
  // A forgotten include only breaks the deploy, loudly, before anything ships.
  it('does not filter with a tar exclude list', () => {
    expect(code, `${script} must not stage via an exclude list`).not.toMatch(/--exclude=/);
  });

  it('refuses to run outside a git repository rather than staging blindly', () => {
    expect(code).toMatch(/rev-parse --git-dir/);
  });

  it('handles paths with spaces or newlines', () => {
    expect(code).toMatch(/ls-files -z/);
    expect(code).toMatch(/tar --null -T -/);
  });

  it('swaps a staged tree into place instead of mutating the live install', () => {
    expect(code).toMatch(/STAGE_DIR=/);
    // The old fossil list -- proof the destructive pre-copy wipe is gone.
    expect(code).not.toMatch(/rm -rf "\$\{APP_DIR\}\/server"/);
  });
});

// Staging tracked files only is safe *because* the secrets are untracked. If a
// .env ever became tracked, `git ls-files` would happily deploy it.
describe('secrets stay untracked, which is what makes git ls-files safe', () => {
  const tracked = execSync('git ls-files', { cwd: repoRoot }).toString().split('\n');

  it.each(['.env', '.env.local', '.env.production', '.env.development.local'])(
    '%s is not tracked',
    (secret) => {
      expect(tracked).not.toContain(secret);
    },
  );

  it('no build artifact or dependency directory is tracked', () => {
    expect(tracked.some((f) => f.startsWith('node_modules/'))).toBe(false);
    expect(tracked.some((f) => f.startsWith('dist/'))).toBe(false);
  });

  it('every local import of vite.config.ts IS tracked, or the deploy cannot build', () => {
    for (const file of localImportsOfViteConfig()) {
      expect(tracked, `${file} is untracked; deploy.sh would not stage it`).toContain(file);
    }
  });
});

// The supported Node floor is declared once, in package.json `engines.node`.
// deploy.sh, deploy-macos.sh and deploy.ps1 each used to restate it as a literal
// "22.12", which is how three copies drifted from the one that matters.
describe.each(GIT_STAGED_SCRIPTS)('%s reads the Node floor from package.json', (script) => {
  it('does not hardcode a version floor', () => {
    const code = stripComments(read(script));
    expect(code).toContain("engines.node");
    expect(code, `${script} hardcodes a Node major`).not.toMatch(/-lt\s+2[0-9]\b/);
  });
});

describe('engines.node stays in the form the deploy scripts can parse', () => {
  const enginesNode = (JSON.parse(read('package.json')) as { engines: { node: string } }).engines.node;

  it('engines.node stays in the >=X.Y.Z form', () => {
    // The scripts abort rather than guess when this does not match. Changing
    // engines.node to e.g. "^20.19.0 || >=22.12.0" would break every deploy, so
    // fail here instead -- in CI, where it is cheap.
    const floor = /^>=(\d+)\.(\d+)/.exec(enginesNode);
    expect(floor, `engines.node "${enginesNode}" is not a plain >=X.Y[.Z] range`).not.toBeNull();
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
