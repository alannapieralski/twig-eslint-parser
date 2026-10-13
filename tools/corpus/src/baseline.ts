import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Finding } from './types.js';

export function findingKey(finding: Finding): string {
  const templateHash = createHash('sha256').update(finding.template.source).digest('hex').slice(0, 12);
  return `${finding.check}|${templateHash}|${finding.message}`;
}

export function loadBaseline(baselinePath: string): Set<string> {
  if (!existsSync(baselinePath)) return new Set();
  const entries: unknown = JSON.parse(readFileSync(baselinePath, 'utf8'));
  if (!Array.isArray(entries)) throw new Error(`${baselinePath} must be a JSON array of finding keys.`);
  return new Set(entries.map(String));
}

export function writeBaseline(baselinePath: string, keys: Iterable<string>): void {
  writeFileSync(baselinePath, `${JSON.stringify([...new Set(keys)].sort(), null, 2)}\n`);
}

export function checkOfKey(key: string): string {
  return key.split('|', 1)[0] ?? key;
}
