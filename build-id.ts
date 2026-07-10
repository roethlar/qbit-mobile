import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Identifies the running build in the UI.
 *
 * `package.json` version alone is not enough: it stays put across many commits
 * (it sat at 1.5.2 for the whole 2026-07-10 dependency sweep), so it cannot
 * answer "is the thing I just deployed actually running?".
 *
 * Format: `<version>+<ref>.<YYMMDDHHmm>`, e.g. `1.5.2+e483543.2607101030`.
 *
 * The trailing timestamp is what makes each build distinct. It is load-bearing,
 * not decoration: deploy.sh copies the source tree to /opt/qbit-mobile *without*
 * .git and builds there, so no commit SHA is available at that point and `ref`
 * degrades to `nogit`. Without the timestamp every deployed build would be
 * labelled identically -- exactly the problem this is meant to solve.
 */
export function resolveBuildId(): string {
  const pkgUrl = new URL('./package.json', import.meta.url);
  const { version } = JSON.parse(readFileSync(pkgUrl, 'utf8')) as { version: string };

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
