// One-time local setup after `npm install`: env file, database schema and demo project.
// Requires PostgreSQL running (`docker compose up -d`).
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';

if (!existsSync('server/.env')) {
  copyFileSync('server/.env.example', 'server/.env');
  console.log('Created server/.env from server/.env.example');
}

const run = (command) => execSync(command, { stdio: 'inherit' });
run('npm run db:deploy -w @bim/server');
run('npm run db:seed -w @bim/server');
console.log('\nListo. Ejecuta `npm run dev` y abre http://localhost:5173');
