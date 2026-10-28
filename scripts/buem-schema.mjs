// Copies BuEM's request schema from buem-gateway, which owns the contract, at
// the commit pinned in schemas/buem/source.json. `--check` fails when the copy
// differs from that commit, so the tests validate against the contract itself.
// Usage: node scripts/buem-schema.mjs [--check]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = JSON.parse(readFileSync(`${root}schemas/buem/source.json`, 'utf8'));
const url = `https://raw.githubusercontent.com/${source.repo}/${source.ref}/${source.path}`;
const target = `${root}schemas/buem/${source.path.split('/').slice(-2).join('/')}`;

const response = await fetch(url);
if (!response.ok) throw new Error(`buem-schema: ${url} answered ${response.status}`);
const upstream = await response.text();

if (process.argv.includes('--check')) {
  if (!existsSync(target)) {
    console.error(`buem-schema: ${target} is missing; run npm run schema:sync`);
    process.exit(1);
  }
  if (readFileSync(target, 'utf8') !== upstream) {
    console.error(`buem-schema: ${target} differs from ${url}; run npm run schema:sync`);
    process.exit(1);
  }
  console.log(`buem-schema: ${target} matches ${source.repo}@${source.ref.slice(0, 7)}`);
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, upstream);
  console.log(`buem-schema: wrote ${target} from ${source.repo}@${source.ref.slice(0, 7)}`);
}
