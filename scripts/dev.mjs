// Starts the API and the frontend together (Ctrl+C stops both).
// A dozen lines of Node instead of a dependency such as concurrently.
import { spawn } from 'node:child_process';

const processes = ['@bim/server', '@bim/client'].map((workspace) =>
  spawn('npm', ['run', 'dev', '-w', workspace], { stdio: 'inherit', shell: true }),
);

const stopAll = () => {
  for (const child of processes) if (!child.killed) child.kill();
};

for (const child of processes) {
  child.on('exit', (code) => {
    stopAll();
    process.exitCode = code ?? 0;
  });
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
