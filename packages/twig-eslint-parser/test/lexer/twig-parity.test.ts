import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findParityMismatches, type Golden } from './parity.js';

const fixturesDirectory = new URL('../fixtures/twig/', import.meta.url);

const pendingPatchesByFixture: Record<string, string[]> = {
};

const showPendingMismatches = process.env['PARITY_SHOW_PENDING'] === '1';

const fixtureNames = readdirSync(fixturesDirectory).filter((name) => name.endsWith('.twig')).sort();

function assertParity(fixtureName: string): void {
  const source = readFileSync(new URL(fixtureName, fixturesDirectory), 'utf8');
  const golden = JSON.parse(readFileSync(new URL(fixtureName.replace(/\.twig$/, '.tokens.json'), fixturesDirectory), 'utf8')) as Golden;
  expect(findParityMismatches(source, golden).join('\n')).toBe('');
}

describe('lexer parity with Twig (golden files from tools/twig-oracle)', () => {
  for (const fixtureName of fixtureNames) {
    const pendingPatches = pendingPatchesByFixture[fixtureName];
    if (pendingPatches && !showPendingMismatches) {
      it.fails(`${fixtureName} (awaiting ${pendingPatches.join(', ')})`, () => assertParity(fixtureName));
    } else {
      it(fixtureName, () => assertParity(fixtureName));
    }
  }
});
