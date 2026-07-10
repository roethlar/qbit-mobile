import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function readVersion(): string {
  const pkgUrl = new URL('./package.json', import.meta.url);
  return (JSON.parse(readFileSync(pkgUrl, 'utf8')) as { version: string }).version;
}

/**
 * The version shown in the UI header. Under the repo's versioning rule
 * (.agents/repo-guidance.md) every shipped-code commit bumps this, so it alone
 * distinguishes one released build from the next.
 */
export function resolveVersion(): string {
  return readVersion();
}

/**
 * The full build fingerprint, exposed only as a tooltip / debugging aid -- never
 * as the visible version. It answers "which exact build is this?" when the
 * version cannot: a rebuild of the same commit, or a working tree with
 * uncommitted changes.
 *
 * Format: `<version>+<ref>.<YYMMDDHHmm>`, e.g. `1.6.0+e483543.2607101030`.
 *
 * `ref` degrades to `nogit` under deploy.sh, which copies the source tree to
 * /opt/qbit-mobile without .git and builds there. The trailing timestamp is what
 * keeps such builds distinguishable from one another.
 */
export function resolveBuildId(): string {
  const version = readVersion();

  // YYMMDDHHmm, UTC. Not human-friendly, but it is short and it sorts.
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12);

  let ref = 'nogit';
  try {
    const git = (cmd: string) =>
      execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const sha = git('git rev-parse --short HEAD');
    const dirty = git('git status --porcelain') !== '';
    ref = dirty ? `${sha}-dirty` : sha;
  } catch {
    // No git: a released tarball, or deploy.sh's copied tree. `nogit` is honest.
  }

  return `${version}+${ref}.${stamp}`;
}
