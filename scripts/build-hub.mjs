// Build the "hub": one static site containing every version in its own subfolder, plus the
// landing menu (hub/index.html) at the root. Output → dist/  (index.html, v1/, v2/, … v5/).
//
// Each version lives on its own branch; this script checks each one out and builds it with a
// RELATIVE base (./) so the bundle works under any path (/v1/, /v2/, …) and on any host.
//
// Usage:  node scripts/build-hub.mjs   (also the Vercel build command — see vercel.json)
//
// On a fresh CI clone (e.g. Vercel) only the deployed branch exists, so we fetch each version
// branch first. Locally the branches already exist and the fetch is skipped.

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const VERSIONS = ['v1', 'v2', 'v3', 'v4', 'v5'];
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const out = (cmd) => execSync(cmd).toString().trim();

// Remember where we started so we can return here no matter what. Prefer the branch name (keeps
// HEAD attached locally); fall back to the commit SHA when already detached (e.g. on CI).
let startRef;
try {
  startRef = out('git symbolic-ref --short -q HEAD');
} catch {
  startRef = out('git rev-parse HEAD');
}

// Make sure every version branch is available locally (no-op if it already is).
for (const v of VERSIONS) {
  try {
    out(`git rev-parse --verify ${v}`);
  } catch {
    run(`git fetch --depth=1 origin ${v}:${v}`);
  }
}

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

try {
  for (const v of VERSIONS) {
    run(`git checkout -q ${v}`);
    run(`npm run build -- --base=./ --outDir=dist/${v}`);
  }
} finally {
  run(`git checkout -q ${startRef}`);
}

// Landing menu at the root (hub/ only exists on the starting branch, which we're back on).
cpSync('hub/index.html', 'dist/index.html');
console.log('\nHub built → dist/  (index + ' + VERSIONS.join(', ') + ')');
