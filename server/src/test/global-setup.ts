import { execSync } from 'node:child_process';

const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://bim:bim@localhost:5432/bim_test?schema=public';

/** Runs once before all test files: brings the test database schema up to date. */
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
