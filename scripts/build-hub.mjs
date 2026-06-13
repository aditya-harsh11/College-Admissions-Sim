// Build the "hub": one static site containing every version in its own subfolder, plus the
// landing menu (hub/index.html) at the root. Output → dist/  (index.html, v1/, … v5/).
//
// Each version lives on its own branch. We build them LOCALLY (where every version branch
// already exists) and COMMIT the finished dist/ — Vercel then just SERVES dist/ as static
// files and never has to build or fetch branches itself. That removes the only fragile part
// of the deploy (a fresh CI clone fetching + checking out other branches). See DEV_NOTES §2.
//
//   Workflow:  npm run build:hub  →  git add dist && commit  →  push.
//
// To avoid clobbering your working tree while it hops across branches, each version is built
// into a throwaway, git-ignored staging dir (.dist-staging); the results are assembled into
// the tracked dist/ only at the very end, back on the starting branch. (Building straight
// into dist/ would make the final "checkout back to main" collide with main's committed dist.)

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const VERSIONS = ['v1', 'v2', 'v3', 'v4', 'v5'];
const STAGING = '.dist-staging';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const out = (cmd) => execSync(cmd).toString().trim();
const quiet = (cmd) => {
  try {
    execSync(cmd, { stdio: 'ignore' });
  } catch {
    /* best-effort cleanup — ignore */
  }
};

// Remember where we started so we can return here. Prefer the branch name (keeps HEAD attached
// locally); fall back to the commit SHA when already detached.
let startRef;
try {
  startRef = out('git symbolic-ref --short -q HEAD');
} catch {
  startRef = out('git rev-parse HEAD');
}

// Put the tracked dist/ back to its committed state so the branch checkouts below can't fail
// with "local changes would be overwritten". No-op on the first run (dist/ not committed yet).
quiet('git checkout -q HEAD -- dist');
quiet('git clean -fdq -- dist');

// Fresh staging dir for the per-version builds (git-ignored, so checkouts leave it untouched).
rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING, { recursive: true });

try {
  for (const v of VERSIONS) {
    run(`git checkout -q ${v}`);
    // --base=./ → relative asset paths so each bundle works under /v1/, /v2/, … on any host.
    run(`npm run build -- --base=./ --outDir=${STAGING}/${v}`);
  }
} finally {
  run(`git checkout -q ${startRef}`);
}

// Assemble the tracked dist/ from the staged builds + the landing menu, then drop staging.
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
for (const v of VERSIONS) cpSync(`${STAGING}/${v}`, `dist/${v}`, { recursive: true });
cpSync('hub/index.html', 'dist/index.html');
rmSync(STAGING, { recursive: true, force: true });

console.log('\nHub built → dist/  — next: git add dist && commit && push (Vercel serves it as-is).');
