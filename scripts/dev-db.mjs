// One command to run the app AND the responses database together (for the study / DB demo).
// Starts the SQLite responses server (server/server.mjs) and the Vite dev server side by side;
// Ctrl-C stops both. Used by `npm run dev:db`.

import { spawn } from 'node:child_process';
import process from 'node:process';

const opts = { stdio: 'inherit', shell: true };
const procs = [
  spawn('npm', ['run', 'server'], opts),
  spawn('npm', ['run', 'dev'], opts),
];

const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', stop));
