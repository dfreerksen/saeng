#!/usr/bin/env node
// Runs `npm outdated` and reports what's outdated, grouping by update type:
//   - patch  (1.2.3 → 1.2.4): safe
//   - minor  (1.2.3 → 1.3.0): usually safe
//   - major  (1.2.3 → 2.0.0): breaking changes likely
//
// Exits 0 whether or not deps are outdated (non-zero only on script error).

import { execSync } from 'node:child_process';

function semverType(current, latest) {
  const [cMaj, cMin] = current.replace(/^[^0-9]*/, '').split('.').map(Number);
  const [lMaj, lMin] = latest.replace(/^[^0-9]*/, '').split('.').map(Number);
  if (lMaj > cMaj) return 'major';
  if (lMin > cMin) return 'minor';
  return 'patch';
}

let raw;
try {
  raw = execSync('npm outdated --json', { encoding: 'utf8' });
} catch (err) {
  // npm outdated exits with code 1 when there are outdated packages — that's normal
  raw = err.stdout ?? '{}';
}

const outdated = JSON.parse(raw || '{}');
const entries = Object.entries(outdated);

if (entries.length === 0) {
  console.log('✅ All dependencies are up to date.');
  process.exit(0);
}

const groups = { major: [], minor: [], patch: [] };

for (const [name, info] of entries) {
  const type = semverType(info.current, info.latest);
  groups[type].push({ name, ...info, type });
}

const label = { major: '🔴 Major (breaking changes likely)', minor: '🟡 Minor', patch: '🟢 Patch' };

for (const type of ['major', 'minor', 'patch']) {
  const pkgs = groups[type];
  if (pkgs.length === 0) continue;
  console.log(`\n${label[type]}`);
  for (const p of pkgs) {
    const devFlag = p.type === 'devDependencies' ? ' (dev)' : '';
    console.log(`  ${p.name}${devFlag}: ${p.current} → ${p.latest}  (wanted: ${p.wanted})`);
  }
}

console.log(`\nTotal outdated: ${entries.length} (${groups.major.length} major, ${groups.minor.length} minor, ${groups.patch.length} patch)`);
